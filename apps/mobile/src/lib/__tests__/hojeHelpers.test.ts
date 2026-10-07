// Testes dos helpers puros da aba Hoje.
// Rodar: node --test src/lib/__tests__/hojeHelpers.test.ts (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dueCareCount,
  isScheduledOn,
  isScheduledToday,
  isScheduledTonight,
  taskTitle,
  wasScheduledOn,
} from '../../components/hoje/hojeHelpers.ts';
import { computeSky } from '../gamification.ts';
import { localDateString, weekdayOfYMD } from '../date.ts';
import type { Treatment } from '../../types/domain.ts';

const DIAS_UTEIS: Treatment = {
  id: 't1',
  child_id: 'c1',
  type: 'atropina',
  instructions: null,
  suggested_time: '21:00:00',
  days_of_week: [1, 2, 3, 4, 5],
  starts_on: '2026-09-01',
  ends_on: null,
  active: true,
};

test('regime seg-sex aparece na madrugada de sábado (noite lógica de sexta)', () => {
  const madrugadaSabado = new Date(2026, 9, 3, 0, 40);
  const today = localDateString(madrugadaSabado);
  assert.equal(today, '2026-10-02');
  assert.equal(isScheduledToday(DIAS_UTEIS, today, weekdayOfYMD(today)), true);
});

test('regime seg-sex não aparece na madrugada de segunda (noite lógica de domingo)', () => {
  const madrugadaSegunda = new Date(2026, 9, 5, 1, 0);
  const today = localDateString(madrugadaSegunda);
  assert.equal(today, '2026-10-04');
  assert.equal(isScheduledToday(DIAS_UTEIS, today, weekdayOfYMD(today)), false);
});

test('títulos dos cards não assumem gênero', () => {
  assert.equal(taskTitle('atropina', 'Pedro'), 'Hora do colírio de Pedro');
  assert.equal(taskTitle('ortho_k', 'Pedro'), 'Hora da lente de Pedro');
  assert.equal(taskTitle('oculos_lentes', 'Alice'), 'Cuidado de Alice');
});

test('isScheduledOn usa o dia da semana da própria data', () => {
  assert.equal(isScheduledOn(DIAS_UTEIS, '2026-10-02'), true); // sexta
  assert.equal(isScheduledOn(DIAS_UTEIS, '2026-10-03'), false); // sábado
  assert.equal(isScheduledOn({ ...DIAS_UTEIS, ends_on: '2026-10-01' }, '2026-10-02'), false);
});

// Troca de regime: o ortho-k antigo foi encerrado em 07/10 e o novo começa em 07/10.
const ORTHO_ANTIGO: Treatment = {
  id: 'ortho-antigo',
  child_id: 'c1',
  type: 'ortho_k',
  instructions: null,
  suggested_time: '21:00:00',
  days_of_week: [],
  starts_on: '2025-09-02',
  ends_on: '2026-10-07',
  active: false,
};
const ORTHO_NOVO: Treatment = {
  ...ORTHO_ANTIGO,
  id: 'ortho-novo',
  suggested_time: '21:45:00',
  starts_on: '2026-10-07',
  ends_on: null,
  active: true,
};
const ATROPINA_NOVA: Treatment = {
  ...ORTHO_NOVO,
  id: 'atropina-nova',
  type: 'atropina',
};

test('tratamento encerrado vale no histórico até a véspera do ends_on', () => {
  assert.equal(wasScheduledOn(ORTHO_ANTIGO, '2026-10-01'), true);
  assert.equal(wasScheduledOn(ORTHO_ANTIGO, '2026-10-06'), true);
  assert.equal(wasScheduledOn(ORTHO_ANTIGO, '2026-10-07'), false);
  assert.equal(wasScheduledOn({ ...ORTHO_NOVO, ends_on: '2026-10-10' }, '2026-10-10'), true);
});

test('noite da troca de regime conta um cuidado por tipo, sem dobrar', () => {
  const historico = [ORTHO_ANTIGO, ORTHO_NOVO, ATROPINA_NOVA];
  assert.equal(dueCareCount(historico, '2026-10-04'), 1);
  assert.equal(dueCareCount(historico, '2026-10-07'), 2);
  // Regime gravado com Início recuado (dado antigo): a noite de 06/10 segue com um só.
  const recuado = { ...ORTHO_NOVO, starts_on: '2026-10-06' };
  assert.equal(dueCareCount([ORTHO_ANTIGO, recuado], '2026-10-06'), 1);
});

test('noites perdidas antes da troca de regime continuam no céu', () => {
  const historico = [ORTHO_ANTIGO, ORTHO_NOVO, ATROPINA_NOVA];
  const logs = [
    { log_date: '2026-10-03', status: 'feito' as const },
    { log_date: '2026-10-05', status: 'feito' as const },
  ];
  const sky = computeSky(
    logs,
    [],
    '2026-10',
    '2025-09-02',
    '2026-10-07',
    (d) => dueCareCount(historico, d) > 0,
    (d) => dueCareCount(historico, d)
  );
  const estado = (d: string) => sky.find((x) => x.date === d)?.state;
  assert.equal(estado('2026-10-03'), 'gold');
  assert.equal(estado('2026-10-05'), 'gold');
  for (const d of ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-06']) {
    assert.notEqual(estado(d), 'off', d);
    assert.notEqual(estado(d), 'gold', d);
  }
});

test('troca de madrugada: o regime novo cobre a noite em curso', () => {
  const historico = [ORTHO_ANTIGO, ORTHO_NOVO];
  // 01h de 07/10: a noite em curso ainda é a de 06/10.
  assert.equal(isScheduledTonight(ORTHO_NOVO, historico, '2026-10-06', '2026-10-07'), true);
  // Primeiro cadastro de madrugada, sem regime anterior: começa no dia digitado.
  assert.equal(isScheduledTonight(ORTHO_NOVO, [ORTHO_NOVO], '2026-10-06', '2026-10-07'), false);
  // Início futuro não antecipa.
  const futuro = { ...ORTHO_NOVO, starts_on: '2026-10-08' };
  assert.equal(isScheduledTonight(futuro, [ORTHO_ANTIGO, futuro], '2026-10-06', '2026-10-07'), false);
  // Troca às 15h: noite em curso = dia do calendário.
  assert.equal(isScheduledTonight(ORTHO_NOVO, historico, '2026-10-07', '2026-10-07'), true);
});
