// Definir senha a partir do link do e-mail: convite da clínica (miopia://convite)
// ou recuperação de senha (miopia://recuperar-senha). Lê os tokens do fragmento,
// abre a sessão com setSession e grava a senha com updateUser. Depois vai para '/',
// onde o gate de (app) cuida do consentimento.
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { parseAuthLink } from '@/lib/authLink';
import { signOutDoAparelho } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/auth';
import { colors, gradients, radii, spacing } from '@/theme/tokens';

const MIN_PASSWORD = 8;
const MSG_OFFLINE = 'Não conseguimos conectar. Verifique sua internet e tente novamente.';

// Conta cuja sessão foi aberta por um link de e-mail ainda não usado para gravar a senha.
// Em memória do módulo: sobrevive à remontagem da tela, mas não a abrir a rota sem link.
let linkSessionUserId: string | null = null;

type Mode = 'convite' | 'recuperacao';
type Phase = 'opening' | 'form' | 'invalid';

const COPY: Record<Mode, { title: string; subtitle: string; invalid: string; done: string }> = {
  convite: {
    title: 'Crie sua senha',
    subtitle: 'Bem-vindo ao Lumi. Defina a senha que você vai usar para entrar no app.',
    invalid:
      'Este convite expirou ou já foi usado. Peça um novo convite à recepção da clínica.',
    done: 'Criar senha e continuar',
  },
  recuperacao: {
    title: 'Nova senha',
    subtitle: 'Escolha uma nova senha para entrar no app.',
    invalid:
      'Este link expirou ou já foi usado. Peça outro em Entrar › Esqueci minha senha.',
    done: 'Salvar nova senha',
  },
};

