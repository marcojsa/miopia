// CONSENTIMENTO LGPD (art. 14 §1º) — passo juridicamente crítico do cadastro.
// Dado de saúde de criança exige consentimento ESPECÍFICO e EM DESTAQUE: por isso
// há DOIS aceites fisicamente separados (Termos roxo + Dados de saúde verde) e o
// botão só ativa com ambos marcados. Informação em camadas leigas (sem muro de
// texto), nome da criança e versão do termo gravados no registro (tabela consents).
// Uma criança por vez; ao autorizar todas -> router.replace('/'). Erros em pt-BR.
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTextField } from '@/components/auth/AuthTextField';
import {
  ConsentChildPill,
  ConsentLayer,
  ConsentSteps,
  FolderIcon,
  HealthConsentCard,
  LockIcon,
  PeopleConsentIcon,
  ScaleIcon,
  TargetIcon,
  TermsConsentRow,
} from '@/components/consent';
import { CheckIcon, ChevronIcon } from '@/components/icons';
import { AppText, Button, Screen } from '@/components/ui';
import { useChildren } from '@/hooks';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';
import type { Child } from '@/types/domain';

import { useQueryClient } from '@tanstack/react-query';

// Versão do app gravada no consentimento (rastreabilidade do aceite).
import Constants from 'expo-constants';

interface ActiveTerm {
  id: string;
  version: string;
  content_md: string;
  published_at: string;
}

interface Status {
  kind: 'error' | 'info';
  text: string;
}

const MSG_OFFLINE = 'Não conseguimos conectar. Verifique sua internet e tente novamente.';
const MSG_LOAD_FAIL = 'Não foi possível carregar o termo de consentimento. Tente novamente em instantes.';

// Camadas em linguagem leiga (copy fiel ao mockup onboarding-consentimento.html).
// As 3 últimas não estão no mockup como texto aberto; escrevi a copy no mesmo
// tom acolhedor e claro, dentro das regras (sem promessa clínica, sem juridiquês).
const LAYERS: readonly { key: string; title: string; body: string }[] = [
  {
    key: 'what',
    title: 'O que registramos',
    body: 'As medidas das consultas (grau e comprimento do olho), o tratamento orientado pela médica e os registros de que vocês fizeram o cuidado da noite. Não pedimos nem guardamos fotos da criança.',
  },
  {
    key: 'why',
    title: 'Para que usamos',
    body: 'Para acompanhar o controle da miopia ao longo do tempo e ajudar vocês a manterem a rotina de cuidado. Os dados servem ao tratamento da criança na clínica — nada de publicidade ou venda de dados.',
  },
  {
    key: 'who',
    title: 'Quem vê esses dados',
    body: 'Você, como responsável, e a equipe da clínica que cuida da criança. Não compartilhamos os dados com terceiros sem a sua autorização, exceto quando a lei exigir.',
  },
  {
    key: 'rights',
    title: 'Seus direitos',
    body: 'Você pode acessar, corrigir e retirar esta autorização a qualquer momento, sem perder o histórico já registrado pela clínica. É só ir em Mais › Privacidade ou falar com a recepção.',
  },
];

// Rótulo amigável da versão do termo (ex.: "versão 1.2 (junho/2026)").
const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function termVersionLabel(term: ActiveTerm): string {
  const d = new Date(term.published_at);
  if (Number.isNaN(d.getTime())) return `versão ${term.version}`;
  return `versão ${term.version} (${MONTHS_PT[d.getMonth()]}/${d.getFullYear()})`;
}

const LAYER_ICONS = [FolderIcon, TargetIcon, PeopleConsentIcon, ScaleIcon];

