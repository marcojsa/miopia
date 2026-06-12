# Design — produto

> Extraído de docs/design-arquitetura.json (designs[2]). Fonte de verdade: o JSON.

## Perspectiva

PRODUTO E UX. Princípio organizador do MVP: o app tem dois loops com frequências diferentes e não se pode confundi-los. O loop diário é a rotina noturna (atropina e ortho-k acontecem ao deitar; a retirada da lente, ao acordar): check-in de 1 toque, lembrete confiável, recompensa visual imediata. O loop trimestral é a consulta: dados clínicos novos (EE e axial por olho) e a palavra da Dra. Christiane. O dashboard clínico NÃO sustenta uso diário (muda 2-3x/ano), então a retenção vem do loop noturno gamificado; o dashboard sustenta a percepção de valor ('agora eu entendo o tratamento') e a autoridade da clínica. Tudo que o app mostra de clínico é exibição neutra de dados digitados pela clínica; a única interpretação que existe no produto é o texto literal da médica, sempre assinado por ela (restrição ANVISA RDC 657/2022 transformada em conceito de produto: 'a voz da Dra. Christiane dentro do app', que por sinal é exatamente o posicionamento premium da clínica). A camada lúdica é tematicamente coerente com o tratamento: tudo acontece à noite, então o universo visual é um céu noturno em que cada noite de cuidado acende uma estrela, com uma coruja como mascote (enxerga no escuro). A criança vê o app no celular do pai, mas as telas de celebração nunca exibem números clínicos.

## Decisões

### Corte do MVP piloto

**Escolha:** IN: app dos pais com 14 telas (onboarding de 7 passos + 4 tabs: Hoje, Céu, Evolução, Mais) e painel admin web com 6 telas. OUT explícito (v2+): integração Klingo, chat in-app (usa o WhatsApp/Iris existente), agendamento, segundo responsável com conta própria, avatar customizável, pontos/loja, leaderboard, recompensas materiais, fotos/diário, modo criança em dispositivo separado, exportação PDF, registro de tempo ao ar livre, curvas de percentil, CMS de conteúdo, push remoto de marketing.

**Racional:** Piloto de 5-10 famílias precisa validar 2 hipóteses: (a) o loop noturno sustenta adesão e retenção; (b) o dashboard gera utilidade clínica percebida. Tudo que não testa uma dessas hipóteses sai. Chat e agendamento já são resolvidos pelo WhatsApp da clínica (Iris + Betânia), então duplicar seria custo sem aprendizado.

### Dashboard sem juízo clínico do app (ANVISA)

**Escolha:** Números e variações em tinta neutra (cinza-azulado escuro): sem verde/vermelho, sem setas coloridas, sem médias, tendências ou curvas de referência. A única interpretação na tela é o card de topo 'Avaliação da Dra. Christiane', texto livre escrito por ela no painel, com data e assinatura completa (CRM 75.580 | RQE 41.563 na primeira menção, regra da clínica).

**Racional:** RDC 657/2022: qualquer cálculo ou codificação visual que classifique a progressão (cor semafórica é classificação) muda o enquadramento regulatório. Além de seguro, isso reforça o posicionamento premium: quem avalia é a médica, não um algoritmo. Curvas de percentil ficam vetadas até reavaliação regulatória em v2.

### Apresentação de EE e axial para leigo

**Escolha:** Card 'Desde a última consulta' com toggle 'Desde o início' (valor anterior, valor atual e variação, por olho, escrito 'Olho direito/Olho esquerdo', sem jargão OD/OE como label principal) + gráfico de linha com toggle 'Grau (equivalente esférico)' | 'Comprimento do olho', 2 linhas por olho, pontos grandes e tocáveis (só há 2-3 pontos/ano, o ponto é o herói, não a linha). Explicação do axial em bottom sheet 'O que significam essas medidas?': o comprimento axial é o tamanho do olho em milímetros, a medida mais precisa do acompanhamento; o olho cresce junto com a criança e o objetivo do tratamento é que esse crescimento siga o ritmo esperado; quem avalia se o ritmo está adequado é a Dra. Christiane, na consulta.

