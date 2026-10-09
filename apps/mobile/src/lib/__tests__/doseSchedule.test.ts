// Testes da rotina da criança e da distribuição das doses do dia.
// Rodar: node --test src/lib/__tests__/doseSchedule.test.ts (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  colirioName,
  doseLabel,
  doseTimes,
  outsideRoutine,
  routineError,
  routineFor,
  sameColirio,
  toMinutes,
  usesRoutine,
} from '../doseSchedule.ts';

test('exemplo da especificação: 07:00–21:00, 4 doses', () => {
  assert.deepEqual(doseTimes('07:00', '21:00', 4), ['07:00', '11:40', '16:20', '21:00']);
});

test('1 dose cai na hora de dormir', () => {
  assert.deepEqual(doseTimes('07:00', '21:00', 1), ['21:00']);
});

test('2 doses: ao acordar e ao dormir', () => {
  assert.deepEqual(doseTimes('06:30', '20:30', 2), ['06:30', '20:30']);
});

test('doses do meio arredondam para múltiplos de 5 minutos', () => {
  const times = doseTimes('07:00', '21:00', 6);
  assert.deepEqual(times, ['07:00', '09:50', '12:35', '15:25', '18:10', '21:00']);
  for (const t of times.slice(1, -1)) assert.equal((toMinutes(t) as number) % 5, 0, t);
});

test('nunca fora do intervalo acordar–dormir, mesmo com rotina curta', () => {
  const times = doseTimes('07:02', '07:08', 6);
  assert.equal(times[0], '07:02');
  assert.equal(times[times.length - 1], '07:08');
  for (const t of times) {
    const m = toMinutes(t) as number;
    assert.ok(m >= 7 * 60 + 2 && m <= 7 * 60 + 8, t);
  }
});

test('rotina inválida cai no padrão 07:00–21:00', () => {
  assert.deepEqual(doseTimes('22:00', '07:00', 4), ['07:00', '11:40', '16:20', '21:00']);
});

test('aceita HH:MM:SS do banco', () => {
  assert.deepEqual(doseTimes('07:00:00', '21:00:00', 3), ['07:00', '14:00', '21:00']);
});

test('validação da rotina com mensagens em português', () => {
  assert.equal(routineError('07:00', '21:00'), null);
  assert.equal(routineError('21:00', '21:00'), 'A hora de dormir precisa ser depois da hora de acordar.');
  assert.equal(routineError('22:00', '07:00'), 'A hora de dormir precisa ser depois da hora de acordar.');
});

test('sem linha de rotina, o padrão é 07:00–21:00', () => {
  assert.deepEqual(routineFor([], 'c1'), { wake: '07:00', bed: '21:00' });
  assert.deepEqual(
    routineFor([{ child_id: 'c1', wake_time: '06:30:00', bed_time: '20:45:00' }], 'c1'),
    { wake: '06:30', bed: '20:45' }
  );
});

test('quem segue a rotina: colírio de várias doses e lente de contato', () => {
  assert.equal(usesRoutine({ type: 'colirio', times_per_day: 4 }), true);
  assert.equal(usesRoutine({ type: 'colirio', times_per_day: 1 }), false);
  assert.equal(usesRoutine({ type: 'lente_contato', times_per_day: 1 }), true);
  assert.equal(usesRoutine({ type: 'atropina', times_per_day: 1 }), false);
});

test('rótulos', () => {
  assert.equal(doseLabel(2, 4), '2ª de 4');
  assert.equal(colirioName('  Lubrificante '), 'Lubrificante');
  assert.equal(colirioName(null), 'Colírio');
  assert.equal(sameColirio('Lubrificante', ' lubrificante'), true);
});

test('horário fora da rotina (aviso de lembrete no sono)', () => {
  const routine = { wake: '07:00', bed: '20:00' };
  assert.equal(outsideRoutine('20:30', routine), 'depois');
  assert.equal(outsideRoutine('06:30', routine), 'antes');
  assert.equal(outsideRoutine('20:00', routine), null);
  assert.equal(outsideRoutine('07:00', routine), null);
  assert.equal(outsideRoutine('inválido', routine), null);
});