export default function ConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const childrenQuery = useChildren();

  const [term, setTerm] = useState<ActiveTerm | null>(null);
  const [pendingChildren, setPendingChildren] = useState<Child[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingTerm, setLoadingTerm] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Aceites da criança atual (resetam ao avançar).
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);

  // Nome do responsável (snapshot legal). Capturado no 1º consentimento e
  // reusado nos demais filhos da mesma sessão.
  const [guardianName, setGuardianName] = useState('');
  const [guardianKnown, setGuardianKnown] = useState(false); // já consentiu antes
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const [showFullTerm, setShowFullTerm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const guardianRef = useRef<TextInput>(null);

  // ── Carga: termo ativo + consentimentos já dados pelo responsável ──────────
  useEffect(() => {
    let mounted = true;
    if (!userId || childrenQuery.data === undefined) return;

    void (async () => {
      setLoadingTerm(true);
      setStatus(null);
      try {
        // Termo ATIVO (mais recente publicado, caso haja mais de um marcado).
        const { data: termRow, error: termErr } = await supabase
          .from('consent_terms')
          .select('id, version, content_md, published_at')
          .eq('active', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (termErr) throw termErr;

        // Consentimentos vigentes (não revogados) deste responsável.
        const { data: consentRows, error: consentErr } = await supabase
          .from('consents')
          .select('child_id, term_id, guardian_name_snapshot, granted_at, revoked_at')
          .eq('user_id', userId)
          .is('revoked_at', null)
          .order('granted_at', { ascending: false });
        if (consentErr) throw consentErr;

        if (!mounted) return;

        if (!termRow) {
          // Sem termo ativo não há o que consentir — não trava o app.
          setStatus({ kind: 'error', text: MSG_LOAD_FAIL });
          setLoadingTerm(false);
          setBootstrapped(true);
          return;
        }

        const activeTerm: ActiveTerm = termRow;
        setTerm(activeTerm);

        // Pré-preenche o nome do responsável a partir de um consentimento anterior.
        const prior = (consentRows ?? []).find((c) => c.guardian_name_snapshot);
        if (prior?.guardian_name_snapshot) {
          setGuardianName(prior.guardian_name_snapshot);
          setGuardianKnown(true);
        }

        // Criança precisa de consentimento se não há aceite vigente PARA O TERMO ATIVO.
        const consentedForTerm = new Set(
          (consentRows ?? [])
            .filter((c) => c.term_id === activeTerm.id)
            .map((c) => c.child_id)
        );
        const pending = (childrenQuery.data ?? []).filter((c) => !consentedForTerm.has(c.id));

        setPendingChildren(pending);
        setCurrentIndex(0);
        setLoadingTerm(false);
        setBootstrapped(true);
      } catch {
        if (!mounted) return;
        setStatus({ kind: 'error', text: MSG_LOAD_FAIL });
        setLoadingTerm(false);
        setBootstrapped(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, childrenQuery.data]);

  // Sem pendência -> já consentiu tudo: vai direto ao app.
  useEffect(() => {
    if (bootstrapped && !loadingTerm && term && pendingChildren.length === 0 && !status) {
      // Revalida o gate de (app)/_layout antes de sair (evita bounce de volta).
      void queryClient.invalidateQueries({ queryKey: ['consent-pending'] });
      router.replace('/');
    }
  }, [bootstrapped, loadingTerm, term, pendingChildren.length, status, router, queryClient]);

  const currentChild = pendingChildren[currentIndex] ?? null;
  const needsGuardianName = !guardianKnown && currentIndex === 0;
  const canSubmit = acceptTerms && acceptHealth && !submitting;

  const appVersion = useMemo(
    () => Constants.expoConfig?.version ?? null,
    []
  );

  const handleAuthorize = async (): Promise<void> => {
    if (submitting || !canSubmit || !term || !currentChild || !userId) return;
    setStatus(null);
    setGuardianError(null);

    const trimmedName = guardianName.trim();
    if (needsGuardianName && trimmedName.length < 3) {
      setGuardianError('Digite seu nome completo para registrar a autorização.');
      guardianRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('consents').insert({
        user_id: userId,
        guardian_name_snapshot: trimmedName,
        term_id: term.id,
        child_id: currentChild.id,
        app_version: appVersion,
      });
      if (error) throw error;

      // Sucesso: guarda o nome para os próximos filhos e avança.
      setGuardianName(trimmedName);
      setGuardianKnown(true);

      if (currentIndex + 1 < pendingChildren.length) {
        setCurrentIndex((i) => i + 1);
        setAcceptTerms(false);
        setAcceptHealth(false);
        setShowFullTerm(false);
      } else {
        // Último filho autorizado: revalida o gate antes de liberar as abas.
        await queryClient.invalidateQueries({ queryKey: ['consent-pending'] });
        router.replace('/');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const offline = msg.includes('network') || msg.includes('fetch');
      setStatus({
        kind: 'error',
        text: offline
          ? MSG_OFFLINE
          : 'Não foi possível registrar a autorização agora. Tente novamente em instantes.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = (): void => {
    if (router.canGoBack()) router.back();
  };

  // ── Estados de carga / erro de carga ───────────────────────────────────────
  const isBooting = !bootstrapped || childrenQuery.isLoading || loadingTerm;

  return (
    <Screen edges={['left', 'right']}>
      <LinearGradient
        colors={[...gradients.headerHoje.colors]}
        start={gradients.headerHoje.start}
        end={gradients.headerHoje.end}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerTop}>
          {router.canGoBack() ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              hitSlop={10}
              style={({ pressed }) => [styles.back, pressed ? styles.pressedDim : null]}
            >
              <ChevronIcon direction="left" color={colors.white} size={19} />
            </Pressable>
          ) : null}
          <ConsentSteps total={pendingChildren.length || 1} current={currentIndex} />
        </View>

        <AppText variant="small" color={colors.purple200} style={styles.kicker}>
          {pendingChildren.length > 1
            ? `Criança ${currentIndex + 1} de ${pendingChildren.length} · Privacidade`
            : 'Privacidade'}
        </AppText>
        <AppText variant="title" color={colors.white} accessibilityRole="header" style={styles.headerTitle}>
          Antes de começar, sua autorização
        </AppText>
        <AppText variant="body" color={colors.purple100} style={styles.headerLead}>
          O Lumi guarda dados de saúde da criança. Por isso pedimos sua autorização de forma clara e
          separada. Toque em cada item para entender o que registramos.
        </AppText>
        {currentChild ? (
          <View style={styles.pillWrap}>
            <ConsentChildPill child={currentChild} />
          </View>
        ) : null}
      </LinearGradient>

      {isBooting ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.purple} />
          <AppText variant="meta" color={colors.ink2} style={styles.centerText}>
            Carregando o termo de consentimento...
          </AppText>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            {status ? (
              <View style={styles.bannerError} accessibilityLiveRegion="polite">
                <AppText variant="meta" color={colors.ink}>
                  {status.text}
                </AppText>
              </View>
            ) : null}

            {currentChild ? (
              <>
                {/* Camadas expansíveis: a primeira aberta como exemplo. */}
                {LAYERS.map((layer, i) => {
                  const Icon = LAYER_ICONS[i] ?? FolderIcon;
                  return (
                    <View key={layer.key} style={styles.layerSpacing}>
                      <ConsentLayer
                        icon={<Icon size={19} color={colors.purple} />}
                        title={layer.title}
                        body={layer.body}
                        defaultOpen={i === 0}
                      />
                    </View>
                  );
                })}

                {/* Nome do responsável: só no 1º consentimento da sessão. */}
                {needsGuardianName ? (
                  <View style={styles.guardianCard}>
                    <AuthTextField
                      ref={guardianRef}
                      label="Seu nome completo (responsável legal)"
                      value={guardianName}
                      onChangeText={(t) => {
                        setGuardianName(t);
                        if (guardianError) setGuardianError(null);
                      }}
                      error={guardianError}
                      placeholder="Como no seu documento"
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="done"
                      accessibilityLabel="Seu nome completo"
                    />
                  </View>
                ) : null}

                {/* Aceite genérico de termos (roxo). */}
                <View style={styles.consentSpacing}>
                  <TermsConsentRow
                    checked={acceptTerms}
                    onToggle={() => setAcceptTerms((v) => !v)}
                  />
                </View>

                {/* Autorização específica de dados de saúde (verde, destacada). */}
                <View style={styles.consentSpacing}>
                  <HealthConsentCard
                    childFirstName={currentChild.first_name}
                    checked={acceptHealth}
                    onToggle={() => setAcceptHealth((v) => !v)}
                  />
                </View>

                {/* Rodapé: versão do termo + ler o termo completo + autorizar. */}
                <View style={styles.foot}>
                  {term ? (
                    <View style={styles.termVer}>
                      <LockIcon size={13} color={colors.ink3} />
                      <AppText variant="small" color={colors.ink3} style={styles.termVerText}>
                        Termo de consentimento · {termVersionLabel(term)}
                      </AppText>
                    </View>
                  ) : null}

                  {term ? (
                    <Pressable
                      onPress={() => setShowFullTerm((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showFullTerm }}
                      accessibilityLabel="Ler o termo completo"
                      style={({ pressed }) => [styles.readFull, pressed ? styles.pressedDim : null]}
                    >
                      <AppText variant="meta" color={colors.purple} style={styles.readFullText}>
                        {showFullTerm ? 'Ocultar o termo completo' : 'Ler o termo completo'}
                      </AppText>
                      <ChevronIcon direction={showFullTerm ? 'up' : 'down'} color={colors.purple} size={16} />
                    </Pressable>
                  ) : null}

                  {showFullTerm && term ? (
                    <View style={styles.fullTerm}>
                      <AppText variant="body" color={colors.ink2} style={styles.fullTermText}>
                        {term.content_md}
                      </AppText>
                    </View>
                  ) : null}

                  <Button
                    label="Autorizar e continuar"
                    onPress={() => {
                      void handleAuthorize();
                    }}
                    disabled={!canSubmit}
                    loading={submitting}
                    icon={canSubmit ? <CheckIcon size={17} color={colors.white} /> : undefined}
                    style={styles.submit}
                    accessibilityLabel="Autorizar e continuar"
                  />

                  <AppText variant="small" color={colors.ink3} style={styles.footHint}>
                    Você pode rever ou retirar esta autorização depois, sem perder o histórico já
                    registrado pela clínica.
                  </AppText>
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.headerX,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedDim: {
    opacity: 0.6,
  },
  kicker: {
    fontFamily: fonts.nunitoExtraBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 6,
  },
  headerLead: {
    marginTop: 7,
  },
  pillWrap: {
    marginTop: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
  },
  centerText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  bannerError: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radii.cardSm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  layerSpacing: {
    marginBottom: 11,
  },
  guardianCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.cardSm,
    padding: 15,
    marginTop: spacing.xs,
    marginBottom: 11,
  },
  consentSpacing: {
    marginBottom: 11,
  },
  foot: {
    marginTop: spacing.sm,
  },
  termVer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: spacing.sm,
  },
  termVerText: {
    fontFamily: fonts.interSemiBold,
  },
  readFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  readFullText: {
    fontFamily: fonts.interBold,
  },
  fullTerm: {
    backgroundColor: colors.purple50,
    borderRadius: radii.cardSm,
    padding: 14,
    marginBottom: spacing.md,
  },
  fullTermText: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  submit: {
    marginTop: spacing.xs,
    minHeight: 52,
  },
  footHint: {
    textAlign: 'center',
    marginTop: 9,
    lineHeight: 16,
  },
});