**Racional:** Pais entendem 'grau' mas nunca ouviram 'comprimento axial'; enquadrar como crescimento esperado (não como ameaça) educa sem assustar e devolve a interpretação à médica. Cards de delta respondem a pergunta real do pai ('melhorou desde a última vez?') com dados, não com julgamento.

### Mecânica de streak perdoador

**Escolha:** Sequência contada em 'noites de cuidado' com 3 mecanismos de perdão: (1) Escudos: a cada 7 noites completas a família ganha 1 escudo (máximo 3 guardados); uma noite perdida consome 1 escudo automaticamente e a sequência continua (a estrela daquela noite fica prateada); (2) Modo férias: o pai programa um período de pausa com datas; noites pausadas viram nuvens e não quebram nada; (3) Pausa clínica: a médica suspende um tratamento pelo painel (ex.: conjuntivite suspende ortho-k) e o app exibe selo 'pausa orientada pela Dra. Christiane' sem quebrar a sequência.

**Racional:** Evidência citada no briefing: streaks rígidos causam abandono; doença e férias são certeza em 90 dias de tratamento infantil. Escudos transformam o perdão em recompensa ganha (não em desconto), e a pausa clínica resolve o caso real de interrupção médica sem punir a família.

### Visual lúdico para a criança

**Escolha:** Céu noturno mensal: cada noite completa acende 1 estrela; marcos de 7/30/90 noites formam constelações progressivas, com celebração animada curta no fechamento do dia (essa é a tela mostrada à criança). Marco de 90 noites gera o 'Diploma do Cuidado': card compartilhável com nome da criança e a coruja mascote, sem nenhum dado clínico. Recompensa SEMPRE a adesão (check-in feito), nunca resultado clínico.

**Racional:** Tema noturno é coerente com os dois tratamentos (ambos acontecem ao deitar). Jardim/avatares exigem mais assets e customização; céu de estrelas é barato de produzir, escala 1 asset por mês e mantém o app premium (céu roxo da paleta da clínica). Premiar resultado clínico seria interpretação (ANVISA) e cruel com a criança cuja miopia progride apesar da adesão.

### Onboarding e consentimento LGPD

**Escolha:** Clínica pré-cadastra família, filhos e regime no painel e gera código de convite de 6 dígitos (entregue pela Betânia na consulta ou via WhatsApp). Fluxo do pai: código, e-mail + OTP (sem senha), consentimento em camadas (4 cartões expansíveis em linguagem leiga: o que registramos, para que, quem vê, seus direitos), com DOIS aceites separados: checkbox de Termos/Privacidade e checkbox visualmente destacado 'Autorizo, como responsável legal, o tratamento dos dados de saúde do(s) meu(s) filho(s)...'. Depois: confirmação dos filhos (sem digitar dado clínico), configuração de horários por filho/tratamento, primer de notificações antes do prompt do sistema, e dashboard já semeado com a consulta-base.

**Racional:** Art. 14 §1º exige consentimento específico e em destaque: separar o aceite de saúde do aceite genérico de termos é o que materializa 'específico'; camadas expansíveis evitam wall of text sem esconder informação. Filhos pré-cadastrados eliminam o maior atrito e o maior risco de erro (pai digitando dado clínico). Dashboard nunca nasce vazio: a primeira impressão é a consulta real do filho com a palavra da médica.

### Lembretes e check-in

**Escolha:** Máximo 3 slots de notificação por dia por família (noite atropina, noite ortho-k, manhã retirada), consolidados: filhos com o mesmo horário compartilham 1 notificação que lista todos ('Hora do cuidado: Alice e Pedro'). Check-in de 1 toque com 3 saídas: 'Feito', 'Fazer depois', 'Não foi possível hoje' (com motivos rápidos e microcopy sem culpa). Tarefas noturnas podem ser registradas até 12h do dia seguinte; depois ficam 'sem registro' (estado neutro, não 'falha'). iOS: agendamento em janela rolante de 7 dias com reagendamento na abertura (3 filhos x 3 slots x 14 dias estouraria o limite de 64 notificações pendentes).

