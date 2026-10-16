-- Run once, after managed-children.sql (and demo-mode.sql if used).
-- Class materials: photos of the whiteboard / notebook pages. A teacher can appoint students ("uploaders");
-- teacher uploads are published at once, student uploads wait for teacher approval.
create table public.school_class_uploaders(
 class_id uuid not null references public.school_classes(id) on delete cascade,
 student_id uuid not null references public.school_profiles(id) on delete cascade,
 assigned_by uuid not null default auth.uid() references public.school_profiles(id),
 created_at timestamptz not null default now(),
 primary key(class_id,student_id));
create table public.school_materials(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.school_classes(id) on delete cascade,
 subject text not null check(length(subject)<=60),
 kind text not null check(kind in('board','notebook','other')),
 caption text check(caption is null or length(caption)<=200),
 image text not null check(image like 'data:image/jpeg;base64,%' and length(image)<=1500000),
 uploaded_by uuid not null default auth.uid() references public.school_profiles(id),
 on_behalf_of uuid references public.school_profiles(id),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 lesson_date date not null default current_date,
 created_at timestamptz not null default now());
create index school_materials_class_idx on public.school_materials(class_id,created_at desc);
alter table public.school_class_uploaders enable row level security;
alter table public.school_materials enable row level security;

-- Who may appoint uploaders: the class teachers and the school manager, only students who belong to the class.
create policy uploader_read on public.school_class_uploaders for select to authenticated
 using(can_manage_class_join(class_id) or can_act_for_student(student_id));
create policy uploader_add on public.school_class_uploaders for insert to authenticated
 with check(can_manage_class_join(class_id) and assigned_by=auth.uid() and exists(select 1 from school_members m where m.class_id=school_class_uploaders.class_id and m.user_id=student_id and m.member_role='student'));
create policy uploader_remove on public.school_class_uploaders for delete to authenticated using(can_manage_class_join(class_id));

-- Reading: class members see approved photos; uploaders see their own; teachers see everything.
create policy material_read on public.school_materials for select to authenticated
 using(can_read_school_class(class_id) and (status='approved' or uploaded_by=auth.uid() or can_manage_class_join(class_id)));
-- Insert: a teacher publishes directly; an appointed student (or the parent of an appointed managed child) uploads as pending.
create policy material_add on public.school_materials for insert to authenticated
 with check(uploaded_by=auth.uid() and (
  (can_manage_class_join(class_id) and status='approved' and on_behalf_of is null)
  or (status='pending' and on_behalf_of is not null and can_act_for_student(on_behalf_of)
      and exists(select 1 from school_class_uploaders u where u.class_id=school_materials.class_id and u.student_id=on_behalf_of))));
create policy material_remove on public.school_materials for delete to authenticated
 using(can_manage_class_join(class_id) or uploaded_by=auth.uid());
-- No UPDATE policy: only the teacher's decision function below changes a status.
create function public.decide_material(material_id uuid,approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare m school_materials%rowtype;
begin
 select * into m from school_materials where id=material_id for update;
 if not found then raise exception 'No such material';end if;
 if not can_manage_class_join(m.class_id) then raise exception 'Not authorized';end if;
 update school_materials set status=case when approve then 'approved' else 'rejected' end where id=material_id;
end$$;
revoke all on function public.decide_material(uuid,boolean) from public,anon;
grant execute on function public.decide_material(uuid,boolean) to authenticated;
