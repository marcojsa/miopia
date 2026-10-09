// Mural da clínica: orientações e vídeos (YouTube não listado) que as famílias
// veem no app. Rascunho fica só no painel; publicado aparece para todas.
import { useState, type FormEvent } from 'react';

import {
  useContents,
  useCreateContent,
  useDeleteContent,
  useReorderContents,
  useSetContentPublished,
  useUpdateContent,
} from '@/hooks/useContents';
import type { Content, ContentCategory } from '@/types/database';
import { toPtBr } from '@/lib/errors';
import { CONTENT_CATEGORY_LABELS } from '@/lib/labels';
import { normalizeYoutubeUrl, youtubeId, youtubeThumbnail } from '@/lib/youtube';

const CATEGORIES: ContentCategory[] = ['lente', 'colirio', 'oculos', 'geral'];
const TITLE_MAX = 120;
const BODY_MAX = 4000;

function categoryLabel(category: string): string {
  return CONTENT_CATEGORY_LABELS[category as ContentCategory] ?? category;
}

export function MuralPage() {
  const { data: contents, isLoading, error } = useContents();
  const createContent = useCreateContent();
  const updateContent = useUpdateContent();
  const setPublished = useSetContentPublished();
  const deleteContent = useDeleteContent();
  const reorder = useReorderContents();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ContentCategory>('geral');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const videoId = youtubeId(youtubeUrl);
  const saving = createContent.isPending || updateContent.isPending;
  const listBusy =
    setPublished.isPending || deleteContent.isPending || reorder.isPending;

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setCategory('geral');
    setYoutubeUrl('');
    setBody('');
  }

  function startEdit(item: Content) {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(CATEGORIES.includes(item.category as ContentCategory)
      ? (item.category as ContentCategory)
      : 'geral');
    setYoutubeUrl(item.youtube_url ?? '');
    setBody(item.body ?? '');
    setFormError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const publish = submitter?.dataset.publish === 'true';
    setFormError(null);
    setSuccess(null);

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const rawUrl = youtubeUrl.trim();
    if (!cleanTitle) {
      setFormError('Informe o título.');
      return;
    }
    if (cleanTitle.length > TITLE_MAX) {
      setFormError(`O título pode ter no máximo ${TITLE_MAX} caracteres.`);
      return;
    }
    if (cleanBody.length > BODY_MAX) {
      setFormError('O texto pode ter no máximo 4.000 caracteres.');
      return;
    }
    const url = rawUrl ? normalizeYoutubeUrl(rawUrl) : null;
    if (rawUrl && !url) {
      setFormError(
        'Link do YouTube não reconhecido. Copie o link pelo botão Compartilhar do vídeo (ex.: https://youtu.be/... ou https://www.youtube.com/watch?v=...).',
      );
      return;
    }
    if (!url && !cleanBody) {
      setFormError('Coloque um link do YouTube ou escreva um texto.');
      return;
    }

    const values = {
      title: cleanTitle,
      category,
      youtube_url: url,
      body: cleanBody || null,
      published: publish,
    };
    try {
      if (editingId) {
        await updateContent.mutateAsync({ id: editingId, values });
      } else {
        await createContent.mutateAsync(values);
      }
      setSuccess(
        publish
          ? 'Conteúdo publicado: as famílias já veem no app.'
          : 'Conteúdo salvo como rascunho: só a equipe vê.',
      );
      resetForm();
    } catch (err) {
      setFormError(toPtBr(err, 'Não foi possível salvar o conteúdo.'));
    }
  }

  function handleTogglePublished(item: Content) {
    setListError(null);
    setPublished.mutate(
      { id: item.id, published: !item.published },
      { onError: (err) => setListError(toPtBr(err, 'Não foi possível alterar a situação.')) },
    );
  }

  function handleDelete(item: Content) {
    if (
      !window.confirm(
        `Excluir "${item.title}"? Ele some do mural e do app das famílias. O vídeo continua no YouTube.`,
      )
    ) {
      return;
    }
    setListError(null);
    deleteContent.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) resetForm();
      },
      onError: (err) => setListError(toPtBr(err, 'Não foi possível excluir o conteúdo.')),
    });
  }

  function handleMove(index: number, delta: -1 | 1) {
    if (!contents) return;
    const target = index + delta;
    if (target < 0 || target >= contents.length) return;
    const ordered = [...contents];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setListError(null);
    reorder.mutate(ordered, {
      onError: (err) => setListError(toPtBr(err, 'Não foi possível mudar a ordem.')),
    });
  }

  return (
    <main>
      <h1>Mural</h1>
      <p className="muted">
        Orientações e vídeos para as famílias. O que está publicado aparece no app, nesta ordem.
      </p>

      <section>
        <h2>{editingId ? 'Editar conteúdo' : 'Novo conteúdo'}</h2>
        <form onSubmit={handleSave}>
          <label>
            Título
            <br />
            <input
              type="text"
              required
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFormError(null); }}
            />
          </label>
          <label>
            Categoria
            <br />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value as ContentCategory); setFormError(null); }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CONTENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Link do YouTube
            <br />
            <input
              type="url"
              inputMode="url"
              placeholder="https://youtu.be/..."
              value={youtubeUrl}
              onChange={(e) => { setYoutubeUrl(e.target.value); setFormError(null); }}
            />
          </label>
          <p className="muted">
            Publique o vídeo no YouTube como não listado e cole o link aqui.
          </p>
          {videoId ? (
            <img
              className="miniatura previa"
              src={youtubeThumbnail(videoId)}
              alt="Miniatura do vídeo do YouTube"
            />
          ) : youtubeUrl.trim() ? (
            <p className="muted">Link ainda não reconhecido como vídeo do YouTube.</p>
          ) : null}
          <label>
            Texto (opcional)
            <br />
            <textarea
              maxLength={BODY_MAX}
              value={body}
              onChange={(e) => { setBody(e.target.value); setFormError(null); }}
            />
          </label>
          {formError ? <p className="error">{formError}</p> : null}
          {success ? <p>{success}</p> : null}
          <button type="submit" className="ghost" data-publish="false" disabled={saving}>
            Salvar como rascunho
          </button>
          <button type="submit" data-publish="true" disabled={saving}>
            {saving ? 'Salvando...' : editingId ? 'Salvar e publicar' : 'Publicar'}
          </button>
          {editingId ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                resetForm();
                setFormError(null);
              }}
            >
              Cancelar edição
            </button>
          ) : null}
        </form>
      </section>

      <section>
        <h2>Conteúdos</h2>
        {isLoading ? <p>Carregando...</p> : null}
        {error ? <p className="error">Erro ao carregar: {toPtBr(error)}</p> : null}
        {contents && contents.length === 0 ? (
          <p className="muted">Nenhum conteúdo no mural ainda.</p>
        ) : null}
        {listError ? <p className="error">{listError}</p> : null}
        {contents && contents.length > 0 ? (
          <ol className="mural">
            {contents.map((item, index) => {
              const id = item.youtube_url ? youtubeId(item.youtube_url) : null;
              return (
                <li key={item.id} className={editingId === item.id ? 'editando' : undefined}>
                  {id ? (
                    <img
                      className="miniatura"
                      src={youtubeThumbnail(id)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="miniatura sem-video">Só texto</span>
                  )}
                  <div className="mural-info">
                    <strong>{item.title}</strong>
                    <span className="muted">{categoryLabel(item.category)}</span>
                    <span className={item.published ? 'situacao publicado' : 'situacao'}>
                      {item.published ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  <div className="mural-acoes">
                    <button type="button" disabled={listBusy} onClick={() => startEdit(item)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => handleTogglePublished(item)}
                    >
                      {item.published ? 'Despublicar' : 'Publicar'}
                    </button>
                    <button
                      type="button"
                      disabled={listBusy || index === 0}
                      onClick={() => handleMove(index, -1)}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      disabled={listBusy || index === contents.length - 1}
                      onClick={() => handleMove(index, 1)}
                    >
                      Descer
                    </button>
                    <button
                      type="button"
                      disabled={listBusy}
                      onClick={() => handleDelete(item)}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>
    </main>
  );
}