**Racional:** Família com 3 filhos receberia até 9 notificações/dia sem consolidação: fadiga garantida e desinstalação. Janela de registro até o meio-dia seguinte respeita a realidade (pai pinga o colírio e dorme sem abrir o app) sem permitir reescrever a semana, o que preservaria alguma honestidade do dado de adesão.

### Nome do app

**Escolha:** 5 opções, nesta ordem de recomendação: (1) Lumi (luz, curto, vira o nome da coruja mascote; loja: 'Lumi | Oftalmologia Alto de Pinheiros'); (2) Mirante (ver longe, sofisticado, 'quem observa de cima'); (3) Horizonte (enxergar longe como objetivo do tratamento); (4) Noctua (coruja em latim, tratamento noturno, premium, risco de pronúncia); (5) Foco (direto, porém genérico e com homônimos nas lojas). VETO: 'Íris', que é o nome da IA de WhatsApp da clínica na Kualiz e geraria confusão de marca interna.

**Racional:** Nome precisa funcionar para pai (loja, confiança) e criança (mascote, oralidade). Lumi une os dois e amarra o universo visual (luz, estrelas, noite). O veto a Íris vem do contexto já existente da clínica.

### Direção visual

**Escolha:** Paleta derivada da identidade da clínica com hierarquia invertida: roxo profundo #453A94 como cor primária e céu noturno; azul claro #F5FAFD para fundos diurnos; amarelo-estrela quente (~#FFC857) exclusivo de conquistas; verde sóbrio #88B04B para confirmações ('Feito'); o verde neon #59ED38 só em micro-acentos; dados clínicos sempre em tinta neutra. Tipografia: sans arredondada humanista para títulos (Nunito ou Quicksand) e Inter para corpo e números (algarismos tabulares no dashboard). Ilustração flat com gradientes suaves, cantos arredondados, coruja mascote; zero fotografias de crianças no app. Microcopy segue as regras de escrita da clínica (sem travessões, sem clichês de IA, autoridade sem venda).

**Racional:** Herda a marca da clínica (continuidade com site e materiais) mas o roxo como protagonista resolve o problema do verde neon (agressivo para app de saúde) e casa com o tema noturno. Sem fotos de crianças por minimização LGPD e porque ilustração envelhece melhor.

### Métricas do piloto e gate go/no-go

**Escolha:** Janela de avaliação: 8-10 semanas. Métricas: (1) Adesão primária: mediana por criança de % de noites com check-in completo nas semanas 2-8 (semana 1 excluída como lua de mel), alvo >= 70%; (2) Retenção D30: >= 7 de 10 famílias ativas na última semana do mês (>= 3 check-ins/semana); (3) Funil de onboarding: >= 90% dos códigos ativados chegam até lembretes configurados; (4) Latência notificação -> check-in < 2h na mediana; (5) Qualitativo: entrevista de 20 min com cada família no D30 + pergunta única de recomendação 0-10 + 'o que faria você parar de usar?'; (6) Lado clínica: tempo de lançamento de consulta no painel <= 5 min, e percepção da Dra. de que o dado de adesão ajudou na consulta; (7) Técnicas: crash-free >= 99%, lembretes efetivamente entregues. Gate para loja pública: adesão e retenção no alvo + >= 8/10 famílias querem continuar + Dra. confirma que o esforço do painel é sustentável.

**Racional:** Com N=5-10, NPS formal é estatisticamente vazio; entrevista qualitativa rende mais. Excluir a semana 1 evita decidir com base no entusiasmo inicial. O gate inclui o custo operacional da clínica porque o produto morre se a Dra. não alimentar o painel.

### Conteúdo educativo mínimo

