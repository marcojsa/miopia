// Testes do plano de lembretes locais (dias da semana, janela, botões da manhã).
// Rodar: npm run test:lembretes (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AdherenceLog, Child, ChildScheduleInput, ReminderSchedule, Treatment } from '../../types/domain.ts';
import { buildFamilySchedule } from '../../components/familia/familiaHelpers.ts';
import { upsertLocal } from '../adherenceCache.ts';
import {
  IOS_SCHEDULE_LIMIT,
  buildDesired,
  capSchedule,
  notifId,
  parseNotifId,
} from '../notifications/schedulePlan.ts';

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
    dose: 1,
    status,
    note: null,
    logged_by: 'u1',
    created_at: '2026-10-05T23:30:00.000Z',
  });
  assert.deepEqual(upsertLocal(undefined, log('a', 'feito')), [log('a', 'feito')]);
  assert.deepEqual(upsertLocal([log('a', 'pulado')], log('b', 'feito')), [log('b', 'feito')]);
  const dose2 = { ...log('c', 'feito'), dose: 2 };
  assert.equal(upsertLocal([log('a', 'feito')], dose2).length, 2);
});

const BASE_T: Treatment = {
  id: 't',
  child_id: 'alice',
  type: 'atropina',
  name: null,
  times_per_day: 1,
  instructions: null,
  suggested_time: '20:30:00',
  days_of_week: [],
  starts_on: '2026-01-01',
  ends_on: null,
  active: true,
};
const CHILD = (id: string, first_name: string): Child => ({
  id,
  family_id: 'f1',
  first_name,
  birth_date: '2018-01-01',
  avatar_key: null,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
});

test('colírio 4x/dia: um lembrete por dose nos horários da rotina', () => {
  const colirio: Treatment = { ...BASE_T, id: 'col', type: 'colirio', name: 'Lubrificante', times_per_day: 4, suggested_time: null };
  const input = buildFamilySchedule([CHILD('alice', 'Alice')], [BASE_T, colirio], [], new Set());
  const plan = buildDesired(input, '2026-10-05');
  const doses = [...plan.entries()].filter(([, d]) => d.type === 'colirio');
  assert.deepEqual(
    doses.map(([, d]) => `${d.dose}@${d.hour}:${d.minute}`),
    ['1@7:0', '2@11:40', '3@16:20', '4@21:0']
  );
  assert.ok(plan.has('alice:colirio:col:2'));
  assert.ok(plan.has('alice:atropina'));
  const second = plan.get('alice:colirio:col:2');
  assert.equal(second?.title, 'Hora do colírio — Alice');
  assert.equal(second?.body, 'Lubrificante: 2ª de 4');
  assert.equal(second?.withCheckinActions, true);
  for (const [, d] of plan) assert.ok(!/miopia/i.test(`${d.title} ${d.body}`));
});

test('rotina salva muda os horários das doses', () => {
  const colirio: Treatment = { ...BASE_T, id: 'col', type: 'colirio', name: 'X', times_per_day: 2 };
  const routines = [{ guardian_user_id: 'u1', child_id: 'alice', wake_time: '06:30:00', bed_time: '20:00:00' }];
  const plan = buildDesired(buildFamilySchedule([CHILD('alice', 'Alice')], [colirio], [], new Set(), routines), '2026-10-05');
  assert.deepEqual([...plan.values()].map((d) => `${d.hour}:${d.minute}`), ['6:30', '20:0']);
});

test('lente de contato: colocar ao acordar (só lembra) e tirar ao dormir (registra)', () => {
  const lente: Treatment = { ...BASE_T, id: 'len', child_id: 'pedro', type: 'lente_contato', suggested_time: null };
  const plan = buildDesired(buildFamilySchedule([CHILD('pedro', 'Pedro')], [lente], [], new Set()), '2026-10-05');
  const on = plan.get('pedro:lente_on:len:1');
  const off = plan.get('pedro:lente_off:len:1');
  assert.equal(on?.title, 'Colocar a lente — Pedro');
  assert.equal(on?.withCheckinActions, false);
  assert.equal(`${on?.hour}:${on?.minute}`, '7:0');
  assert.equal(off?.title, 'Tirar a lente — Pedro');
  assert.equal(off?.withCheckinActions, true);
  assert.equal(`${off?.hour}:${off?.minute}`, '21:0');
});

test('ids por dose: parse e compatibilidade com os antigos', () => {
  const id = notifId('c1', 'colirio', 3, { treatmentId: 'tid-1', dose: 2 });
  assert.equal(id, 'c1:colirio:tid-1:2:3');
  assert.deepEqual(parseNotifId(id), { childId: 'c1', type: 'colirio', treatmentId: 'tid-1', dose: 2 });
  assert.deepEqual(parseNotifId('c1:lente_off:tid-1:1'), {
    childId: 'c1',
    type: 'lente_off',
    treatmentId: 'tid-1',
    dose: 1,
  });
  assert.deepEqual(parseNotifId('c1:atropina'), { childId: 'c1', type: 'atropina' });
  assert.equal(notifId('c1', 'atropina', null, { treatmentId: 't', dose: 1 }), 'c1:atropina');
});

test('acima de 60 lembretes, corta priorizando os que registram e as primeiras doses', () => {
  const restricted: ReminderSchedule = { ...TODOS, daysOfWeek: [1, 2, 3, 4, 5, 6] };
  const children: ChildScheduleInput[] = ['a', 'b', 'c'].map((id) => ({
    childId: id,
    firstName: id,
    remindersPaused: false,
    doses: [1, 2, 3, 4].map((dose) => ({
      treatmentId: `t-${id}`,
      type: 'colirio' as const,
      dose,
      total: 4,
      label: 'Colírio',
      time: { hour: 7 + dose, minute: 0 },
      schedule: restricted,
      withCheckinActions: true,
    })),
    orthok: { treatmentId: `o-${id}`, onTime: { hour: 21, minute: 0 }, offTime: { hour: 7, minute: 0 }, schedule: restricted },
  }));
  const plan = buildDesired(children, '2026-10-05');
  assert.equal(plan.size, 3 * 6 * 6);
  const { kept, dropped } = capSchedule(plan, IOS_SCHEDULE_LIMIT);
  assert.equal(kept.size, 60);
  assert.equal(dropped.length, plan.size - 60);
  for (const d of kept.values()) assert.equal(d.withCheckinActions, true);
  // 36 de dose 1 (colírio + ortho-k), 18 de dose 2 e 6 de dose 3; dose 4 fica de fora.
  assert.equal([...kept.values()].filter((d) => d.dose <= 2).length, 54);
  assert.ok([...kept.values()].every((d) => d.dose <= 3));
  assert.equal(capSchedule(buildDesired([alice(TODOS)], '2026-10-05')).dropped.length, 0);
});
