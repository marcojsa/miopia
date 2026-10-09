// Links do YouTube no mural. O banco só aceita https de youtube.com/watch?v=,
// youtube.com/shorts/, youtube.com/embed/ e youtu.be/ (contents_youtube_url_check).

const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
const ACCEPTED_BY_DB =
  /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/i;

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
export function youtubeId(raw: string): string | null {
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

/**
 * Link a gravar: o colado, se o banco já o aceita; senão a forma canônica
 * (ex.: watch?feature=share&v=ID ou http://). null se não for vídeo do YouTube.
 */
export function normalizeYoutubeUrl(raw: string): string | null {
  const id = youtubeId(raw);
  if (!id) return null;
  const text = raw.trim();
  return ACCEPTED_BY_DB.test(text) ? text : `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