**Escolha:** Tab 'Aprender' com 5-6 cards estáticos escritos/aprovados pela Dra. Christiane (o que é comprimento axial; por que a atropina é à noite; cuidados com a lente de ortho-k; o que esperar entre consultas; mitos comuns). Sem CMS: conteúdo fixo no bundle ou em tabela simples no Supabase.

**Racional:** Custo de construção quase nulo e sustenta a percepção de valor entre consultas. Conteúdo assinado pela médica reforça autoridade e mantém o app como exibidor de informação da clínica, não gerador de orientação própria.

### Famílias só com óculos/lentes especiais

**Escolha:** Incluídas com check-in único no fim do dia ('Usou os óculos hoje?', slot das 20h), mas confirmar com a Dra. se entram no piloto (questão aberta).

**Racional:** O regime existe na clínica e excluir essas famílias do piloto enviesaria o aprendizado; mas o check-in de óculos é mais sujeito a auto-relato vazio, então a decisão final depende da composição real das 5-10 famílias.

## Estrutura

# Mapa de telas do MVP piloto

## Corte exato

**IN (app dos pais):** onboarding em 7 passos (A0-A7) + 4 tabs (Hoje, Céu, Evolução, Mais) + check-in + detalhe de consulta + estados especiais. Total: 14 telas.
**IN (painel admin web):** login staff, lista de famílias, cadastro de família/filhos/regime + geração de convite, lançamento de consulta, pausa clínica, visão de adesão somente-leitura. Total: 6 telas.
**OUT (v2+):** integração Klingo; chat in-app (WhatsApp da clínica já cobre); agendamento; segundo responsável com conta própria; avatares customizáveis; pontos/loja/recompensas materiais; leaderboard; fotos e diário; modo criança em outro dispositivo; export PDF; tempo ao ar livre; curvas de percentil/referência no gráfico; CMS de conteúdo; push remoto de marketing; multi-idioma.

---

## A. App dos pais (Expo, iOS + Android)

### A0. Splash / Gate
Logo do app + selo "Oftalmologia Alto de Pinheiros". Sessão ativa vai para Hoje; senão, A1.

### A1. Boas-vindas + código de convite
```
[Ilustração: coruja mascote sob céu estrelado]
"O tratamento do seu filho, acompanhado de perto."
"App exclusivo para famílias da Oftalmologia Alto de Pinheiros."
[Campo: código de convite, 6 dígitos]   [Botão: Começar]
Link: "Não tem código? Fale com a clínica" -> WhatsApp
```
Código gerado no painel; Betânia entrega na consulta ou envia por WhatsApp.

### A2. Criação de conta
E-mail + código OTP por e-mail (Supabase Auth, sem senha). Nome do responsável + vínculo (mãe/pai/responsável legal).

### A3. Consentimento LGPD (em camadas, sem wall of text)
```
"Antes de começar, sua autorização"
4 cartões expansíveis (resumo de 1 linha; toque abre detalhe):
  1. O que registramos  (medidas das consultas digitadas pela clínica + seus check-ins)
  2. Para que usamos    (acompanhar o tratamento e lembrar a rotina; nada de publicidade)
  3. Quem vê            (você e a equipe da clínica; mais ninguém)
  4. Seus direitos      (corrigir, exportar e excluir a conta dentro do app)
[ ] Li e aceito os Termos de Uso e a Política de Privacidade
[ ] DESTACADO (fundo diferenciado, borda): "Autorizo, como responsável legal, o
    tratamento dos dados de saúde do(s) meu(s) filho(s) para acompanhamento
    do tratamento de controle da miopia."
[Botão: Autorizar e continuar]  (habilita só com os 2 aceites; registra timestamp + versão do texto)
```

### A4. Confirme seus filhos
Lista pré-cadastrada pela clínica: nome, data de nascimento, tratamento(s) de cada filho. Pai apenas confirma. "Algo errado? Avise a clínica" -> WhatsApp. Pai nunca digita dado clínico.

