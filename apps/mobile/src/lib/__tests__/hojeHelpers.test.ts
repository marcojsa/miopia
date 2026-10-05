// Testes dos helpers puros da aba Hoje.
// Rodar: node --test src/lib/__tests__/hojeHelpers.test.ts (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isScheduledOn, isScheduledToday, taskTitle } from '../../components/hoje/hojeHelpers.ts';
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
