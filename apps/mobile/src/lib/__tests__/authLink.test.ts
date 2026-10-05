// Testes da leitura dos links de convite/recuperação do Supabase Auth.
// Rodar: node --test src/lib/__tests__/authLink.test.ts (Node >= 23.6).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAuthLink } from '../authLink.ts';

test('convite: tokens no fragmento', () => {
  const r = parseAuthLink(
    'miopia://convite#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=rrr&token_type=bearer&type=invite'
  );
  assert.deepEqual(r, { kind: 'tokens', accessToken: 'aaa.bbb.ccc', refreshToken: 'rrr', type: 'invite' });
});

test('recuperação: type=recovery', () => {
  const r = parseAuthLink('miopia://recuperar-senha#access_token=a&refresh_token=b&type=recovery');
  assert.equal(r.kind, 'tokens');
  assert.equal(r.kind === 'tokens' ? r.type : null, 'recovery');
});

test('link expirado: erro legível vindo do fragmento', () => {
  const r = parseAuthLink(
    'miopia://convite#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  );
  assert.deepEqual(r, { kind: 'error', message: 'Email link is invalid or has expired' });
});

test('erro na query também é reconhecido', () => {
  const r = parseAuthLink('miopia://convite?error=server_error&error_description=Falhou%20aqui');
  assert.deepEqual(r, { kind: 'error', message: 'Falhou aqui' });
});

test('sem tokens nem erro', () => {
  assert.deepEqual(parseAuthLink('miopia://convite'), { kind: 'none' });
  assert.deepEqual(parseAuthLink('miopia://convite#access_token=só-um'), { kind: 'none' });
});