### A5. Horários dos lembretes (por filho, por tratamento)
```
Atropina:        1 horário  (sugestão 20:30, "no horário de deitar")
Ortho-k:         2 horários (colocar 21:00 / retirar 07:00)
Óculos especial: 1 horário  (check-in do dia, 20:00)
```
Filhos com o mesmo horário são consolidados em 1 notificação por família. Máximo 3 slots/dia.

### A6. Primer de notificações
Tela própria ANTES do prompt do sistema: por que os lembretes importam, o que será pedido. iOS: permissão de notificação. Android 13+: POST_NOTIFICATIONS; tela extra explicando alarme exato quando aplicável. Canais Android nomeados ("Lembretes da rotina"), nunca o canal Miscellaneous. Se negar: banner persistente na Home com atalho para ajustes.

### A7. Primeira experiência
Dashboard nunca nasce vazio: já exibe a consulta-base digitada pela clínica + card "Avaliação da Dra. Christiane". Tour de 3 cards: "Sua rotina da noite", "O céu de estrelas de [nome]", "A evolução nas consultas". CTA final: "Sua primeira missão começa hoje à noite".

---

### Tab bar: Hoje · Céu · Evolução · Mais

### A8. Hoje (Home)
```
Saudação + data
[2+ filhos: chips por filho com cor própria]
NOITE
  [ ] Atropina da Alice (20:30)          [Feito]
  [ ] Colocar lentes do Pedro (21:00)    [Feito]
MANHÃ
  [ ] Retirar lentes do Pedro (07:00)
Resumo de ontem: "3 de 3 cuidados concluídos. Estrela acesa."
Linha de sequência: "12 noites de cuidado · 2 escudos guardados"
[Card de marco próximo: "Faltam 3 noites para a constelação dos 30 dias"]
```

### A9. Check-in (bottom sheet sobre a Home)
Toque na tarefa abre: [Feito agora] [Fazer depois] [Não foi possível hoje]. "Não foi possível" pede motivo rápido (doença, esqueceu, sem a lente, outro), microcopy acolhedor, sem culpa. Tarefas noturnas registráveis até 12:00 do dia seguinte; depois viram "sem registro" (neutro). Quando o dia fecha completo: animação curta de estrela acendendo. Esta é a tela que o pai mostra para a criança. Funciona offline (fila local, sincroniza depois).

### A10. Céu (progresso lúdico, por filho)
```
Céu noturno do mês: 1 estrela por noite completa
Estrela prateada = noite salva por escudo (escudo ganho a cada 7 noites, máx. 3)
Nuvens = modo férias (pai programa datas) ou pausa clínica
   (selo: "pausa orientada pela Dra. Christiane")
Marcos: 7 noites = primeira constelação · 30 = constelação maior ·
        90 = céu completo + "Diploma do Cuidado" (card compartilhável com
        nome da criança e a coruja; NUNCA exibe dados clínicos)
```

### A11. Evolução (dashboard clínico, por filho)
```
[Seletor de filho]
CARD 1 (topo, destaque): "Avaliação da Dra. Christiane"
  Texto literal escrito por ela no painel + data da consulta
  Assinatura: Dra. Christiane Sciammarella Wakisaka (CRM 75.580 | RQE 41.563)
CARD 2: toggle "Desde a última consulta" | "Desde o início"
  Grau (equivalente esférico)
    Olho direito:  -2,25 D -> -2,50 D   (variação -0,25 D)
    Olho esquerdo: ...
  Comprimento do olho
    Olho direito:  24,10 mm -> 24,18 mm (variação +0,08 mm)
  Tinta NEUTRA: sem verde/vermelho, sem setas coloridas (o juízo é da médica)
CARD 3: gráfico de linha · toggle "Grau" | "Comprimento do olho"
  2 linhas (Olho direito / Olho esquerdo), pontos grandes e tocáveis
  (2-3 medições/ano: o ponto é o herói) · tooltip com data e valores
  SEM curvas de referência ou percentis no MVP
CARD 4: "O que significam essas medidas?" -> bottom sheet educativo
  (axial = tamanho do olho em mm; medida mais precisa do acompanhamento;
   o olho cresce com a criança; quem avalia o ritmo é a Dra. Christiane)
[Card: "Próxima consulta prevista: ago/2026" se a clínica preencher]
Lista: histórico de consultas -> A12
```

