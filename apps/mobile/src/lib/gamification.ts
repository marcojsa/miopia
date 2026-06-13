// Gamificação do céu noturno — FUNÇÕES PURAS (testáveis com node --test).
//
// REGRAS (docs/design-produto.md §streak perdoador + CTX):
// - 1 noite completa (todos os check-ins da noite com status 'feito') = estrela
//   dourada. Noite perdida coberta por escudo = estrela prateada. Data pausada
//   (férias/pausa clínica) = nuvem: não conta nem quebra. Sem registro e sem
//   escudo = vazia (estado NEUTRO, nunca "falha").
// - Escudos: a família ganha 1 a cada 7 noites completas (acumuladas), máximo
//   3 guardados; uma noite perdida consome 1 automaticamente (perdão).
// - A simulação é CRONOLÓGICA, de starts_on até ontem; a noite de HOJE só
//   conta se já estiver completa (nunca conta como perdida — ainda não acabou).
// - Marcos de ADESÃO (nunca resultado clínico): 7 noites (primeira
//   constelação), 30 (Constelação da Coruja), 90 (Diploma do Cuidado).
// - Meta semanal: 5 de 7 noites (douradas + prateadas contam; o escudo salva a
//   noite de verdade, sem tom de fracasso).
//
// ANVISA RDC 657/2022: este módulo só agrega RELATO DE ADESÃO da família.
// Nenhum dado clínico entra ou sai daqui.
import type { AdherenceLog } from '../types/domain.ts';
import { formatLocalYMD, localDateString } from './date.ts';

/** Subconjunto de AdherenceLog que a gamificação usa (facilita testes). */
export type GamificationLog = Pick<AdherenceLog, 'log_date' | 'status'>;

export type SkyDayState = 'gold' | 'silver' | 'cloud' | 'empty' | 'future' | 'before_start';

export interface SkyDay {
  /** Data lógica da noite, 'YYYY-MM-DD'. */
  date: string;
  state: SkyDayState;
}

export interface ShieldsResult {
  /** Escudos guardados hoje (0..3). */
  available: number;
  /** Total de noites completas desde o início (inclui hoje se já completa). */
  totalNights: number;
}

export interface MilestonesResult {
  totalCompleteNights: number;
  /** Próximo marco de adesão; null quando os 90 já foram alcançados. */
  nextMilestone: 7 | 30 | 90 | null;
  /** Noites completas que faltam para o próximo marco (0 se nextMilestone for null). */
  nightsToNextMilestone: number;
}

export type WeekDayState = 'gold' | 'silver' | 'cloud' | 'empty' | 'today_pending' | 'future';

export interface WeekDay {
  date: string;
  state: WeekDayState;
}

export interface WeekResult {
  /** 7 entradas, segunda -> domingo, da semana que contém `today`. */
  days: WeekDay[];
  /** Noites que contam para a meta na semana (douradas + prateadas). */
  completedNights: number;
  /** Meta semanal: 5 de 7 noites. */
  metFiveOfSeven: boolean;
}

const MILESTONES: ReadonlyArray<7 | 30 | 90> = [7, 30, 90];
const MAX_SHIELDS = 3;
const NIGHTS_PER_SHIELD = 7;
// Trava de segurança da caminhada cronológica (~5 anos); entradas malformadas
// não podem travar a UI.
const MAX_SIMULATED_NIGHTS = 1830;

// ── Helpers de data (locais; 'YYYY-MM-DD' compara bem como string) ───────────

/** Soma `n` dias a uma data 'YYYY-MM-DD' usando componentes locais. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return formatLocalYMD(new Date(y, m - 1, d + n));
}

/** Segunda-feira da semana que contém a data (semana seg -> dom). */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = domingo
  return addDays(ymd, -((dow + 6) % 7));
}

