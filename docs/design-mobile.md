# Design — mobile

> Extraído de docs/design-arquitetura.json (designs[1]). Fonte de verdade: o JSON.

## Perspectiva

App mobile e notificações — arquitetura Expo/React Native e o sistema de lembretes como núcleo do produto. Princípio orientador: o app precisa funcionar como um despertador confiável que está offline 99% do tempo (notificações locais, cache persistido, fila de sincronização), com o servidor (Supabase) servindo apenas como fonte de verdade eventual. Toda decisão de notificação foi tomada para minimizar fricção de permissão no onboarding dos pais e maximizar confiabilidade de entrega nos dois sistemas operacionais, respeitando a restrição ANVISA (app só exibe; streak 'perdoador' é display de adesão, sem interpretação clínica).

## Decisões

### Limite de 64 notificações do iOS

**Escolha:** Triggers diários REPETITIVOS (type: 'daily', repeats: true) com conteúdo estático — NÃO usar rolling re-schedule de notificações datadas

**Racional:** Uma notificação repetitiva diária ocupa exatamente 1 slot pendente no iOS, permanentemente. Pior caso (3 filhos × 3 lembretes: atropina, ortho-k colocar, ortho-k retirar) = 9 slots de 64. Rolling window de 7 dias com conteúdo dinâmico daria 63 slots no pior caso — encostado no limite e exigindo que o app abra semanalmente para reagendar (se a família não abrir, lembretes param: falha catastrófica para um app de adesão). Trade-off aceito: o texto da notificação é fixo (sem '5 dias seguidos!'); a celebração dinâmica fica dentro do app, na tela Hoje.

### Android: exact vs inexact alarm

**Escolha:** Alarme INEXATO (default). NÃO pedir SCHEDULE_EXACT_ALARM nem declarar USE_EXACT_ALARM. Remover a permissão do manifest via configuração do expo-notifications

**Racional:** Janela de ~10min é clinicamente aceitável para 'colírio ao deitar' e 'lente ao dormir' — não é insulina. SCHEDULE_EXACT_ALARM no Android 14+ é negada por padrão e exige levar o pai a uma tela de Settings do sistema (fricção que mata onboarding); USE_EXACT_ALARM é restrita por política do Google Play a apps de alarme/calendário — declará-la em app de saúde é risco concreto de rejeição na revisão. O verdadeiro inimigo no Android são os battery killers de OEM (Xiaomi/MIUI, Samsung): mitigar com tela 'Lembretes atrasando?' que abre as configurações de otimização de bateria via Linking/expo-intent-launcher, e validar nos aparelhos reais das 5-10 famílias do piloto.

### Canais de notificação Android

**Escolha:** Canal dedicado 'lembretes-tratamento' (AndroidImportance.MAX, vibração, som, lockscreen PUBLIC) criado no startup ANTES de qualquer agendamento + canal secundário 'clinica' (importância DEFAULT) para push remoto. channelId passado dentro do trigger de cada notificação agendada

**Racional:** Sem channelId explícito, expo-notifications joga tudo no canal 'Miscellaneous' silencioso — lembrete que não toca é lembrete que não existe. Dois canais separados dão ao pai controle granular nas configurações do sistema (pode silenciar avisos da clínica sem matar os lembretes do filho). Criar no _layout.tsx raiz garante que o canal existe antes do primeiro agendamento.

### Check-in de adesão

**Escolha:** Ações na própria notificação ('Feito' / 'Pular') com opensAppToForeground: false, gravando num OUTBOX local primeiro e sincronizando com Supabase depois (upsert idempotente por client_id UUID). Tap no corpo da notificação abre sheet de check-in no app como fallback

**Racional:** Responder da notificação remove a maior barreira de adesão ao próprio registro (pai com filho no colo às 20h30 não vai abrir app). O outbox-first garante que o check-in nunca se perde: escrito em AsyncStorage no handler, flush no foreground/reconexão, upsert com onConflict: 'client_id' torna retry seguro. RISCO conhecido: handling de ação em background tem quirks (iOS pode segurar a resposta até a próxima abertura via getLastNotificationResponseAsync) — é o item nº 1 a validar em dev build físico na semana 1; se for instável, fallback é a ação abrir o app numa sheet rápida (1 tap a mais, ainda aceitável).

