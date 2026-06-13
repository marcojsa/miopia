// Testes das regras de gamificação (escudos, céu, semana).
// Rodar: npm run test:gamification (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  computeShields,
  computeSky,
  computeStreakAndMilestones,
  computeWeek,
  mondayOf,
  type GamificationLog,
} from '../gamification.ts';

const START = '2026-06-01';

/** Gera logs 'feito' para uma lista de dias do mês de junho/2026. */
function feitoOn(days: number[]): GamificationLog[] {
  return days.map((d) => ({
    log_date: `2026-06-${String(d).padStart(2, '0')}`,
    status: 'feito' as const,
  }));
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

test('sequência perfeita ganha escudo no dia 7', () => {
  // 6 noites completas: ainda sem escudo.
  const six = computeShields(feitoOn(range(1, 6)), [], '2026-06-07', START);
  assert.equal(six.available, 0);
  assert.equal(six.totalNights, 6);

  // 7ª noite completa: 1 escudo.
  const seven = computeShields(feitoOn(range(1, 7)), [], '2026-06-08', START);
  assert.equal(seven.available, 1);
  assert.equal(seven.totalNights, 7);
});

test('noite perdida consome escudo e vira estrela prateada', () => {
  // Dias 1-7 feitos (ganha 1 escudo), dia 8 sem registro, dias 9-10 feitos.
  const logs = feitoOn([...range(1, 7), 9, 10]);
  const shields = computeShields(logs, [], '2026-06-11', START);
  assert.equal(shields.available, 0); // escudo consumido no dia 8
  assert.equal(shields.totalNights, 9); // prateada não conta como completa

  const sky = computeSky(logs, [], '2026-06', START, '2026-06-11');
  assert.equal(sky[7].date, '2026-06-08');
  assert.equal(sky[7].state, 'silver');
  assert.equal(sky[6].state, 'gold');
  assert.equal(sky[8].state, 'gold');
});

test('noite perdida sem escudo vira vazia (neutra)', () => {
  // Dias 1-3 feitos (sem escudo ainda), dia 4 sem registro.
  const logs = feitoOn(range(1, 3));
  const sky = computeSky(logs, [], '2026-06', START, '2026-06-05');
  assert.equal(sky[3].date, '2026-06-04');
  assert.equal(sky[3].state, 'empty');

  const shields = computeShields(logs, [], '2026-06-05', START);
  assert.equal(shields.available, 0);
});

test('status pulado conta como noite perdida', () => {
  const logs: GamificationLog[] = [
    ...feitoOn(range(1, 7)),
    { log_date: '2026-06-08', status: 'pulado' },
  ];
  const sky = computeSky(logs, [], '2026-06', START, '2026-06-09');
  assert.equal(sky[7].state, 'silver'); // escudo do dia 7 salvou
  const shields = computeShields(logs, [], '2026-06-09', START);
  assert.equal(shields.available, 0);
});

test('férias vira nuvem e não conta nem quebra', () => {
  // Dias 1-6 feitos, 7-8 pausados, 9 feito (7ª noite completa -> escudo).
  const logs = feitoOn([...range(1, 6), 9]);
  const paused = ['2026-06-07', '2026-06-08'];

  const sky = computeSky(logs, paused, '2026-06', START, '2026-06-10');
  assert.equal(sky[6].state, 'cloud');
  assert.equal(sky[7].state, 'cloud');
  assert.equal(sky[8].state, 'gold');

  const shields = computeShields(logs, paused, '2026-06-10', START);
  assert.equal(shields.available, 1); // nada consumido nas nuvens
  assert.equal(shields.totalNights, 7); // pausa não conta como noite completa
});

test('máximo de 3 escudos guardados', () => {
  // 35 noites perfeitas dariam 5 escudos; guarda no máximo 3.
  const logs: GamificationLog[] = [];
  for (let i = 0; i < 35; i++) {
    logs.push({ log_date: addDays(START, i), status: 'feito' });
  }
  const shields = computeShields(logs, [], addDays(START, 35), START);
  assert.equal(shields.available, 3);
  assert.equal(shields.totalNights, 35);
});

test('marcos: total, próximo marco e quanto falta', () => {
  const m27 = computeStreakAndMilestones(feitoOn(range(1, 27)), [], '2026-06-28', START);
  assert.equal(m27.totalCompleteNights, 27);
  assert.equal(m27.nextMilestone, 30);
  assert.equal(m27.nightsToNextMilestone, 3);

  const m5 = computeStreakAndMilestones(feitoOn(range(1, 5)), [], '2026-06-06', START);
  assert.equal(m5.nextMilestone, 7);
  assert.equal(m5.nightsToNextMilestone, 2);
});

test('céu marca future, before_start e hoje pendente', () => {
  const sky = computeSky(feitoOn([10, 11]), [], '2026-06', '2026-06-10', '2026-06-12');
  assert.equal(sky[8].state, 'before_start'); // 09/06, antes do starts_on
  assert.equal(sky[9].state, 'gold'); // 10/06
  assert.equal(sky[11].state, 'future'); // 12/06 = hoje sem registro (pendente)
  assert.equal(sky[12].state, 'future'); // 13/06
  assert.equal(sky.length, 30); // junho tem 30 dias
});

test('meta semanal 5 de 7: semana seg -> dom', () => {
  // 2026-06-12 é sexta; semana = seg 08/06 a dom 14/06.
  assert.equal(mondayOf('2026-06-12'), '2026-06-08');

  // seg-sex feitas (5 noites) -> meta batida na sexta à noite.
  const five = computeWeek(feitoOn(range(8, 12)), [], '2026-06-12', '2026-06-08');
  assert.equal(five.days.length, 7);
  assert.equal(five.days[0].date, '2026-06-08');
  assert.equal(five.days[6].date, '2026-06-14');
  assert.equal(five.completedNights, 5);
  assert.equal(five.metFiveOfSeven, true);
  assert.equal(five.days[4].state, 'gold'); // sexta (hoje) já completa
  assert.equal(five.days[5].state, 'future');

  // seg-qui feitas, sexta (hoje) pendente -> 4 noites, meta ainda não.
  const four = computeWeek(feitoOn(range(8, 11)), [], '2026-06-12', '2026-06-08');
  assert.equal(four.completedNights, 4);
  assert.equal(four.metFiveOfSeven, false);
  assert.equal(four.days[4].state, 'today_pending');
});

test('prateada conta para a meta semanal (escudo salva a noite)', () => {
  // Histórico desde 01/06: dias 1-7 feitos (escudo), seg 08 perdida (vira
  // prateada), ter-sex 09-12 feitas -> 5 de 7 na semana.
  const logs = feitoOn([...range(1, 7), ...range(9, 12)]);
  const week = computeWeek(logs, [], '2026-06-12', START);
  assert.equal(week.days[0].state, 'silver');
  assert.equal(week.completedNights, 5);
  assert.equal(week.metFiveOfSeven, true);
});