export function SetPasswordScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const { session, isLoading: authLoading } = useSession();
  const copy = COPY[mode];
  const confirmRef = useRef<TextInput>(null);

  const [phase, setPhase] = useState<Phase>('opening');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Convite: Cancelar pede confirmação e encerra a sessão aberta pelo link.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const handledUrl = useRef<string | null>(null);
  const mounted = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  useEffect(() => {
    if (phase !== 'opening' || authLoading) return;

    void (async () => {
      const link = url ?? (await Linking.getInitialURL()) ?? '';
      // useURL e getInitialURL entregam o mesmo link no cold start: trata uma vez só.
      if (handledUrl.current === link) return;
      handledUrl.current = link;
      const parsed = parseAuthLink(link);

      if (parsed.kind === 'error') {
        if (mounted.current) setPhase('invalid');
        return;
      }
      if (parsed.kind === 'tokens') {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          if (!error && data.user) linkSessionUserId = data.user.id;
          if (mounted.current) setPhase(error || !data.user ? 'invalid' : 'form');
        } catch {
          if (mounted.current) setPhase('invalid');
        }
        return;
      }
      // Sem tokens: só segue para a senha se a sessão foi aberta pelo link (tela remontada).
      // Sessão aberta por login comum não troca senha por aqui.
      const current = sessionRef.current;
      if (current && linkSessionUserId === current.user.id) {
        if (mounted.current) setPhase('form');
        return;
      }
      if (current) {
        if (mounted.current) router.replace('/');
        return;
      }
      if (mounted.current) setPhase('invalid');
    })();
  }, [url, phase, authLoading, router]);

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    setStatus(null);
    if (password.length < MIN_PASSWORD) {
      setFieldError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setFieldError('As duas senhas não são iguais.');
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message.toLowerCase();
        setStatus(
          msg.includes('different from the old')
            ? 'A nova senha precisa ser diferente da anterior.'
            : msg.includes('weak') || msg.includes('characters')
              ? `Escolha uma senha mais forte, com pelo menos ${MIN_PASSWORD} caracteres.`
              : msg.includes('network') || msg.includes('fetch')
                ? MSG_OFFLINE
                : 'Não foi possível salvar a senha agora. Tente novamente em instantes.'
        );
        return;
      }
      // Só agora o convite conta como aceito (o clique no link não basta).
      await supabase.rpc('accept_my_invites').then(
        () => undefined,
        () => undefined
      );
      linkSessionUserId = null;
      router.replace('/');
    } catch {
      setStatus(MSG_OFFLINE);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    if (mode === 'convite') {
      setConfirmCancel(true);
      return;
    }
    linkSessionUserId = null;
    router.replace('/');
  };

  // O link do convite já foi usado: sem senha, a pessoa não entra de novo.
  const leaveWithoutPassword = async (): Promise<void> => {
    if (leaving) return;
    setLeaving(true);
    linkSessionUserId = null;
    try {
      await signOutDoAparelho();
    } finally {
      if (mounted.current) setLeaving(false);
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <LinearGradient
        colors={[...gradients.headerHoje.colors]}
        start={gradients.headerHoje.start}
        end={gradients.headerHoje.end}
        style={[styles.header, { paddingTop: insets.top + spacing.xl }]}
      >
        <AppText variant="title" color={colors.white} accessibilityRole="header" style={styles.headerTitle}>
          {copy.title}
        </AppText>
        <AppText variant="body" color={colors.purple100}>
          {copy.subtitle}
        </AppText>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'opening' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.purple} />
              <AppText variant="meta" color={colors.ink2} style={styles.loadingText}>
                Abrindo o link...
              </AppText>
            </View>
          ) : phase === 'invalid' ? (
            <Card>
              <AppText variant="body" color={colors.ink}>
                {copy.invalid}
              </AppText>
              <Button
                label="Ir para Entrar"
                onPress={() => router.replace('/(auth)/welcome')}
                style={styles.submit}
              />
            </Card>
          ) : confirmCancel ? (
            <Card>
              <AppText variant="body" color={colors.ink}>
                Sem criar a senha, você não consegue entrar no app depois. O link do convite já foi
                usado: para criar a senha mais tarde, use Entrar › Esqueci minha senha com este
                e-mail ou peça um novo convite à recepção da clínica.
              </AppText>
              <Button
                label="Voltar e criar a senha"
                onPress={() => setConfirmCancel(false)}
                disabled={leaving}
                style={styles.submit}
              />
              <Button
                label="Sair sem criar senha"
                variant="ghost"
                loading={leaving}
                onPress={() => {
                  void leaveWithoutPassword();
                }}
                style={styles.cancel}
              />
            </Card>
          ) : (
            <>
              {status ? (
                <View style={styles.banner} accessibilityLiveRegion="polite">
                  <AppText variant="meta" color={colors.ink}>
                    {status}
                  </AppText>
                </View>
              ) : null}
              <Card>
                {session?.user.email ? (
                  <AppText variant="meta" color={colors.ink2} style={styles.email}>
                    {session.user.email}
                  </AppText>
                ) : null}
                <AuthTextField
                  label="Senha"
                  secret
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (fieldError) setFieldError(null);
                  }}
                  placeholder={`Pelo menos ${MIN_PASSWORD} caracteres`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  accessibilityLabel="Senha"
                />
                <AuthTextField
                  ref={confirmRef}
                  label="Confirme a senha"
                  secret
                  value={confirm}
                  onChangeText={(text) => {
                    setConfirm(text);
                    if (fieldError) setFieldError(null);
                  }}
                  error={fieldError}
                  placeholder="Digite a mesma senha"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    void handleSave();
                  }}
                  accessibilityLabel="Confirme a senha"
                  containerStyle={styles.confirmField}
                />
                <Button
                  label={copy.done}
                  onPress={() => {
                    void handleSave();
                  }}
                  loading={saving}
                  style={styles.submit}
                />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  disabled={saving}
                  onPress={handleCancel}
                  style={styles.cancel}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: {
    marginBottom: 4,
  },
  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  banner: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: radii.cardSm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  email: {
    marginBottom: spacing.md,
  },
  confirmField: {
    marginTop: spacing.md,
  },
  submit: {
    marginTop: spacing.xl,
  },
  cancel: {
    marginTop: spacing.md,
  },
});