### Stack de estado e dados

**Escolha:** TanStack Query + supabase-js para todo dado de servidor, com cache PERSISTIDO em AsyncStorage (persistQueryClient); Zustand apenas para estado efêmero de UI (filho ativo selecionado, passo do onboarding). Outbox de check-ins em AsyncStorage puro (não SQLite)

**Racional:** Medições e regimes mudam 2-3x/ano — é o caso de uso perfeito para cache persistido com staleTime longo (12-24h): o dashboard abre instantâneo e offline. Zustand não duplica dados de servidor (anti-pattern). SQLite seria overkill para um outbox de ~3 registros/dia por família; AsyncStorage com array JSON + flush é mais simples e funciona em Expo Go. Se v2 precisar de histórico local rico, migra-se para expo-sqlite.

### Expo Go vs dev build

**Escolha:** Expo Go só nos primeiros 2-3 dias (scaffolding de telas/rotas). Dev build EAS (profile development) na semana 1, antes de escrever o módulo de notificações

**Racional:** Tudo que importa neste app exige dev build: canais Android com importância MAX, categorias com botões de ação, som customizado, comportamento real de Doze/battery optimization, e push remoto (removido do Expo Go no Android desde SDK 53). Prototipar notificações em Expo Go gera falsa confiança — comportamento difere do build real. Dev client se rebuilda raramente (só quando muda dependência nativa); o dia-a-dia é hot reload de JS no dev client.

### Multi-filho: identidade e distinção das notificações

**Escolha:** Identifier determinístico `${childId}:${tipo}` para cada notificação agendada; título com nome da criança ('Hora do colírio da Alice'); threadIdentifier (iOS) e group (Android) por childId. Reconciliação declarativa: a cada mudança de regime/horário, syncSchedulesForFamily() compara desejado vs pendente e cancela/reagenda só o delta

**Racional:** ID determinístico elimina a classe inteira de bugs de notificação duplicada/órfã — cancelar e reagendar é idempotente. A reconciliação declarativa (em vez de agendar imperativamente em cada tela) significa que qualquer mudança (novo filho, troca de horário, pausa de férias, troca de regime atropina→ortho-k) passa pelo mesmo caminho de código. Agrupamento por criança evita parede de notificações indistinguíveis às 21h para família de 3 filhos.

### Pausa de tratamento (férias/doença) e streak perdoador

**Escolha:** Toggle 'pausar lembretes' por filho (com data de retorno opcional) que cancela os agendamentos e os recria no retorno; adesão exibida como meta semanal ('5 de 7 noites') em vez de streak de dias consecutivos

**Racional:** Streaks rígidos causam abandono (fato verificado). Meta semanal perdoa a noite perdida sem zerar o progresso visual da criança. A pausa explícita evita check-ins 'Pular' em série que poluiriam o dado de adesão que a Dra. Christiane vê. O cálculo '5 de 7' é display de adesão, não interpretação clínica — dentro do limite ANVISA.

### Push remoto (Expo Push) no MVP

**Escolha:** MVP inclui apenas o encanamento (registro do ExpoPushToken na tabela de devices) + UM caso de uso: 'Novos resultados da consulta disponíveis', disparado por Edge Function quando a clínica salva medições no painel. Lembrete de consulta marcada, mensagens livres da clínica e segmentação ficam para v2

**Racional:** O encanamento do token é barato (1 dia) e MUITO mais fácil de instalar agora do que retrofitar. O caso de uso escolhido fecha o loop de engajamento nas 2-3 consultas/ano (momento de maior valor do app: o pai vê o axial atualizado). Lembrete de consulta no MVP pode ser notificação LOCAL agendada quando a secretária Betânia digita a data no painel e o app sincroniza — sem precisar de infraestrutura de push agendado no servidor.

### Pipeline EAS e custo

**Escolha:** 3 profiles: development (developmentClient, internal distribution, APK + ad-hoc iOS), preview (TestFlight interno + Play Internal Testing), production. Free tier (15 builds/mês) com disciplina + EAS Update para iterar JS no preview sem rebuild. Primeiro build iOS na semana 1-2. Iniciar JÁ o enrollment Apple Developer da organização (D-U-N-S do CNPJ da clínica)

