// Links do YouTube no mural — FUNÇÕES PURAS (testáveis com `node --test`,
// src/lib/__tests__/youtube.test.ts). Mesma lógica de apps/painel/src/lib/youtube.ts.

const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];

function parseUrl(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/** ID do vídeo em links watch?v=, youtu.be/, shorts/ e embed/ (com &t=, ?si= etc.). */
export function youtubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = parseUrl(raw);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (YOUTUBE_HOSTS.includes(host)) {
    if (url.pathname === '/watch' || url.pathname === '/watch/') {
      id = url.searchParams.get('v');
    } else {
      id = /^\/(?:shorts|embed)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Origem informada ao YouTube pelo player do app. O YouTube recusa tocar vídeo
 * embutido quando a requisição não diz de onde vem (erros 152/153).
 */
export const PLAYER_ORIGIN = 'https://www.oftalmoaltodepinheiros.com.br';

/** Player embutido sem cookies, tocando dentro da página (iOS). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&origin=${encodeURIComponent(PLAYER_ORIGIN)}`;
}

/** Link para assistir no app do YouTube ou no navegador. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
