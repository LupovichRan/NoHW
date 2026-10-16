-- Run once, after class-materials.sql (or after managed-children.sql).
-- The class timetable: which lessons there are on each weekday (0 = Sunday ... 4 = Thursday).
create table public.school_timetable(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.school_classes(id) on delete cascade,
 weekday integer not null check(weekday between 0 and 4),
 start_time time not null,
 end_time time not null check(end_time>start_time),
 subject text not null check(length(subject) between 1 and 40),
 created_by uuid not null default auth.uid() references public.school_profiles(id),
 created_at timestamptz not null default now());
create index school_timetable_class_idx on public.school_timetable(class_id,weekday,start_time);
alter table public.school_timetable enable row level security;
create policy timetable_read on public.school_timetable for select to authenticated using(can_read_school_class(class_id));
create policy timetable_add on public.school_timetable for insert to authenticated with check(can_manage_class_join(class_id) and created_by=auth.uid());
create policy timetable_remove on public.school_timetable for delete to authenticated using(can_manage_class_join(class_id));