**Racional:** Dado o contexto financeiro do Marco, o free tier basta: após o setup inicial (~4-6 builds), o ritmo cai para 2-4 builds/mês porque JS itera via dev client e EAS Update. Upgrade para Starter (US$19) só se virar gargalo real. O enrollment Apple com D-U-N-S para CNPJ leva de 1 a 4+ semanas e é bloqueante para TestFlight — é a primeira ação do projeto, antes de qualquer linha de código. Dev no Windows = zero build iOS local; EAS cloud é obrigatório e um iPhone físico de teste é pré-requisito.

### Estrutura de navegação

**Escolha:** expo-router com grupos (auth)/(app), tab bar de 3 abas (Hoje, Progresso, Família), check-in como modal/sheet, e a tela 'Hoje' como home agregando os check-ins pendentes de todos os filhos

**Racional:** O job-to-be-done diário do pai é responder 'o que falta fazer hoje?' em <5 segundos — por isso Hoje é a home, não o dashboard clínico (que é consultado 2-3x/ano após consultas). Progresso é por filho (seletor no topo) porque os gráficos de EE/axial são individuais. Deletion de conta (exigência Apple) fica em Família > Conta.

## Estrutura

## 1. Árvore de telas/rotas (expo-router)

```
app/
├── _layout.tsx                      # Root: QueryClientProvider (com persistQueryClient/AsyncStorage),
│                                    #   AuthProvider (supabase.auth.onAuthStateChange),
│                                    #   ensureAndroidChannels(), registerCheckinCategory(),
│                                    #   listeners de notificação + useLastNotificationResponse,
│                                    #   NetInfo listener -> flushOutbox()
├── (auth)/
│   ├── _layout.tsx
│   ├── welcome.tsx                  # Marca da clínica, proposta de valor
│   ├── sign-in.tsx                  # Login (conta pré-criada pela clínica ou código de convite)
│   └── consent.tsx                  # LGPD art. 14 §1º: consentimento específico EM DESTAQUE,
│                                    #   bloqueante, registra timestamp+versão no Supabase
├── (app)/
│   ├── _layout.tsx                  # Guard de auth (redirect p/ (auth) se sem sessão) + Tabs
│   ├── index.tsx                    # ABA "HOJE": check-ins do dia de TODOS os filhos
│   │                                #   (cards: Alice/colírio 20h30 [Feito|Pular], Bruno/lente...),
│   │                                #   meta semanal "5 de 7 noites", avatar/progresso da criança
│   ├── progress/
│   │   ├── index.tsx                # ABA "PROGRESSO": seletor de filho
│   │   └── [childId].tsx            # Dashboard: gráficos EE (D, por olho) + axial (mm, por olho),
│   │                                #   STATUS escrito pela médica (campo texto — nunca calculado),
│   │                                #   histórico de consultas. Abre OFFLINE (cache persistido)
│   └── family/
│       ├── index.tsx                # ABA "FAMÍLIA": lista de filhos, perfil, configurações
│       ├── child/[childId].tsx      # Detalhe do filho: regime (atropina/ortho-k), horários,
│       │                            #   toggle "pausar lembretes" (férias/doença, data de retorno)
│       ├── reminders/[childId].tsx  # Editar horários por filho (atropina 20h30 default;
│       │                            #   ortho-k colocar ~21h30 / retirar ~07h00)
│       ├── notifications-help.tsx   # Troubleshooting Android: "lembretes atrasando?" ->
│       │                            #   abre config de otimização de bateria; instruções por OEM
│       └── account.tsx              # LGPD/Apple: exportar dados, EXCLUIR CONTA in-app
├── checkin/[id].tsx                 # Modal/sheet de check-in rápido (id = childId:tipo) —
│                                    #   destino do tap no corpo da notificação; deep link
└── +not-found.tsx
```

## 2. Estrutura de pastas (src/)