### A12. Detalhe da consulta
Data, medidas dos 2 olhos (EE + axial), avaliação textual da Dra. naquela consulta, tratamento vigente na época.

### A13. Aprender
5-6 cards estáticos escritos/aprovados pela Dra.: o que é comprimento axial; por que a atropina é à noite; cuidados com a lente de ortho-k; o que esperar entre consultas; mitos comuns. Sem CMS no MVP.

### A14. Mais (perfil e ajustes)
Lembretes (editar horários) · Modo férias (programar período) · Filhos (dados cadastrais; correção via clínica) · Conta: dados do responsável, política de privacidade, exportar meus dados, EXCLUIR CONTA in-app (obrigatório Apple; soft-delete com aviso de prazo) · Falar com a clínica -> deep link WhatsApp · Termos e versão.

### Estados especiais
Notificações negadas: banner persistente na Home. Offline: check-in local com sincronização. Entre consultas: Evolução mostra "próxima consulta prevista" para não parecer estagnado.

---

## B. Painel administrativo (web interno, mesma base Supabase)

### B1. Login staff
E-mail da clínica; papéis: medica | secretaria.

### B2. Pacientes / famílias
Lista com busca; status do convite (pendente / ativo); última consulta lançada.

### B3. Nova família
Responsável (nome, e-mail/telefone) · filhos (nome, nascimento) · regime por filho (atropina e/ou ortho-k e/ou óculos especial) -> gera código de convite de 6 dígitos.

### B4. Lançar consulta (2-3x/ano por paciente, alvo <= 5 min)
```
Data da consulta
EE OD / OE      (passo 0,25 D, com sinal)
Axial OD / OE   (passo 0,01 mm)
Validação de faixa fisicamente plausível (qualidade de dado, não interpretação)
CONFIRMAÇÃO DUPLA: re-exibe os valores antes de salvar
"Avaliação para a família" (texto livre da Dra., OBRIGATÓRIO;
  é o que aparece no card principal do app)
Próxima consulta prevista (opcional)
Tratamento vigente (atualizável)
```

### B5. Pausa clínica
Suspende tratamento X do paciente Y por período; reflete no app sem quebrar a sequência, com selo da médica.

### B6. Visão de adesão (somente leitura)
% de noites com check-in por paciente nos últimos 30/90 dias, para a Dra. abrir durante a consulta.

---

## Métricas do piloto (resumo operacional)
Janela: 8-10 semanas. Adesão (mediana de noites completas, semanas 2-8) >= 70% · Retenção D30 >= 7/10 famílias ativas · Funil de onboarding >= 90% · Latência notificação->check-in < 2h · Entrevista qualitativa D30 + nota 0-10 · Lado clínica: lançamento <= 5 min e utilidade percebida pela Dra. na consulta · Crash-free >= 99%. Gate para loja: metas batidas + >= 8/10 famílias querem continuar + Dra. confirma esforço sustentável do painel.

---

### Critical Files for Implementation
Projeto greenfield (sem codebase). Arquivos de contexto existentes que a implementação deve herdar (tom, identidade, dados da clínica):
- C:\Users\User\OneDrive\Documents\Claude Code\clientes\oftalmologistas\CLAUDE.md (índice do cliente, nomenclatura da médica)
- C:\Users\User\OneDrive\Documents\Claude Code\clientes\oftalmologistas\Copywriting\CLAUDE.md (regras de escrita: sem travessões, sem clichês, autoridade sem venda; vale para toda microcopy do app)
- C:\Users\User\OneDrive\Documents\Claude Code\clientes\oftalmologistas\guia-layout-miopia-infantil.md (paleta e linguagem visual já aprovadas da clínica)
- C:\Users\User\OneDrive\Documents\Claude Code\clientes\oftalmologistas\Dados\ (dados cadastrais da clínica para a ficha das lojas e política de privacidade)
- C:\Users\User\OneDrive\Documents\Claude Code\clientes\oftalmologistas\proposta-consultoria-alto-de-pinheiros.md (escopo contratual da consultoria)

