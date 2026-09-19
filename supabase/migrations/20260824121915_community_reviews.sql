create table public.anime_comments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  anime_slug text not null,
  episode integer,
  body text not null,
  rating smallint not null,
  display_name text not null,
  avatar_index smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anime_comments_slug_length check (char_length(anime_slug) between 1 and 180),
  constraint anime_comments_episode_range check (episode is null or episode between 1 and 100000),
  constraint anime_comments_body_length check (char_length(btrim(body)) between 1 and 1200),
  constraint anime_comments_rating_range check (rating between 1 and 5),
  constraint anime_comments_name_length check (char_length(btrim(display_name)) between 1 and 80),
  constraint anime_comments_avatar_range check (avatar_index between 0 and 19),
  constraint anime_comments_one_review unique nulls not distinct (anime_slug, episode, user_id)
);

create index anime_comments_thread_created_idx
  on public.anime_comments (anime_slug, episode, created_at desc, id desc);

create index anime_comments_user_id_idx
  on public.anime_comments (user_id);

alter table public.anime_comments enable row level security;

create policy "Anyone can read anime comments"
  on public.anime_comments
  for select
  to anon, authenticated
  using (true);

create policy "Signed-in users can add their own comment"
  on public.anime_comments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own comment"
  on public.anime_comments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own comment"
  on public.anime_comments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.anime_comments from anon, authenticated;
grant select on table public.anime_comments to anon, authenticated;
grant insert (user_id, anime_slug, episode, body, rating, display_name, avatar_index)
  on table public.anime_comments to authenticated;
grant update (body, rating, display_name, avatar_index, updated_at)
  on table public.anime_comments to authenticated;
grant delete on table public.anime_comments to authenticated;
grant usage, select on sequence public.anime_comments_id_seq to authenticated;

create view public.anime_comment_summary
with (security_invoker = true)
as
select
  anime_slug,
  episode,
  count(*)::bigint as total_count,
  avg(rating)::double precision as average_rating
from public.anime_comments
group by anime_slug, episode;

revoke all on table public.anime_comment_summary from anon, authenticated;
grant select on table public.anime_comment_summary to anon, authenticated;

alter publication supabase_realtime add table public.anime_comments;
