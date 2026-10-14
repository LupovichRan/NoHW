-- Core shared-account schema. Execute once in a NEW Supabase project.
-- Static app uses this schema when cloud-config.js has public project credentials.
create table public.school_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null default 'student' check(role in ('student','teacher','parent'))
);
create function public.create_school_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into school_profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'משתמש חדש'));return new;end$$;
create trigger school_user_created after insert on auth.users for each row execute procedure public.create_school_profile();
insert into public.school_profiles(id,display_name) select id,coalesce(nullif(raw_user_meta_data->>'display_name',''),'משתמש קיים') from auth.users on conflict(id) do nothing;
create table public.school_schools(id uuid primary key default gen_random_uuid(),name text not null,owner_teacher_id uuid not null references school_profiles(id));
create table public.school_classes(id uuid primary key default gen_random_uuid(),name text not null,school_id uuid not null references school_schools(id),owner_teacher_id uuid not null references school_profiles(id));
create table public.school_members(class_id uuid references school_classes(id) on delete cascade,user_id uuid references school_profiles(id) on delete cascade,member_role text not null check(member_role in('teacher','student')),primary key(class_id,user_id));
create table public.school_guardians(parent_id uuid references school_profiles(id),student_id uuid references school_profiles(id),primary key(parent_id,student_id));
create function public.is_school_teacher(c uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from school_classes where id=c and owner_teacher_id=auth.uid()) or exists(select 1 from school_members where class_id=c and user_id=auth.uid() and member_role='teacher')$$;
create function public.can_read_school_class(c uuid) returns boolean language sql stable security definer set search_path=public as $$select is_school_teacher(c) or exists(select 1 from school_members where class_id=c and user_id=auth.uid()) or exists(select 1 from school_members m join school_guardians g on g.student_id=m.user_id where m.class_id=c and g.parent_id=auth.uid())$$;
create function public.can_manage_school(s uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from school_schools where id=s and owner_teacher_id=auth.uid()) or exists(select 1 from school_classes where school_id=s and is_school_teacher(id))$$;
create function public.can_read_student(s uuid) returns boolean language sql stable security definer set search_path=public as $$select s=auth.uid() or exists(select 1 from school_guardians where student_id=s and parent_id=auth.uid())$$;
create table public.school_lessons(id uuid primary key default gen_random_uuid(),class_id uuid not null references school_classes(id),subject text not null,lesson_date date not null,teacher_id uuid not null default auth.uid() references school_profiles(id),published_content jsonb not null default '{}',due_at timestamptz,unique(class_id,subject,lesson_date));
create table public.school_completions(lesson_id uuid references school_lessons(id) on delete cascade,student_id uuid references school_profiles(id),completed_at timestamptz,primary key(lesson_id,student_id));
create table public.school_questions(id uuid primary key default gen_random_uuid(),class_id uuid not null references school_classes(id),author_id uuid not null default auth.uid() references school_profiles(id),subject text not null,question text not null,approved_answer text,answered_by uuid references school_profiles(id),answered_at timestamptz,student_id uuid not null references school_profiles(id),created_at timestamptz not null default now());
-- Class-wide Q&A is separate: original private question and author never leak.
create table public.school_class_answers(id uuid primary key default gen_random_uuid(),question_id uuid not null unique references school_questions(id),subject text not null,class_id uuid not null references school_classes(id),public_question text not null,approved_answer text not null,teacher_id uuid not null default auth.uid() references school_profiles(id),created_at timestamptz not null default now());
-- AI drafts are stored separately from published content, teacher access only.
create table public.school_ai_drafts(id uuid primary key default gen_random_uuid(),class_id uuid not null references school_classes(id),teacher_id uuid not null default auth.uid() references school_profiles(id),kind text not null check(kind in('lesson','answer')),lesson_id uuid unique references school_lessons(id) on delete cascade,question_id uuid unique references school_questions(id) on delete cascade,draft text not null);
alter table school_profiles enable row level security;
alter table school_schools enable row level security;
alter table school_classes enable row level security;
alter table school_members enable row level security;
alter table school_guardians enable row level security;
alter table school_lessons enable row level security;
alter table school_completions enable row level security;
alter table school_questions enable row level security;
alter table school_class_answers enable row level security;
alter table school_ai_drafts enable row level security;
create policy profile_self on school_profiles for select to authenticated using(id=auth.uid() or can_read_student(id) or exists(select 1 from school_members m where m.user_id=school_profiles.id and is_school_teacher(m.class_id)) or (role='teacher' and exists(select 1 from school_members m where m.user_id=school_profiles.id and can_read_school_class(m.class_id))) or (role='teacher' and exists(select 1 from school_classes c where c.owner_teacher_id=school_profiles.id and can_read_school_class(c.id))));
create policy class_read on school_classes for select to authenticated using(can_read_school_class(id));
create policy class_create on school_classes for insert to authenticated with check(owner_teacher_id=auth.uid() and can_manage_school(school_id) and exists(select 1 from school_profiles where id=auth.uid() and role='teacher'));
create policy member_read on school_members for select to authenticated using(user_id=auth.uid() or is_school_teacher(class_id) or can_read_student(user_id));
create function public.school_role(u uuid) returns text language sql stable security definer set search_path=public as $$select role from school_profiles where id=u$$;
create policy member_add on school_members for insert to authenticated with check(is_school_teacher(class_id) and school_role(user_id)=member_role);
create policy member_remove on school_members for delete to authenticated using(is_school_teacher(class_id));
create policy guardian_read on school_guardians for select to authenticated using(parent_id=auth.uid() or student_id=auth.uid());
create policy lesson_read on school_lessons for select to authenticated using(can_read_school_class(class_id));
create policy lesson_write on school_lessons for all to authenticated using(is_school_teacher(class_id)) with check(is_school_teacher(class_id) and teacher_id=auth.uid());
create policy completion_read on school_completions for select to authenticated using(can_read_student(student_id) or exists(select 1 from school_lessons l where l.id=lesson_id and is_school_teacher(l.class_id)));
create policy completion_write on school_completions for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid() and exists(select 1 from school_profiles where id=auth.uid() and role='student') and exists(select 1 from school_lessons l join school_members m on m.class_id=l.class_id where l.id=lesson_id and m.user_id=auth.uid() and m.member_role='student'));
create policy question_read on school_questions for select to authenticated using(author_id=auth.uid() or is_school_teacher(class_id));
create policy question_create on school_questions for insert to authenticated with check(author_id=auth.uid() and can_read_school_class(class_id) and can_read_student(student_id) and exists(select 1 from school_members m where m.class_id=school_questions.class_id and m.user_id=school_questions.student_id and m.member_role='student') and approved_answer is null and answered_by is null);
create policy question_answer on school_questions for update to authenticated using(is_school_teacher(class_id)) with check(is_school_teacher(class_id) and answered_by=auth.uid());
create policy class_answer_read on school_class_answers for select to authenticated using(can_read_school_class(class_id));
create policy class_answer_write on school_class_answers for all to authenticated using(is_school_teacher(class_id)) with check(is_school_teacher(class_id) and teacher_id=auth.uid());
create policy draft_teacher_only on school_ai_drafts for all to authenticated using(is_school_teacher(class_id)) with check(is_school_teacher(class_id) and teacher_id=auth.uid());
-- Promote teachers/parents and link guardians only from the admin SQL editor.
-- Never put a service_role key into the static website.

