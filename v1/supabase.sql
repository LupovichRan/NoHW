-- Family store for the v1 demo (applied to the "nohomework" Supabase project as migration nohw_v1_families).
-- The 8-char family code is the capability: anon can call the two functions but cannot read or list the table.
create table if not exists public.nohw_v1_families (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (pg_column_size(doc) < 400000)
);
alter table public.nohw_v1_families enable row level security;
revoke all on public.nohw_v1_families from anon, authenticated;

create or replace function public.nohw_get_family(p_code text)
returns jsonb language sql security definer set search_path = public, pg_temp stable as $$
  select doc from public.nohw_v1_families where code = p_code and p_code ~ '^[A-HJ-NP-Z2-9]{8}$';
$$;

create or replace function public.nohw_put_family(p_code text, p_doc jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{8}$' then raise exception 'bad code'; end if;
  if pg_column_size(p_doc) >= 400000 then raise exception 'too big'; end if;
  insert into public.nohw_v1_families(code, doc, updated_at) values (p_code, p_doc, now())
  on conflict (code) do update set doc = excluded.doc, updated_at = now();
end $$;

revoke all on function public.nohw_get_family(text) from public;
revoke all on function public.nohw_put_family(text, jsonb) from public;
grant execute on function public.nohw_get_family(text) to anon;
grant execute on function public.nohw_put_family(text, jsonb) to anon;
