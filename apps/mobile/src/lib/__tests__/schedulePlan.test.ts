// Testes do plano de lembretes locais (dias da semana, janela, botões da manhã).
// Rodar: npm run test:lembretes (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AdherenceLog, ChildScheduleInput, ReminderSchedule } from '../../types/domain.ts';
import { upsertLocal } from '../adherenceCache.ts';
import { buildDesired, notifId, parseNotifId } from '../notifications/schedulePlan.ts';

const TODOS: ReminderSchedule = { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startsOn: '2026-01-01', endsOn: null };

function alice(schedule: ReminderSchedule, hour = 20, minute = 30): ChildScheduleInput {
  return {
    childId: 'alice',
    firstName: 'Alice',
    remindersPaused: false,
    atropina: { treatmentId: 't-atr', time: { hour, minute }, schedule },
  };
}

function pedro(schedule: ReminderSchedule): ChildScheduleInput {
  return {
    childId: 'pedro',
    firstName: 'Pedro',
    remindersPaused: false,
    orthok: {
      treatmentId: 't-ok',
      onTime: { hour: 21, minute: 15 },
      offTime: { hour: 7, minute: 0 },
      schedule,
    },
  };
}

test('prescrição de todos os dias vira um lembrete diário por tipo', () => {
  const plan = buildDesired([alice(TODOS)], '2026-10-05');
  assert.deepEqual([...plan.keys()], ['alice:atropina']);
  assert.equal(plan.get('alice:atropina')?.weekday, null);
});

test('days_of_week restrito vira um lembrete semanal só nos dias prescritos', () => {
  const plan = buildDesired([alice({ ...TODOS, daysOfWeek: [1, 2, 3, 4, 5] })], '2026-10-05');
  assert.deepEqual(
    [...plan.values()].map((d) => d.weekday).sort(),
    [1, 2, 3, 4, 5]
  );
  assert.ok(!plan.has('alice:atropina:0'));
  assert.ok(!plan.has('alice:atropina:6'));
});

test('retirada da lente cai na manhã seguinte à noite prescrita', () => {
  const plan = buildDesired([pedro({ ...TODOS, daysOfWeek: [5] })], '2026-10-05');
  assert.equal(plan.get('pedro:orthok_on:5')?.weekday, 5);
  assert.equal(plan.get('pedro:orthok_off:6')?.weekday, 6);
});

test('lembrete de madrugada (antes das 04h) dispara no dia seguinte à noite', () => {
  const plan = buildDesired([alice({ ...TODOS, daysOfWeek: [6] }, 0, 30)], '2026-10-05');
  assert.ok(plan.has('alice:atropina:0'));
});

test('tratamento encerrado ou que ainda não começou não agenda nada', () => {
  assert.equal(buildDesired([alice({ ...TODOS, endsOn: '2026-10-04' })], '2026-10-05').size, 0);
  assert.equal(buildDesired([alice({ ...TODOS, startsOn: '2026-10-06' })], '2026-10-05').size, 0);
  assert.equal(buildDesired([alice({ ...TODOS, endsOn: '2026-10-05' })], '2026-10-05').size, 1);
});

test('só os lembretes da noite levam os botões Feito/Pular', () => {
  const plan = buildDesired([pedro(TODOS)], '2026-10-05');
  assert.equal(plan.get('pedro:orthok_on')?.withCheckinActions, true);
  assert.equal(plan.get('pedro:orthok_off')?.withCheckinActions, false);
});

test('filho em pausa não tem lembrete', () => {
  assert.equal(buildDesired([{ ...alice(TODOS), remindersPaused: true }], '2026-10-05').size, 0);
});

test('parseNotifId aceita o id diário e o semanal', () => {
  assert.deepEqual(parseNotifId(notifId('c1', 'orthok_on')), { childId: 'c1', type: 'orthok_on' });
  assert.deepEqual(parseNotifId(notifId('c1', 'atropina', 3)), { childId: 'c1', type: 'atropina' });
  assert.equal(parseNotifId('c1:outro'), null);
});

test('check-in pela notificação substitui a resposta da mesma noite no cache', () => {
  const log = (id: string, status: 'feito' | 'pulado'): AdherenceLog => ({
    id,
    treatment_id: 't-atr',
    child_id: 'alice',
    log_date: '2026-10-05',
    status,
    note: null,
    logged_by: 'u1',
    created_at: '2026-10-05T23:30:00.000Z',
  });
  assert.deepEqual(upsertLocal(undefined, log('a', 'feito')), [log('a', 'feito')]);
  assert.deepEqual(upsertLocal([log('a', 'pulado')], log('b', 'feito')), [log('b', 'feito')]);
});
