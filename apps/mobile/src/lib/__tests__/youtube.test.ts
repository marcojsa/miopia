// Testes da extração do ID de vídeo do YouTube (mural).
// Rodar: node --test src/lib/__tests__/youtube.test.ts (Node >= 23.6 — type stripping nativo).
/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { youtubeEmbedUrl, youtubeId, youtubeThumbnail } from '../youtube.ts';

const ID = 'dQw4w9WgXcQ';

test('watch?v=, com parâmetros extras', () => {
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${ID}&t=42s`), ID);
  assert.equal(youtubeId(`https://m.youtube.com/watch?feature=share&v=${ID}`), ID);
  assert.equal(youtubeId(`youtube.com/watch?v=${ID}`), ID);
});

test('youtu.be/, shorts/ e embed/', () => {
  assert.equal(youtubeId(`https://youtu.be/${ID}?si=abc123`), ID);
  assert.equal(youtubeId(`https://youtu.be/${ID}?t=10`), ID);
  assert.equal(youtubeId(`https://www.youtube.com/shorts/${ID}?si=xyz`), ID);
  assert.equal(youtubeId(`https://www.youtube.com/embed/${ID}?start=5`), ID);
  assert.equal(youtubeId(`  https://youtu.be/${ID}  `), ID);
});

test('links não reconhecíveis', () => {
  assert.equal(youtubeId(null), null);
  assert.equal(youtubeId(''), null);
  assert.equal(youtubeId('não é link'), null);
  assert.equal(youtubeId(`https://vimeo.com/${ID}`), null);
  assert.equal(youtubeId('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(youtubeId('https://www.youtube.com/channel/UC123456789'), null);
  assert.equal(youtubeId(`ftp://youtu.be/${ID}`), null);
});

test('miniatura e player', () => {
  assert.equal(youtubeThumbnail(ID), `https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
  assert.equal(
    youtubeEmbedUrl(ID),
    `https://www.youtube-nocookie.com/embed/${ID}?playsinline=1&rel=0&origin=https%3A%2F%2Fwww.oftalmoaltodepinheiros.com.br`
  );
});