## Riscos

- Auto-relato infla adesão: check-in 'Feito' não prova que o colírio foi pingado. Mitigar com microcopy sem culpa (reduz mentira por vergonha) e janela de registro limitada a 12h; nunca vender o dado à Dra. como medida objetiva.
- Fadiga de notificação em famílias com 3 filhos: sem consolidação por horário/família seriam até 9 toques/dia. A consolidação é requisito de UX do MVP, não otimização futura.
- Scope creep ANVISA por microcopy e cor: qualquer seta colorida, semáforo, média, tendência ou curva de percentil reintroduz interpretação clínica e muda o enquadramento da RDC 657/2022. Revisar todo o dashboard com essa lente antes de cada release.
- Vale do tédio entre consultas: o dashboard muda 2-3x/ano; se o loop noturno não sustentar sozinho, a retenção D60 cai. É exatamente o que o piloto mede; não mascarar com features novas no meio do piloto.
- Erro de digitação no painel assusta família (24,18 digitado como 24,81 mm parece progressão dramática): confirmação dupla + validação de faixa plausível no formulário B4 são obrigatórias desde o MVP.
- Avaliação textual obrigatória da Dra. pode virar gargalo operacional: se ela não escrever, o card principal do app fica sem conteúdo. Negociar com ela um conjunto de frases-modelo próprias, definidas uma vez e reutilizadas.
- Revisão da Apple (guideline 5.1.1(ix) e exclusão de conta): preparar conta demo com dados fictícios para o revisor e garantir exclusão in-app desde o primeiro build de TestFlight, não 'depois'.
- A criança vê o celular do pai: celebrações e Diploma do Cuidado não podem exibir números clínicos; a separação Céu (criança) vs Evolução (pai) precisa ser mantida por design em qualquer feature futura.
- Limite de 64 notificações locais pendentes no iOS: 3 filhos x 3 slots x 14 dias = 126. Agendar janela rolante de ~7 dias com reagendamento na abertura do app; no Android, canais nomeados + tratamento de alarme exato do Android 14+.
- Conflito de nome: a clínica já tem a IA 'Íris' no WhatsApp; nomear o app de forma parecida confundiria as famílias sobre onde falar com a clínica.

## Perguntas em aberto

- A clínica tem histórico retroativo (consultas antigas no Klingo ou papel) para semear o gráfico com mais de 1 ponto por criança, ou o piloto começa só com a última consulta?
- A 'Avaliação da Dra. Christiane' será texto livre a cada consulta ou ela prefere definir um conjunto fixo de frases dela mesma (mais rápido no dia a dia, mesmo enquadramento ANVISA)?
- Quem opera o painel no dia a dia: a Dra. lança medidas e texto, ou Betânia digita as medidas e a Dra. só escreve a avaliação?
- Famílias só com óculos/lentes especiais (sem rotina noturna) entram no piloto? O check-in diário 'usou os óculos hoje' é útil ou vira ruído de auto-relato?
- Existe demanda real por segundo responsável com conta própria (pai E mãe revezam a rotina)? Ficou fora do MVP; validar nas entrevistas de D30 antes de construir.
- Nome e mascote precisam de aprovação da Dra.; ela quer a marca da clínica no nome de loja ('Lumi | Oftalmologia Alto de Pinheiros') ou marca própria do app?
- A clínica consegue preencher 'próxima consulta prevista' no painel (consultando a agenda Klingo manualmente) para alimentar o card correspondente no app?
- Status das contas de loja no CNPJ da clínica (Apple Developer Organization + Play Console): já iniciadas? O D-U-N-S da Apple pode levar semanas e trava o cronograma do TestFlight.
