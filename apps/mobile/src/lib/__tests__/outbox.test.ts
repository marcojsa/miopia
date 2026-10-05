// Testes das regras puras do outbox de check-ins.
// Rodar: npm run test:outbox (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PendingCheckin } from '../../types/domain.ts';
import {
  createSerialRunner,
  isPermanentRejection,
  removeResolved,
  replaceInQueue,
  splitExpired,
} from '../outboxCore.ts';

function item(client_id: string, treatment_id: string, log_date = '2026-10-05'): PendingCheckin {
  return {
    client_id,
    treatment_id,
    child_id: 'c1',
    log_date,
    status: 'feito',
    note: null,
    logged_by: 'u1',
  };
}

test('item enfileirado durante o envio não é apagado quando o envio termina', () => {
  const sent = [item('a', 't-alice')];
  const queueAfterEnqueue = [...sent, item('b', 't-pedro')];
  const left = removeResolved(queueAfterEnqueue, new Set(sent.map((c) => c.client_id)));
  assert.deepEqual(left.map((c) => c.client_id), ['b']);
});

test('correção feita durante o envio fica na fila (novo client_id)', () => {
  const sent = [item('a', 't1')];
  const corrected = replaceInQueue(sent, { ...item('a2', 't1'), status: 'pulado', replace: true });
  const left = removeResolved(corrected, new Set(['a']));
  assert.equal(left.length, 1);
  assert.equal(left[0].client_id, 'a2');
  assert.equal(left[0].replace, true);
});

test('replaceInQueue mantém um item por tratamento e noite', () => {
  const q = replaceInQueue([item('a', 't1'), item('b', 't2')], item('c', 't1'));
  assert.deepEqual(q.map((c) => c.client_id).sort(), ['b', 'c']);
  const otherNight = replaceInQueue(q, item('d', 't1', '2026-10-04'));
  assert.equal(otherNight.length, 3);
});

test('itens fora da janela de 7 dias da RLS saem da fila em vez de travá-la', () => {
  const { keep, expired } = splitExpired(
    [item('velho', 't1', '2026-09-27'), item('limite', 't1', '2026-09-28'), item('hoje', 't1')],
    '2026-09-28'
  );
  assert.deepEqual(expired.map((c) => c.client_id), ['velho']);
  assert.deepEqual(keep.map((c) => c.client_id), ['limite', 'hoje']);
});

test('só recusa definitiva do banco descarta o item; rede e token vencido esperam', () => {
  assert.equal(isPermanentRejection(0), false); // sem rede
  assert.equal(isPermanentRejection(401), false); // token vencido
  assert.equal(isPermanentRejection(408), false);
  assert.equal(isPermanentRejection(429), false);
  assert.equal(isPermanentRejection(503), false);
  assert.equal(isPermanentRejection(403), true); // RLS (42501)
  assert.equal(isPermanentRejection(400), true); // tipo inválido (22P02)
  assert.equal(isPermanentRejection(409), true); // FK (23503)
});

test('chamada durante um envio agenda nova passada e só resolve depois dela', async () => {
  let runs = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const run = createSerialRunner(async () => {
    runs += 1;
    if (runs === 1) await gate;
  });

  const first = run();
  const second = run();
  const third = run();
  assert.equal(runs, 1);
  release();
  await second;
  assert.equal(runs, 2); // segunda passada cobre a 2ª e a 3ª chamadas
  await Promise.all([first, third]);
  assert.equal(runs, 2);

  await run();
  assert.equal(runs, 3); // runner livre de novo
});
