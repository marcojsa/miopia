// Posicionamento determinístico das estrelas do Céu (modo criança).
// PURO (sem React/RN): dado o estado do mês (computeSky) devolve as coordenadas
// de cada noite dentro do canvas ~390x318 do mockup ceu.html, de forma estável
// (mesmo dia -> mesma posição, sempre) e agradável (espalhadas, sem colisão).
//
// REGRA DURA (ANVISA/LGPD): nada aqui calcula ou interpreta dado clínico — só
// arranja visualmente as noites de ADESÃO já decididas por lib/gamification.ts.
import type { SkyDay } from '@/lib/gamification';

/** Tamanho lógico do canvas SVG do céu (o componente escala por viewBox). */
export const SKY_W = 390;
export const SKY_H = 318;

// Caixa onde as estrelas podem cair (deixa respiro p/ a lua no canto sup. esq.
// e margem nas bordas). Coordenadas em unidades do viewBox.
const BOX = { left: 40, right: 358, top: 64, bottom: 286 } as const;

/** Estado visual da estrela já resolvido para o desenho. */
export type SkyMarkKind = 'gold' | 'silver' | 'cloud' | 'empty' | 'today';

export interface SkyMark {
  /** Dia do mês (1..31). */
  day: number;
  /** Data lógica 'YYYY-MM-DD'. */
  date: string;
  kind: SkyMarkKind;
  /** Centro no viewBox do canvas. */
  cx: number;
  cy: number;
}

// Hash determinístico djb2 — mesma família usada no ChildAvatar (estável por seed).
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  return h >>> 0;
}

// PRNG simples (mulberry32) semeado pelo dia: posições "aleatórias" porém fixas.
function rngFor(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distribui os dias VISÍVEIS do mês numa grade jittered (5 colunas) para
 * espalhar as estrelas de forma agradável e determinística. Dias futuros
 * (depois de hoje, exceto a noite de hoje) NÃO entram — o céu mostra só o
 * caminho já percorrido + a estrela tracejada de hoje.
 *
 * @param days saída de computeSky(...) para o mês exibido.
 * @param today data lógica 'YYYY-MM-DD' (para marcar a estrela "hoje").
 */
export function layoutSky(days: SkyDay[], today: string): SkyMark[] {
  // Visível = tudo que não é puro futuro/antes-do-início, MAIS a noite de hoje
  // (que vem como 'future' em computeSky, mas a tela desenha tracejada).
  const visible = days.filter(
    (d) => d.state !== 'before_start' && (d.state !== 'future' || d.date === today)
  );

  const cols = 5;
  const cellW = (BOX.right - BOX.left) / cols;
  const rows = Math.max(1, Math.ceil(visible.length / cols));
  const cellH = (BOX.bottom - BOX.top) / rows;

  return visible.map((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rnd = rngFor(d.date);
    // Jitter dentro da célula (margem de 18% p/ não encostar nas vizinhas).
    const jx = 0.18 + rnd() * 0.64;
    const jy = 0.18 + rnd() * 0.64;
    const cx = BOX.left + col * cellW + jx * cellW;
    const cy = BOX.top + row * cellH + jy * cellH;
    const day = Number(d.date.slice(8, 10));
    const kind: SkyMarkKind = d.date === today && d.state === 'future' ? 'today' : (d.state as SkyMarkKind);
    return { day, date: d.date, kind, cx, cy };
  });
}

/**
 * Pontos da linha de constelação em progresso (tracejada branca): conecta, em
 * ordem cronológica, as noites JÁ ACESAS (gold + silver). Não inclui nuvens,
 * vazias nem a estrela de hoje (que ainda não foi conquistada).
 */
export function constellationPoints(marks: SkyMark[]): string {
  return marks
    .filter((m) => m.kind === 'gold' || m.kind === 'silver')
    .map((m) => `${m.cx.toFixed(1)},${m.cy.toFixed(1)}`)
    .join(' ');
}
