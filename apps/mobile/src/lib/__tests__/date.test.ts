// Testes do corte da noite às 04h.
// Rodar: npm run test:date (Node >= 23.6 — type stripping nativo; sem Jest de propósito).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatLocalYMD, localDateString } from '../date.ts';

test('antes das 04h conta como o dia anterior', () => {
  assert.equal(localDateString(new Date(2026, 5, 11, 0, 0)), '2026-06-10');
  assert.equal(localDateString(new Date(2026, 5, 11, 3, 59)), '2026-06-10');
});

test('a partir das 04h conta como o próprio dia', () => {
  assert.equal(localDateString(new Date(2026, 5, 11, 4, 0)), '2026-06-11');
  assert.equal(localDateString(new Date(2026, 5, 11, 12, 0)), '2026-06-11');
  assert.equal(localDateString(new Date(2026, 5, 11, 23, 59)), '2026-06-11');
});

test('corte atravessa fronteira de mês e de ano', () => {
  assert.equal(localDateString(new Date(2026, 6, 1, 1, 0)), '2026-06-30');
  assert.equal(localDateString(new Date(2027, 0, 1, 2, 30)), '2026-12-31');
});

test('formatLocalYMD zero-padding', () => {
  assert.equal(formatLocalYMD(new Date(2026, 0, 5)), '2026-01-05');
});