function daysInMonth(monthYM: string): number {
  const [y, m] = monthYM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ── Núcleo: simulação cronológica de noites e escudos ────────────────────────

type NightOutcome = 'complete' | 'saved' | 'missed' | 'paused';

interface Simulation {
  /** Resultado por data lógica (de startsOn até hoje, inclusive se relevante). */
  nights: Map<string, NightOutcome>;
  shieldsAvailable: number;
  totalCompleteNights: number;
}

/**
 * Indexa os logs por data: a noite é COMPLETA quando existe >= 1 registro e
 * todos têm status 'feito'. Um 'pulado' na noite (ou ausência total de
 * registro) torna a noite perdida — candidata a escudo.
 * Obs.: os logs são por tratamento; passe os logs de UMA criança. Se a família
 * registrou só um dos tratamentos da noite, a noite conta como completa pelo
 * que foi relatado (o app não infere o que "deveria" ter sido feito).
 */
function indexCompleteByDate(logs: GamificationLog[]): Map<string, boolean> {
  const byDate = new Map<string, boolean>();
  for (const log of logs) {
    const prev = byDate.get(log.log_date);
    const isFeito = log.status === 'feito';
    byDate.set(log.log_date, prev === undefined ? isFeito : prev && isFeito);
  }
  return byDate;
}

/**
 * Caminha cronologicamente de `startsOn` até ONTEM aplicando as regras de
 * escudo; depois soma a noite de HOJE apenas se já completa (hoje nunca
 * consome escudo: a noite ainda não terminou).
 */
function simulateNights(
  logs: GamificationLog[],
  pausedDates: string[],
  startsOn: string,
  today: string
): Simulation {
  const completeByDate = indexCompleteByDate(logs);
  const paused = new Set(pausedDates);
  const nights = new Map<string, NightOutcome>();

  let shields = 0;
  let total = 0;
  let steps = 0;

  for (let date = startsOn; date < today && steps < MAX_SIMULATED_NIGHTS; date = addDays(date, 1)) {
    steps++;
    if (paused.has(date)) {
      nights.set(date, 'paused'); // nuvem: não conta nem quebra
      continue;
    }
    if (completeByDate.get(date) === true) {
      total++;
      if (total % NIGHTS_PER_SHIELD === 0 && shields < MAX_SHIELDS) shields++;
      nights.set(date, 'complete');
    } else if (shields > 0) {
      shields--;
      nights.set(date, 'saved'); // estrela prateada
    } else {
      nights.set(date, 'missed'); // vazia (neutro)
    }
  }

  // Hoje: conta se já completa; pausada vira nuvem; pendente fica fora do mapa.
  if (today >= startsOn) {
    if (paused.has(today)) {
      nights.set(today, 'paused');
    } else if (completeByDate.get(today) === true) {
      total++;
      if (total % NIGHTS_PER_SHIELD === 0 && shields < MAX_SHIELDS) shields++;
      nights.set(today, 'complete');
    }
  }

  return { nights, shieldsAvailable: shields, totalCompleteNights: total };
}

/** Fallback de starts_on quando o chamador não tem o tratamento à mão. */
function inferStartsOn(logs: GamificationLog[], pausedDates: string[], today: string): string {
  let min: string | null = null;
  for (const l of logs) if (min === null || l.log_date < min) min = l.log_date;
  for (const d of pausedDates) if (min === null || d < min) min = d;
  return min ?? today;
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Céu do mês para a tela Céu: uma entrada por dia de `monthYM` ('YYYY-MM').
 * Estados: gold (noite completa) · silver (salva por escudo) · cloud (pausa) ·
 * empty (sem registro e sem escudo) · future (depois de hoje, OU a noite de
 * hoje ainda pendente — a tela detecta date === hoje e desenha a estrela
 * tracejada "hoje") · before_start (antes de treatment.starts_on).
 *
 * @param logs Logs de adesão de UMA criança (>= período desde starts_on; use useAdherenceLogs).
 * @param pausedDates Datas 'YYYY-MM-DD' em modo férias/pausa (usePausedDates).
 * @param monthYM Mês exibido, 'YYYY-MM'.
 * @param treatmentStartsOn treatment.starts_on ('YYYY-MM-DD').
 * @param today Data lógica de hoje (corte 04h); padrão localDateString().
 */
export function computeSky(
  logs: GamificationLog[],
  pausedDates: string[],
  monthYM: string,
  treatmentStartsOn: string,
  today: string = localDateString()
): SkyDay[] {
  const sim = simulateNights(logs, pausedDates, treatmentStartsOn, today);
  const total = daysInMonth(monthYM);
  const days: SkyDay[] = [];

  for (let d = 1; d <= total; d++) {
    const date = `${monthYM}-${String(d).padStart(2, '0')}`;
    let state: SkyDayState;
    if (date < treatmentStartsOn) {
      state = 'before_start';
    } else if (date > today) {
      state = 'future';
    } else {
      switch (sim.nights.get(date)) {
        case 'complete':
          state = 'gold';
          break;
        case 'saved':
          state = 'silver';
          break;
        case 'paused':
          state = 'cloud';
          break;
        case 'missed':
          state = 'empty';
          break;
        default:
          // Só acontece para a noite de HOJE ainda pendente.
          state = 'future';
      }
    }
    days.push({ date, state });
  }
  return days;
}

/**
 * Escudos guardados e total de noites completas (para "27 noites de cuidado ·
 * 2 escudos guardados" e a fileira de escudos do Céu).
 *
 * @param startsOn treatment.starts_on; sem ele, infere da data mais antiga
 *   conhecida (logs/pausas) — passe sempre que possível para que noites sem
 *   registro no começo do tratamento contem como perdidas, igual ao céu.
 */
export function computeShields(
  logs: GamificationLog[],
  pausedDates: string[],
  today: string = localDateString(),
  startsOn?: string
): ShieldsResult {
  const from = startsOn ?? inferStartsOn(logs, pausedDates, today);
  const sim = simulateNights(logs, pausedDates, from, today);
  return { available: sim.shieldsAvailable, totalNights: sim.totalCompleteNights };
}

/**
 * Total de noites completas + próximo marco de adesão (7/30/90) e quanto falta.
 * Marcos celebram ADESÃO, nunca resultado clínico (regra dura do produto).
 */
export function computeStreakAndMilestones(
  logs: GamificationLog[],
  pausedDates: string[],
  today: string = localDateString(),
  startsOn?: string
): MilestonesResult {
  const { totalNights } = computeShields(logs, pausedDates, today, startsOn);
  const next = MILESTONES.find((m) => totalNights < m) ?? null;
  return {
    totalCompleteNights: totalNights,
    nextMilestone: next,
    nightsToNextMilestone: next === null ? 0 : next - totalNights,
  };
}

/**
 * Semana atual (segunda -> domingo) para o card "Meta da semana" da Hoje.
 * Estados: gold/silver/cloud/empty como no céu; today_pending = hoje sem noite
 * completa ainda; future = dias depois de hoje. Dias anteriores a starts_on
 * aparecem como empty (neutro).
 * Meta 5 de 7: douradas + prateadas contam (o escudo salva a noite de verdade).
 */
export function computeWeek(
  logs: GamificationLog[],
  pausedDates: string[],
  today: string = localDateString(),
  startsOn?: string
): WeekResult {
  const from = startsOn ?? inferStartsOn(logs, pausedDates, today);
  const sim = simulateNights(logs, pausedDates, from, today);
  const monday = mondayOf(today);

  const days: WeekDay[] = [];
  let completed = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    let state: WeekDayState;
    if (date > today) {
      state = 'future';
    } else {
      switch (sim.nights.get(date)) {
        case 'complete':
          state = 'gold';
          break;
        case 'saved':
          state = 'silver';
          break;
        case 'paused':
          state = 'cloud';
          break;
        case 'missed':
          state = 'empty';
          break;
        default:
          state = date === today ? 'today_pending' : 'empty';
      }
    }
    if (state === 'gold' || state === 'silver') completed++;
    days.push({ date, state });
  }

  return { days, completedNights: completed, metFiveOfSeven: completed >= 5 };
}
