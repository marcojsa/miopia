-- Mural da clínica: orientações e vídeos que a Dra. publica para as famílias
-- (como colocar e tirar a lente, como pingar colírio, cuidado com os óculos).
-- O vídeo fica no YouTube como "não listado"; aqui guardamos só o link.
-- A equipe escreve; a família só lê o que está publicado.

create table public.contents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text check (body is null or char_length(body) <= 4000),
  youtube_url text check (
    youtube_url is null
    or youtube_url ~* '^https://(www\.|m\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{6,}'
  ),
  category    text not null default 'geral'
              check (category in ('lente', 'colirio', 'oculos', 'geral')),
  sort_order  integer not null default 0,
  published   boolean not null default false,
  created_by  uuid references public.staff(user_id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- um item precisa ter texto ou vídeo
  constraint contents_tem_texto_ou_video check (body is not null or youtube_url is not null)
);

create index contents_publicados_idx on public.contents (sort_order, created_at desc) where published;
create index contents_created_by_idx on public.contents (created_by);

alter table public.contents enable row level security;

revoke all on public.contents from anon;
grant select, insert, update, delete on public.contents to authenticated;
grant all on public.contents to service_role;

create policy cont_staff_all on public.contents for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- Qualquer responsável logado lê o que está publicado (conteúdo geral, sem dado de paciente).
create policy cont_publicado_read on public.contents for select to authenticated
  using (published);

create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function private.set_updated_at();
