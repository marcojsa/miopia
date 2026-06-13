// Design tokens do Lumi — derivados dos mockups aprovados em docs/mockups/
// (hoje.html Versão A, ceu.html Estilo A) e do CTX de design.
// REGRA DURA (ANVISA RDC 657/2022): valores clínicos SEMPRE em tinta neutra
// (ink/ink2/ink3). Verde é EXCLUSIVO do botão "Feito" e do checkbox de saúde
// LGPD; amarelo-estrela é EXCLUSIVO de estrelas/escudos/marcos.

export const colors = {
  // Roxos (identidade)
  purple950: '#1D1840',
  purple900: '#2A2350',
  purple800: '#372E7A',
  purple: '#453A94', // primário
  purple500: '#5B4FB5',
  purple400: '#6A5FC4',
  purple200: '#C9C2EE',
  purple100: '#E9E6F8',
  purple50: '#F4F2FC',

  // Superfícies
  surface: '#F5FAFD', // fundo claro padrão
  white: '#FFFFFF',

  // Funcionais (uso EXCLUSIVO — ver cabeçalho)
  green: '#88B04B', // ÚNICO verde: botão Feito + checkbox saúde LGPD
  star: '#FFC857', // EXCLUSIVO de estrelas/escudos/marcos
  silver: '#C7CEDB', // estrela salva por escudo
  cloud: '#8E9BBF', // nuvem (modo férias)
  moon: '#F5E9C8', // lua do céu
  coral: '#F4976C', // bico/pés da Lumi, acentos quentes

  // Neutros (tinta de dado clínico SEMPRE aqui)
  ink: '#334155',
  ink2: '#64748B',
  ink3: '#94A3B8',
  line: '#E2E8F0', // divisas/bordas

  // Coruja Lumi (Estilo A)
  owlEye: '#6F63C8',
  owlPupil: '#241D4F',
  owlBelly: '#EDEBFF',
} as const;

// Gradientes (expo-linear-gradient). start/end convertem o ângulo CSS dos
// mockups para coordenadas 0..1. Uso:
//   <LinearGradient colors={[...gradients.headerHoje.colors]} start={...} end={...} />
export interface GradientSpec {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
  locations?: readonly [number, number, ...number[]];
}

export const gradients = {
  /** Header da tab Hoje — CSS 165deg, #453A94 -> #372E7A. */
  headerHoje: {
    colors: ['#453A94', '#372E7A'],
    start: { x: 0.37, y: 0 },
    end: { x: 0.63, y: 1 },
  },
  /** Card "O céu da..." na Hoje — CSS 150deg, #1D1840 -> #372E7A. */
  cardCeu: {
    colors: ['#1D1840', '#372E7A'],
    start: { x: 0.21, y: 0 },
    end: { x: 0.79, y: 1 },
  },
  /** Fundo da tela Céu (fullscreen) — CSS 178deg, 3 paradas. */
  skyBackground: {
    colors: ['#171232', '#241D4F', '#453A94'],
    start: { x: 0.48, y: 0 },
    end: { x: 0.52, y: 1 },
    locations: [0, 0.46, 1],
  },
} as const satisfies Record<string, GradientSpec>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  /** Padding horizontal do corpo das telas (mockup: 18px). */
  screenX: 18,
  /** Padding horizontal de headers com gradiente (mockup: 24px). */
  headerX: 24,
} as const;

export const radii = {
  /** Cards grandes (task da Hoje, meta semanal). */
  card: 20,
  /** Cards menores (linha da manhã, cards do céu). */
  cardSm: 16,
  button: 14,
  /** Quadradinho de ícone de tarefa (mockup .ticon). */
  iconBox: 14,
  chip: 12,
  pill: 999,
} as const;

// Famílias com os nomes EXATOS do expo-google-fonts (carregadas no root layout).
export const fonts = {
  nunitoSemiBold: 'Nunito_600SemiBold',
  nunitoBold: 'Nunito_700Bold',
  nunitoExtraBold: 'Nunito_800ExtraBold',
  nunitoBlack: 'Nunito_900Black',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

// Escala tipográfica do CTX: topo 25/Nunito900, seção 21/Nunito900,
// card 16.5/Nunito900, body 13.5/Inter500, meta 12.5/Inter600.
export const typography = {
  fonts,
  variants: {
    display: { fontFamily: fonts.nunitoBlack, fontSize: 25, lineHeight: 31 },
    title: { fontFamily: fonts.nunitoBlack, fontSize: 21, lineHeight: 27 },
    cardTitle: { fontFamily: fonts.nunitoBlack, fontSize: 16.5, lineHeight: 22 },
    body: { fontFamily: fonts.interMedium, fontSize: 13.5, lineHeight: 19.5 },
    meta: { fontFamily: fonts.interSemiBold, fontSize: 12.5, lineHeight: 17 },
    small: { fontFamily: fonts.interSemiBold, fontSize: 11, lineHeight: 15 },
  },
} as const;

// Sombra padrão de card (mockup: 0 6px 18px rgba(42,35,80,.08)).
export const shadows = {
  card: {
    shadowColor: '#2A2350',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  /** Card escuro do céu na Hoje (mockup: 0 10px 24px rgba(29,24,64,.35)). */
  cardDark: {
    shadowColor: '#1D1840',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;
