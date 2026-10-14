-- For an existing Nohomework Supabase schema only. Fresh projects use supabase-schema.sql instead.
-- Preserves lessons, questions, membership and class IDs.
begin;
create table if not exists public.school_schools(id uuid primary key default gen_random_uuid(),name text not null,owner_teacher_id uuid not null references public.school_profiles(id));
alter table public.school_classes add column if not exists school_id uuid references public.school_schools(id);
do $$declare owner_id uuid;destination uuid;begin
 for owner_id in select distinct owner_teacher_id from public.school_classes where school_id is null loop
  select id into destination from public.school_schools where owner_teacher_id=owner_id order by id limit 1;
  if destination is null then insert into public.school_schools(name,owner_teacher_id) values('בית הספר שלי',owner_id) returning id into destination;end if;
  update public.school_classes set school_id=destination where owner_teacher_id=owner_id and school_id is null;
 end loop;
end$$;
alter table public.school_classes alter column school_id set not null;
create or replace function public.can_manage_school(s uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from school_schools where id=s and owner_teacher_id=auth.uid()) or exists(select 1 from school_classes where school_id=s and is_school_teacher(id))$$;
alter table public.school_schools enable row level security;
drop policy if exists school_read on public.school_schools;
create policy school_read on public.school_schools for select to authenticated using(owner_teacher_id=auth.uid() or exists(select 1 from public.school_classes c where c.school_id=school_schools.id and can_read_school_class(c.id)));
drop policy if exists school_create on public.school_schools;
create policy school_create on public.school_schools for insert to authenticated with check(owner_teacher_id=auth.uid() and school_role(auth.uid())='teacher');
drop policy if exists class_create on public.school_classes;
create policy class_create on public.school_classes for insert to authenticated with check(owner_teacher_id=auth.uid() and can_manage_school(school_id) and school_role(auth.uid())='teacher');
commit;
-- Rename the default schools to their real names in the SQL editor.
-- If teachers' existing classes belong to the same school, an administrator can consolidate school_id explicitly.