```
src/
├── lib/
│   ├── supabase.ts                  # createClient + auth storage (AsyncStorage)
│   ├── notifications/
│   │   ├── channels.ts              # ensureAndroidChannels()
│   │   ├── categories.ts            # registerCheckinCategory()
│   │   ├── scheduler.ts             # syncSchedulesForFamily() — reconciliação declarativa
│   │   ├── responses.ts             # handleNotificationResponse() + cold start
│   │   └── push.ts                  # registerPushToken() (Expo Push, caso de uso único MVP)
│   ├── outbox.ts                    # enqueueCheckin(), flushOutbox()
│   └── queryClient.ts               # TanStack Query + persistQueryClient(AsyncStorage)
├── features/
│   ├── today/                       # hooks + componentes da tela Hoje
│   ├── progress/                    # gráficos (victory-native ou react-native-svg + d3-scale)
│   ├── family/
│   └── adherence/                   # cálculo de meta semanal (display-only — ANVISA)
├── stores/
│   └── ui.ts                        # Zustand: filho ativo, estado efêmero (NUNCA dados de servidor)
└── types/
    └── domain.ts                    # Child, Regimen, Reminder, Checkin, Measurement
```

## 3. Módulo de notificações — pseudocódigo das funções-chave

```ts
// ── channels.ts ─────────────────────────────────────────────────────
export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('lembretes-tratamento', {
    name: 'Lembretes do tratamento',
    importance: Notifications.AndroidImportance.MAX,     // heads-up + som
    sound: 'default',                                    // (som custom: asset no build, decidir antes do 1º build)
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('clinica', {
    name: 'Avisos da clínica',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// ── categories.ts ───────────────────────────────────────────────────
export async function registerCheckinCategory() {
  await Notifications.setNotificationCategoryAsync('checkin', [
    { identifier: 'done', buttonTitle: 'Feito',
      options: { opensAppToForeground: false } },
    { identifier: 'skip', buttonTitle: 'Pular hoje',
      options: { opensAppToForeground: false } },
  ]);
}

// ── scheduler.ts ────────────────────────────────────────────────────
type ReminderType = 'atropina' | 'orthok_on' | 'orthok_off';
const notifId = (childId: string, type: ReminderType) => `${childId}:${type}`;

const COPY: Record<ReminderType, (nome: string) => {title: string; body: string}> = {
  atropina:  n => ({ title: `Hora do colírio — ${n}`,
                     body: 'Pingar a atropina antes de dormir. Toque em Feito quando aplicar.' }),
  orthok_on: n => ({ title: `Hora da lente — ${n}`,
                     body: 'Colocar a lente de ortho-k antes de dormir.' }),
  orthok_off:n => ({ title: `Retirar a lente — ${n}`,
                     body: 'Bom dia! Hora de retirar a lente de ortho-k.' }),
};

// CHAMADA ÚNICA de reconciliação: no app start, ao salvar regime/horário,
// ao pausar/retomar, ao adicionar/remover filho.
export async function syncSchedulesForFamily(children: ChildRegimen[]) {
  // 1. Estado DESEJADO a partir dos regimes (cache TanStack — funciona offline)
  const desired = new Map<string, Desired>();
  for (const c of children) {
    if (c.remindersPaused) continue;                     // férias/doença
    if (c.regimen.atropina)
      desired.set(notifId(c.id,'atropina'),  { ...COPY.atropina(c.firstName),  ...c.times.atropina });
    if (c.regimen.orthok) {
      desired.set(notifId(c.id,'orthok_on'), { ...COPY.orthok_on(c.firstName), ...c.times.orthokOn });
      desired.set(notifId(c.id,'orthok_off'),{ ...COPY.orthok_off(c.firstName),...c.times.orthokOff });
    }
  }
  // Pior caso: 3 filhos × 3 = 9 slots iOS (limite 64 — folga enorme)

  // 2. Estado ATUAL no SO
  const pending = await Notifications.getAllScheduledNotificationsAsync();

  // 3. Cancela órfãs (regime removido, filho pausado)
  for (const p of pending)
    if (!desired.has(p.identifier))
      await Notifications.cancelScheduledNotificationAsync(p.identifier);

  // 4. (Re)agenda novas/alteradas — ID determinístico = idempotente
  for (const [id, d] of desired) {
    if (alreadyScheduledWithSameTime(pending, id, d)) continue;
    await Notifications.cancelScheduledNotificationAsync(id);  // no-op se não existe
    const [childId, type] = id.split(':');
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: d.title, body: d.body,
        categoryIdentifier: 'checkin',                   // botões Feito/Pular
        data: { childId, type, scheduledHour: d.hour, scheduledMinute: d.minute },
        ...(Platform.OS === 'ios' && { threadIdentifier: childId }),  // agrupa por criança
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,  // repete = 1 slot iOS
        hour: d.hour, minute: d.minute,
        channelId: 'lembretes-tratamento',               // Android: channelId vai NO TRIGGER
      },
    });
  }
}

// ── responses.ts ────────────────────────────────────────────────────
export function handleNotificationResponse(resp: Notifications.NotificationResponse) {
  const { childId, type } = resp.notification.request.content.data;
  const action = resp.actionIdentifier;                  // 'done' | 'skip' | DEFAULT (tap no corpo)

  if (action === 'done' || action === 'skip') {
    // OUTBOX PRIMEIRO — nunca depender de rede no handler
    enqueueCheckin({
      client_id: uuidv4(),                               // chave de idempotência
      child_id: childId, reminder_type: type,
      status: action === 'done' ? 'done' : 'skipped',
      due_date: localDateString(),                       // data lógica do lembrete
      answered_at: new Date().toISOString(),
      source: 'notification_action',
    });
    void flushOutbox();                                  // best-effort imediato
    void Notifications.dismissNotificationAsync(resp.notification.request.identifier);
  } else {
    router.push(`/checkin/${childId}:${type}`);          // tap no corpo -> sheet no app
  }
}
// Cold start: no _layout raiz, useLastNotificationResponse() + processar se ainda não processada
// (guardar request.identifier+date processados para deduplicar).

// ── outbox.ts ───────────────────────────────────────────────────────
const KEY = 'outbox:checkins';
export async function enqueueCheckin(c: PendingCheckin) {
  const q = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  await AsyncStorage.setItem(KEY, JSON.stringify([...q, c]));
}
export async function flushOutbox() {
  const q: PendingCheckin[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  if (!q.length) return;
  const { error } = await supabase.from('checkins')
    .upsert(q, { onConflict: 'client_id', ignoreDuplicates: true });  // retry seguro
  if (!error) {
    await AsyncStorage.setItem(KEY, '[]');
    queryClient.invalidateQueries({ queryKey: ['checkins'] });
  }
}
// Gatilhos de flush: AppState -> 'active' | NetInfo reconectou | após enqueue | pull-to-refresh
```

