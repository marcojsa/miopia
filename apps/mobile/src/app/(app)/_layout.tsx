// Grupo (app): guard de auth + gate de consentimento LGPD + abas (Hoje, Céu,
// Progresso, Mural, Família). Visual dos mockups aprovados: ativo roxo #453A94,
// inativo #94A3B8, fundo branco, sem header default (cada tela cuida do topo).
//
// GATE LGPD: com sessão mas consentimento pendente para alguma criança, manda
// para (auth)/consent ANTES de liberar as abas. A tela de consentimento, ao não
// achar pendência, faz router.replace('/') — logo o gate não cria loop.
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { StaffAccountScreen } from '@/components/auth/StaffAccountScreen';
import { DocumentIcon, MoonIcon, PeopleIcon, PlayIcon, StarIcon } from '@/components/icons';
import { NotificationPrimer } from '@/components/notificacoes/NotificationPrimer';
import { BootScreen } from '@/components/ui';
import {
  useChildren,
  useConsentPending,
  useContents,
  useHasMeasurements,
  useIsStaff,
  useNotificationPermission,
  useReminderSync,
} from '@/hooks';
import { CONVITE_HREF, usePendingPassword } from '@/hooks/usePendingPassword';
import { notifId } from '@/lib/notifications/scheduler';
import { useSession } from '@/providers/auth';
import { useUiStore } from '@/stores/ui';
import { colors, fonts } from '@/theme/tokens';
import type { ReminderType } from '@/types/domain';

/**
 * Efeitos que só valem depois dos gates (sessão, conta de responsável,
 * consentimento): agendar os lembretes da família e abrir o check-in pedido
 * pelo toque na notificação (agora o navegador já existe).
 */
function AfterGates() {
  useReminderSync();

  const router = useRouter();
  const pendingCheckin = useUiStore((s) => s.pendingCheckin);
  useEffect(() => {
    if (!pendingCheckin) return;
    useUiStore.setState({ pendingCheckin: null });
    const { childId, type, treatmentId, dose } = pendingCheckin;
    const ref = treatmentId ? { treatmentId, dose: dose ?? 1 } : undefined;
    router.push(`/checkin/${notifId(childId, type as ReminderType, null, ref)}`);
  }, [pendingCheckin, router]);

  return null;
}

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const staff = useIsStaff();
  const childrenQuery = useChildren();
  const consent = useConsentPending(session?.user.id ?? null);
  const notifications = useNotificationPermission();
  const pendingPassword = usePendingPassword(session?.user.id ?? null);
  // Aba Progresso só quando alguma criança da família tem medição de consulta.
  const hasMeasurements = useHasMeasurements();
  // Aba Mural só com pelo menos 1 conteúdo publicado pela clínica.
  const contents = useContents();
  // A 1ª decisão do gate segura as abas; depois disso, recarregar filhos ou
  // consentimento (nova key) NÃO desmonta o navegador nem perde a rota atual.
  const decided = useRef(false);

  if (isLoading) return <BootScreen />; // aguardando sessão persistida do AsyncStorage
  if (!session) {
    decided.current = false;
    return <Redirect href="/(auth)/welcome" />;
  }

  // Convite aberto pelo link e app fechado antes de criar a senha: volta para a senha.
  if (pendingPassword.isLoading) return <BootScreen />;
  if (pendingPassword.pending) return <Redirect href={CONVITE_HREF} />;

  // Segura a renderização até filhos E consentimento resolverem (a query de
  // consentimento só liga depois dos filhos). Em erro/offline as queries resolvem
  // sem dado -> fail-open: o app abre normalmente (não trancamos ninguém por rede).
  if (
    !decided.current &&
    (staff.isLoading || childrenQuery.isLoading || consent.isLoading || notifications.isLoading)
  ) {
    return <BootScreen />;
  }
  decided.current = true;

  // Conta da equipe não usa o app do responsável (nem cai no consentimento LGPD).
  if (staff.data === true) return <StaffAccountScreen />;

  // Só redireciona quando a checagem RESOLVEU com pendência (evita flash em loading).
  if (consent.data?.pending) return <Redirect href="/(auth)/consent" />;

  // Primer de notificação: uma vez, antes das abas, se o sistema ainda não perguntou.
  if (notifications.permission?.status === 'undetermined' && !notifications.primerSeen) {
    return (
      <NotificationPrimer
        onDone={() => {
          void notifications.refresh();
        }}
      />
    );
  }

  return (
    <>
      <AfterGates />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.purple,
          tabBarInactiveTintColor: colors.ink3,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.line,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.nunitoExtraBold,
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hoje',
            tabBarIcon: ({ color, size }) => <MoonIcon color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="ceu"
          options={{
            title: 'Céu',
            tabBarIcon: ({ color, size }) => <StarIcon color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            href: hasMeasurements.data === false ? null : undefined,
            title: 'Progresso',
            tabBarIcon: ({ color, size }) => <DocumentIcon color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="mural"
          options={{
            href: contents.data?.length === 0 ? null : undefined,
            title: 'Mural',
            tabBarIcon: ({ color, size }) => <PlayIcon color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Família',
            tabBarIcon: ({ color, size }) => <PeopleIcon color={color} size={size ?? 24} />,
          }}
        />
      </Tabs>
    </>
  );
}