create table public.school_lesson_slots(id uuid primary key default gen_random_uuid(),class_id uuid not null references school_classes(id),teacher_id uuid not null default auth.uid() references school_profiles(id),subject text not null,weekday integer not null check(weekday between 0 and 6),end_time time not null);
alter table school_lesson_slots enable row level security;
create policy slot_read on school_lesson_slots for select to authenticated using(can_read_school_class(class_id));
create policy slot_write on school_lesson_slots for all to authenticated using(is_school_teacher(class_id) and teacher_id=auth.uid()) with check(is_school_teacher(class_id) and teacher_id=auth.uid());

-- Publish teacher-approved answers atomically; no partial private/public state.
create function public.publish_school_answer(question_id uuid,answer_text text,class_wide boolean,class_question text default null) returns void language plpgsql security invoker set search_path=public as $$
declare q school_questions%rowtype;
begin
 select * into q from school_questions where id=publish_school_answer.question_id;
 if not found or not is_school_teacher(q.class_id) then raise exception 'Not authorized'; end if;
 if nullif(trim(answer_text),'') is null then raise exception 'Answer required'; end if;
 update school_questions set approved_answer=answer_text,answered_by=auth.uid(),answered_at=now() where id=q.id;
 if class_wide then
  if nullif(trim(class_question),'') is null then raise exception 'Class question required'; end if;
  insert into school_class_answers(question_id,class_id,subject,public_question,approved_answer,teacher_id) values(q.id,q.class_id,q.subject,class_question,answer_text,auth.uid()) on conflict on constraint school_class_answers_question_id_key do update set public_question=excluded.public_question,approved_answer=excluded.approved_answer,teacher_id=excluded.teacher_id,created_at=now();
 else delete from school_class_answers a where a.question_id=q.id; end if;
 delete from school_ai_drafts d where d.question_id=q.id;
end$$;
revoke all on function public.publish_school_answer(uuid,text,boolean,text) from public;
grant execute on function public.publish_school_answer(uuid,text,boolean,text) to authenticated;

create policy school_read on public.school_schools for select to authenticated using(owner_teacher_id=auth.uid() or exists(select 1 from public.school_classes c where c.school_id=school_schools.id and can_read_school_class(c.id)));
create policy school_create on public.school_schools for insert to authenticated with check(owner_teacher_id=auth.uid() and school_role(auth.uid())='teacher');