## 4. Estratégia offline

| Dado | Cache | staleTime | Direção |
|---|---|---|---|
| Medições (EE + axial) + status da médica | TanStack persistido (AsyncStorage) | 12h | servidor -> app (read-only) |
| Regimes + horários de lembrete | TanStack persistido; fonte p/ scheduler | 1h | bidirecional (horário editável pelo pai) |
| Check-ins | outbox local -> upsert idempotente | — | app -> servidor |
| Sessão auth | supabase-js (AsyncStorage) | — | — |

Dashboard abre 100% offline a partir do cache persistido; lembretes disparam 100% offline (locais, agendados no SO). A ÚNICA coisa que exige rede é o flush do outbox e a atualização pós-consulta.

## 5. Pipeline EAS (eas.json) e sequência

```jsonc
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal",
                     "android": { "buildType": "apk" } },
    "preview":     { "distribution": "internal",        // -> TestFlight + Play Internal Testing
                     "channel": "preview" },             // EAS Update: itera JS sem rebuild
    "production":  { "channel": "production", "autoIncrement": true }
  }
}
```

Sequência: (0) HOJE: iniciar enrollment Apple Developer org com D-U-N-S do CNPJ da clínica (1-4+ semanas, bloqueante) + conta Play Console PJ. (1) Dias 1-3: scaffolding expo-router em Expo Go. (2) Dias 3-5: PRIMEIRO dev build EAS (Android APK + iOS ad-hoc no iPhone físico) — desbloqueia o trabalho real de notificações. (3) Semanas 1-3: módulo de notificações + outbox, validando ações de notificação nos dois SOs. (4) Semanas 3-5: telas Hoje/Progresso/Família + consent LGPD + delete account. (5) Semana 5-6: build preview -> TestFlight interno + Play Internal Testing com a equipe (Marco + Dra. Christiane + Betânia). (6) Piloto com 5-10 famílias, checklist de battery optimization por OEM Android.

## Riscos

- Handling de ações de notificação em background (opensAppToForeground: false) tem peculiaridades por plataforma: no iOS a resposta pode só ser entregue ao JS na próxima abertura do app (via getLastNotificationResponseAsync), registrando o check-in com atraso; no Android, headless JS pode não rodar em todos os OEMs. É o item nº 1 a validar em aparelho físico na semana 1 — se instável, fallback é a ação abrir o app numa sheet rápida (degradação aceitável, mas muda a UX prometida).
- Battery killers de OEM Android (Xiaomi/MIUI, Samsung, Oppo) matam notificações agendadas independentemente de exact/inexact alarm — risco direto ao coração do produto. Mitigação: tela de troubleshooting + checklist por fabricante no onboarding do piloto; levantar quais aparelhos as 5-10 famílias usam ANTES do piloto.
- Enrollment Apple Developer de organização exige D-U-N-S do CNPJ da clínica e pode levar de 1 a 4+ semanas, com possível verificação por telefone — bloqueia TestFlight e portanto todo teste iOS além do ad-hoc. Se não iniciar imediatamente, vira o caminho crítico do projeto.
- Dev solo no Windows: zero capacidade de build/teste iOS local. Dependência total de EAS cloud + necessidade de um iPhone físico de teste (verificar se Marco tem acesso a um). Ciclo de feedback iOS é mais lento (build cloud ~15-30min) — concentrar iteração diária no Android e validar iOS em marcos.
- Triggers diários repetitivos têm conteúdo estático e disparam mesmo em dia já 'check-inado' antecipadamente ou em feriado — sem pausa explícita, podem gerar 'Pular' em série que polui o dado de adesão visto pela médica. O toggle de pausa mitiga férias/doença, mas o caso 'pingou o colírio antes do lembrete' precisa de dismiss silencioso ou tolerância no relato.
- Free tier EAS (15 builds/mês) é suficiente só com disciplina: mudanças de dependência nativa no meio do desenvolvimento (ex.: adicionar som customizado, lib de gráficos com código nativo) forçam rebuilds em cascata. Agrupar mudanças nativas; orçar US$19/mês do Starter como contingência — relevante dado o caixa apertado do Marco.
- Horário do lembrete é hora LOCAL do aparelho (trigger daily) — viagem com fuso diferente desloca o lembrete junto com o relógio (comportamento provavelmente desejado para 'ao deitar', mas deve ser documentado, não descoberto).

## Perguntas em aberto

- Fim de semana e férias escolares têm horários diferentes (criança dorme/acorda mais tarde)? Se sim, o modelo de horário por filho precisa de variante semana/fim-de-semana já no schema (2 triggers em vez de 1 por tipo — ainda só 18 slots no pior caso), e isso afeta a tela de configuração.
- Quem cria a conta da família: a clínica pré-cadastra (Betânia digita e-mail no painel, pai recebe convite/magic link) ou o pai se cadastra com um código entregue na consulta? Afeta o fluxo (auth) inteiro e o vínculo seguro família-paciente (RLS).
- Um login por família ou um por responsável (pai E mãe)? Afeta atribuição do check-in, o consentimento LGPD ('pelo menos um dos pais') e possível duplicidade de lembrete em dois aparelhos (os dois celulares lembrariam — feature ou bug?).
- Marco tem iPhone físico para teste durante o desenvolvimento? Sem isso, validação iOS só via TestFlight de terceiros (Dra. Christiane?), com ciclo de feedback muito mais lento.
- Som de notificação customizado (toque suave, identidade da clínica) entra no MVP? É barato, mas precisa ser decidido ANTES do primeiro dev build (asset nativo) para não queimar um build extra do free tier.
- O lembrete de retirar a lente de ortho-k de manhã (~07h) é desejado por todas as famílias ou opcional? Acordar é evento natural — algumas famílias podem achar redundante/irritante; sugerir opt-in por filho na configuração.
