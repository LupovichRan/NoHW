
-- ===== supabase-schema.sql =====
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

-- ===== subscriptions.sql =====
-- Run after supabase-schema.sql. No payment provider is connected yet.
-- Membership clients may read; trial timestamps and billing statuses are server-only.
create table public.school_family_subscriptions (
 owner_parent_id uuid primary key references public.school_profiles(id),
 status text not null default 'trialing' check(status in('trialing','active','past_due','canceled')),
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now()+interval '3 months'),
 monthly_agorot integer not null default 990 check(monthly_agorot>=0),
 currency text not null default 'ILS' check(currency='ILS'),
 current_period_end timestamptz,
 provider_customer_id text,
 provider_subscription_id text
);
alter table public.school_family_subscriptions enable row level security;
create policy family_plan_read on public.school_family_subscriptions for select to authenticated using(owner_parent_id=auth.uid() or exists(select 1 from public.school_guardians g where g.parent_id=owner_parent_id and g.student_id=auth.uid()));
create function public.start_family_trial() returns trigger language plpgsql security definer set search_path=public as $$begin
 if school_role(new.parent_id) <> 'parent' or school_role(new.student_id) <> 'student' then raise exception 'Parent and student roles required';end if;
 insert into school_family_subscriptions(owner_parent_id) values(new.parent_id) on conflict(owner_parent_id) do nothing;
 return new;
end$$;
create trigger first_child_starts_trial after insert on public.school_guardians for each row execute procedure public.start_family_trial();
-- Existing linked families receive one shared trial, not a separate trial per child.
insert into public.school_family_subscriptions(owner_parent_id) select distinct parent_id from public.school_guardians where school_role(parent_id)='parent' on conflict(owner_parent_id) do nothing;
-- No client INSERT/UPDATE/DELETE policy: the browser cannot reset a trial or mark a subscription paid.
-- Paid statuses must be updated by a verified, idempotent payment-provider webhook.
-- Access enforcement remains off until checkout and webhook verification are implemented.

-- Serialize enrollment per parent to enforce the four-child limit under concurrency.
create function public.enforce_four_child_limit() returns trigger language plpgsql security definer set search_path=public as $$
declare linked integer;
begin
 perform 1 from school_profiles where id=new.parent_id for update;
 if tg_op='UPDATE' then
  select count(*) into linked from school_guardians where parent_id=new.parent_id and not(parent_id=old.parent_id and student_id=old.student_id);
 else select count(*) into linked from school_guardians where parent_id=new.parent_id; end if;
 if linked>=4 then raise exception 'A family subscription supports at most four children'; end if;
 return new;
end$$;
create trigger family_four_child_limit before insert or update of parent_id,student_id on public.school_guardians for each row execute procedure public.enforce_four_child_limit();

-- ===== admin-invitations.sql =====
-- Run AFTER supabase-schema.sql, subscriptions.sql and school migration if upgrading.
begin;
alter table public.school_profiles drop constraint if exists school_profiles_role_check;
alter table public.school_profiles add constraint school_profiles_role_check check(role in('student','teacher','parent','manager','admin'));
create table public.school_staff(school_id uuid references public.school_schools(id) on delete cascade,user_id uuid references public.school_profiles(id),staff_role text not null check(staff_role in('teacher','manager')),primary key(school_id,user_id));
create function public.is_system_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce(school_role(auth.uid())='admin',false)$$;
create function public.is_school_manager(s uuid) returns boolean language sql stable security definer set search_path=public as $$select is_system_admin() or exists(select 1 from school_staff where school_id=s and user_id=auth.uid() and staff_role='manager')$$;
create or replace function public.can_manage_school(s uuid) returns boolean language sql stable security definer set search_path=public as $$select is_school_manager(s)$$;
create or replace function public.can_read_school_class(c uuid) returns boolean language sql stable security definer set search_path=public as $$select is_school_teacher(c) or exists(select 1 from school_classes where id=c and is_school_manager(school_id)) or exists(select 1 from school_members where class_id=c and user_id=auth.uid()) or exists(select 1 from school_members m join school_guardians g on g.student_id=m.user_id where m.class_id=c and g.parent_id=auth.uid())$$;
alter table school_staff enable row level security;
create policy staff_read on school_staff for select to authenticated using(user_id=auth.uid() or is_school_manager(school_id));
create policy staff_write on school_staff for all to authenticated using(is_school_manager(school_id)) with check(is_school_manager(school_id) and school_role(user_id)=staff_role and (staff_role<>'manager' or is_system_admin()));
drop policy school_create on school_schools;
create policy school_create on school_schools for insert to authenticated with check(is_system_admin() and owner_teacher_id=auth.uid());
create policy school_manage on school_schools for select to authenticated using(is_school_manager(id) or exists(select 1 from school_staff s where s.school_id=school_schools.id and s.user_id=auth.uid()));
create policy school_edit on school_schools for update to authenticated using(is_school_manager(id)) with check(is_school_manager(id));
drop policy class_create on school_classes;
create policy class_create on school_classes for insert to authenticated with check(is_school_manager(school_id) and school_role(owner_teacher_id)='teacher' and exists(select 1 from school_staff s where s.school_id=school_classes.school_id and s.user_id=school_classes.owner_teacher_id and s.staff_role='teacher'));
create policy class_admin_read on school_classes for select to authenticated using(is_school_manager(school_id));
create policy class_admin_edit on school_classes for update to authenticated using(is_school_manager(school_id)) with check(is_school_manager(school_id));
create policy member_admin_read on school_members for select to authenticated using(exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id)));
create policy member_admin_write on school_members for all to authenticated using(exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id))) with check(school_role(user_id)=member_role and exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id)));
create policy profile_admin_read on school_profiles for select to authenticated using(is_system_admin() or exists(select 1 from school_staff s where s.user_id=school_profiles.id and is_school_manager(s.school_id)) or exists(select 1 from school_members m join school_classes c on c.id=m.class_id where m.user_id=school_profiles.id and is_school_manager(c.school_id)));
create policy guardian_admin_read on school_guardians for select to authenticated using(is_system_admin() or exists(select 1 from school_members m join school_classes c on c.id=m.class_id where m.user_id=student_id and is_school_manager(c.school_id)));
create table public.school_invitations(id uuid primary key default gen_random_uuid(),token uuid not null unique default gen_random_uuid(),school_id uuid not null references school_schools(id),class_id uuid references school_classes(id),student_id uuid references school_profiles(id),invite_role text not null check(invite_role in('teacher','parent','manager')),email text not null check(email=lower(trim(email))),created_by uuid not null default auth.uid() references school_profiles(id),created_at timestamptz not null default now(),expires_at timestamptz not null default (now()+interval '7 days'),status text not null default 'pending' check(status in('pending','accepted','revoked')),accepted_by uuid references school_profiles(id),accepted_at timestamptz);
alter table school_invitations enable row level security;
create policy invitation_manage_read on school_invitations for select to authenticated using(is_school_manager(school_id));
create policy invitation_create on school_invitations for insert to authenticated with check(created_by=auth.uid() and status='pending' and accepted_by is null and accepted_at is null and is_school_manager(school_id) and (invite_role<>'manager' or is_system_admin()) and (class_id is null or exists(select 1 from school_classes c where c.id=class_id and c.school_id=school_invitations.school_id)) and (invite_role<>'parent' or (student_id is not null and exists(select 1 from school_members m join school_classes c on c.id=m.class_id where m.user_id=student_id and m.member_role='student' and c.school_id=school_invitations.school_id))));
create function public.revoke_school_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$declare s uuid;begin select school_id into s from school_invitations where id=invitation_id;if not found or not is_school_manager(s) then raise exception 'Not authorized';end if;update school_invitations set status='revoked' where id=invitation_id and status='pending';end$$;
create function public.accept_school_invitation(invitation_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare invite school_invitations%rowtype;user_email text;verified timestamptz;existing_role text;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select lower(email),email_confirmed_at into user_email,verified from auth.users where id=auth.uid();
 if verified is null then raise exception 'Confirm your email before accepting';end if;
 select * into invite from school_invitations where token=invitation_token for update;
 if not found or invite.status<>'pending' or invite.expires_at<=now() then raise exception 'Invitation expired or unavailable';end if;
 if invite.email<>user_email then raise exception 'Sign in with the invited email';end if;
 existing_role:=school_role(auth.uid());if existing_role not in('student',invite.invite_role) then raise exception 'Existing account role conflicts with invitation';end if;
 update school_profiles set role=invite.invite_role where id=auth.uid();
 if invite.invite_role in('teacher','manager') then
  insert into school_staff(school_id,user_id,staff_role) values(invite.school_id,auth.uid(),invite.invite_role) on conflict(school_id,user_id) do update set staff_role=excluded.staff_role;
  if invite.invite_role='teacher' and invite.class_id is not null then insert into school_members(class_id,user_id,member_role) values(invite.class_id,auth.uid(),'teacher') on conflict(class_id,user_id) do update set member_role='teacher';end if;
 else
  if invite.student_id is null then raise exception 'Student link required';end if;
  insert into school_guardians(parent_id,student_id) values(auth.uid(),invite.student_id) on conflict do nothing;
 end if;
 update school_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
end$$;
revoke all on function public.accept_school_invitation(uuid) from public;
revoke all on function public.revoke_school_invitation(uuid) from public;
grant execute on function public.accept_school_invitation(uuid) to authenticated;
grant execute on function public.revoke_school_invitation(uuid) to authenticated;
revoke update on public.school_schools,public.school_classes from authenticated;
grant update(name) on public.school_schools,public.school_classes to authenticated;
commit;
-- Bootstrap ONLY via the project owner's SQL editor after registering an account:
-- update public.school_profiles set role='admin' where id='UUID_OF_SYSTEM_ADMIN';

-- ===== role-management.sql =====
-- Run after admin-invitations.sql. Browser cannot elevate its own system role.
create function public.set_school_user_role(target_user uuid,new_role text) returns void language plpgsql security definer set search_path=public as $$
declare old_role text;begin
 if not is_system_admin() then raise exception 'System admin only';end if;
 if new_role not in('student','teacher','parent','manager','admin') then raise exception 'Invalid role';end if;
 -- Serialize admin-role changes to prevent concurrent removal of the last admin.
 perform 1 from school_profiles where role='admin' order by id for update;
 select role into old_role from school_profiles where id=target_user for update;
 if not found then raise exception 'User not found';end if;
 if old_role=new_role then return;end if;
 if target_user=auth.uid() then raise exception 'Cannot change your own admin role';end if;
 if old_role='admin' and (select count(*) from school_profiles where role='admin')<=1 then raise exception 'Cannot remove the last admin';end if;
 if exists(select 1 from school_members where user_id=target_user and member_role<>new_role) or exists(select 1 from school_staff where user_id=target_user and staff_role<>new_role) or (new_role<>'teacher' and exists(select 1 from school_classes where owner_teacher_id=target_user)) or (new_role<>'parent' and exists(select 1 from school_guardians where parent_id=target_user)) then raise exception 'Remove incompatible class/staff/parent assignments first';end if;
 update school_profiles set role=new_role where id=target_user;
end$$;
create function public.remove_school_teacher_assignment(teacher_user uuid,target_class uuid) returns void language plpgsql security definer set search_path=public as $$
declare institution uuid;owner_id uuid;begin
 select school_id,owner_teacher_id into institution,owner_id from school_classes where id=target_class for update;
 if not found or not is_school_manager(institution) then raise exception 'School manager only';end if;
 if owner_id=teacher_user then raise exception 'Assign a different primary class teacher before removing the owner';end if;
 delete from school_members where class_id=target_class and user_id=teacher_user and member_role='teacher';
end$$;
revoke all on function public.set_school_user_role(uuid,text) from public;
revoke all on function public.remove_school_teacher_assignment(uuid,uuid) from public;
grant execute on function public.set_school_user_role(uuid,text) to authenticated;
grant execute on function public.remove_school_teacher_assignment(uuid,uuid) to authenticated;

create function public.set_primary_school_teacher(teacher_user uuid,target_class uuid) returns void language plpgsql security definer set search_path=public as $$
declare institution uuid;previous_teacher uuid;begin
 select school_id,owner_teacher_id into institution,previous_teacher from school_classes where id=target_class for update;
 if not found or not is_school_manager(institution) then raise exception 'School manager only';end if;
 if school_role(teacher_user)<>'teacher' or not exists(select 1 from school_staff where school_id=institution and user_id=teacher_user and staff_role='teacher') then raise exception 'Teacher must belong to this school';end if;
 update school_classes set owner_teacher_id=teacher_user where id=target_class;
 insert into school_members(class_id,user_id,member_role) values(target_class,teacher_user,'teacher') on conflict(class_id,user_id) do update set member_role='teacher';
 if previous_teacher<>teacher_user and school_role(previous_teacher)='teacher' then insert into school_members(class_id,user_id,member_role) values(target_class,previous_teacher,'teacher') on conflict do nothing;end if;
end$$;
revoke all on function public.set_primary_school_teacher(uuid,uuid) from public;
grant execute on function public.set_primary_school_teacher(uuid,uuid) to authenticated;

-- ===== registration-permissions.sql =====
-- Run after admin-invitations.sql and role-management.sql.
begin;
alter table school_invitations drop constraint if exists school_invitations_invite_role_check;
alter table school_invitations add constraint school_invitations_invite_role_check check(invite_role in('teacher','parent','manager','student'));
drop policy invitation_create on school_invitations;
create policy invitation_create on school_invitations for insert to authenticated with check(created_by=auth.uid() and status='pending' and accepted_by is null and accepted_at is null and is_school_manager(school_id) and (invite_role<>'manager' or is_system_admin()) and (class_id is null or exists(select 1 from school_classes c where c.id=class_id and c.school_id=school_invitations.school_id)) and (invite_role<>'student' or class_id is not null) and (invite_role<>'parent' or (student_id is not null and exists(select 1 from school_members m join school_classes c on c.id=m.class_id where m.user_id=student_id and m.member_role='student' and c.school_id=school_invitations.school_id))));
create or replace function public.accept_school_invitation(invitation_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare invite school_invitations%rowtype;user_email text;verified timestamptz;existing_role text;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select lower(email),email_confirmed_at into user_email,verified from auth.users where id=auth.uid();
 if verified is null then raise exception 'Confirm your email before accepting';end if;
 select * into invite from school_invitations where token=invitation_token for update;
 if not found or invite.status<>'pending' or invite.expires_at<=now() then raise exception 'Invitation expired or unavailable';end if;
 if invite.email<>user_email then raise exception 'Sign in with the invited email';end if;
 existing_role:=school_role(auth.uid());if existing_role not in('student',invite.invite_role) then raise exception 'Existing account role conflicts with invitation';end if;
 update school_profiles set role=invite.invite_role where id=auth.uid();
 if invite.invite_role in('teacher','manager') then
  insert into school_staff(school_id,user_id,staff_role) values(invite.school_id,auth.uid(),invite.invite_role) on conflict(school_id,user_id) do update set staff_role=excluded.staff_role;
  if invite.invite_role='teacher' and invite.class_id is not null then insert into school_members(class_id,user_id,member_role) values(invite.class_id,auth.uid(),'teacher') on conflict(class_id,user_id) do update set member_role='teacher';end if;
 elsif invite.invite_role='student' then
  if invite.class_id is null then raise exception 'Class required';end if;
  insert into school_members(class_id,user_id,member_role) values(invite.class_id,auth.uid(),'student') on conflict(class_id,user_id) do update set member_role='student';
 else
  if invite.student_id is null then raise exception 'Student link required';end if;
  insert into school_guardians(parent_id,student_id) values(auth.uid(),invite.student_id) on conflict do nothing;
 end if;
 update school_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
end$$;
create table school_class_permissions(class_id uuid references school_classes(id) on delete cascade,user_id uuid references school_profiles(id) on delete cascade,can_update_lessons boolean not null default true,can_answer_questions boolean not null default true,can_publish_class_answers boolean not null default true,primary key(class_id,user_id));
alter table school_class_permissions enable row level security;
create policy permission_read on school_class_permissions for select to authenticated using(user_id=auth.uid() or exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id)));
create policy permission_manage on school_class_permissions for all to authenticated using(exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id))) with check(school_role(user_id)='teacher' and exists(select 1 from school_classes c where c.id=class_id and is_school_manager(c.school_id)) and (exists(select 1 from school_members m where m.class_id=school_class_permissions.class_id and m.user_id=school_class_permissions.user_id and m.member_role='teacher') or exists(select 1 from school_classes c where c.id=class_id and c.owner_teacher_id=user_id)));
create function public.can_school_action(c uuid,action text) returns boolean language plpgsql stable security definer set search_path=public as $$declare rights school_class_permissions%rowtype;begin
 if not is_school_teacher(c) then return false;end if;
 select * into rights from school_class_permissions where class_id=c and user_id=auth.uid();
 if not found then return action in('lesson','answer','public_answer');end if;
 return case action when 'lesson' then rights.can_update_lessons when 'answer' then rights.can_answer_questions when 'public_answer' then rights.can_publish_class_answers else false end;
end$$;
drop policy lesson_write on school_lessons;
create policy lesson_write on school_lessons for all to authenticated using(can_school_action(class_id,'lesson')) with check(can_school_action(class_id,'lesson') and teacher_id=auth.uid());
drop policy question_answer on school_questions;
create policy question_answer on school_questions for update to authenticated using(can_school_action(class_id,'answer')) with check(can_school_action(class_id,'answer') and answered_by=auth.uid());
drop policy class_answer_write on school_class_answers;
create policy class_answer_write on school_class_answers for all to authenticated using(can_school_action(class_id,'public_answer')) with check(can_school_action(class_id,'public_answer') and teacher_id=auth.uid());
drop policy draft_teacher_only on school_ai_drafts;
create policy draft_teacher_only on school_ai_drafts for all to authenticated using(can_school_action(class_id,case kind when 'lesson' then 'lesson' else 'answer' end)) with check(can_school_action(class_id,case kind when 'lesson' then 'lesson' else 'answer' end) and teacher_id=auth.uid());
-- Managers control enrollment; classroom teachers cannot grant another user's access.
drop policy member_add on school_members;
drop policy member_remove on school_members;
create or replace function public.publish_school_answer(question_id uuid,answer_text text,class_wide boolean,class_question text default null) returns void language plpgsql security invoker set search_path=public as $$declare q school_questions%rowtype;begin
 select * into q from school_questions where id=publish_school_answer.question_id;
 if not found or not can_school_action(q.class_id,'answer') then raise exception 'Answer permission required';end if;
 if (class_wide or exists(select 1 from school_class_answers a where a.question_id=q.id)) and not can_school_action(q.class_id,'public_answer') then raise exception 'Class publication permission required';end if;
 if nullif(trim(answer_text),'') is null then raise exception 'Answer required';end if;
 update school_questions set approved_answer=answer_text,answered_by=auth.uid(),answered_at=now() where id=q.id;
 if class_wide then
  if nullif(trim(class_question),'') is null then raise exception 'Class question required';end if;
  insert into school_class_answers(question_id,class_id,subject,public_question,approved_answer,teacher_id) values(q.id,q.class_id,q.subject,class_question,answer_text,auth.uid()) on conflict on constraint school_class_answers_question_id_key do update set public_question=excluded.public_question,approved_answer=excluded.approved_answer,teacher_id=excluded.teacher_id,created_at=now();
 else delete from school_class_answers a where a.question_id=q.id;end if;
 delete from school_ai_drafts d where d.question_id=q.id;
end$$;
commit;

-- ===== management-analytics.sql =====
-- Run after registration-permissions.sql. Extends administration without logging message contents.
begin;
alter table school_profiles add column is_active boolean not null default true;
create function public.school_account_enabled() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select is_active from school_profiles where id=auth.uid()),false)$$;
create or replace function public.is_system_admin() returns boolean language sql stable security definer set search_path=public as $$select school_account_enabled() and coalesce(school_role(auth.uid())='admin',false)$$;
create or replace function public.is_school_manager(s uuid) returns boolean language sql stable security definer set search_path=public as $$select school_account_enabled() and (is_system_admin() or exists(select 1 from school_staff where school_id=s and user_id=auth.uid() and staff_role='manager'))$$;
create or replace function public.is_school_teacher(c uuid) returns boolean language sql stable security definer set search_path=public as $$select school_account_enabled() and (exists(select 1 from school_classes where id=c and owner_teacher_id=auth.uid()) or exists(select 1 from school_members where class_id=c and user_id=auth.uid() and member_role='teacher'))$$;
create or replace function public.can_read_school_class(c uuid) returns boolean language sql stable security definer set search_path=public as $$select school_account_enabled() and (is_school_teacher(c) or exists(select 1 from school_classes where id=c and is_school_manager(school_id)) or exists(select 1 from school_members where class_id=c and user_id=auth.uid()) or exists(select 1 from school_members m join school_guardians g on g.student_id=m.user_id where m.class_id=c and g.parent_id=auth.uid()))$$;
create or replace function public.can_read_student(s uuid) returns boolean language sql stable security definer set search_path=public as $$select school_account_enabled() and (s=auth.uid() or exists(select 1 from school_guardians where student_id=s and parent_id=auth.uid()))$$;
-- Restrictive policies apply even to author/self-read policies and prevent inactive tokens accessing data.
do $$declare tbl text;begin foreach tbl in array array['school_profiles','school_schools','school_classes','school_members','school_guardians','school_lessons','school_completions','school_questions','school_class_answers','school_ai_drafts','school_lesson_slots','school_family_subscriptions','school_staff','school_invitations','school_class_permissions'] loop execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using(public.school_account_enabled()) with check(public.school_account_enabled())',tbl);end loop;end$$;
create function public.set_school_account_active(target_user uuid,enabled boolean) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_system_admin() then raise exception 'System admin only';end if;
 if target_user=auth.uid() then raise exception 'Cannot disable your own account';end if;
 if school_role(target_user)='admin' then raise exception 'Admin accounts must be managed by the project owner';end if;
 update school_profiles set is_active=enabled where id=target_user;if not found then raise exception 'User not found';end if;
end$$;
create function public.school_account_directory(target_school uuid default null) returns table(user_id uuid,display_name text,role text,email text,is_active boolean,created_at timestamptz,last_sign_in_at timestamptz) language plpgsql security definer set search_path=public as $$begin
 if not is_system_admin() and (target_school is null or not is_school_manager(target_school)) then raise exception 'Not authorized';end if;
 return query select p.id,p.display_name,p.role,u.email::text,p.is_active,u.created_at,u.last_sign_in_at from school_profiles p join auth.users u on u.id=p.id where target_school is null or exists(select 1 from school_staff s where s.school_id=target_school and s.user_id=p.id) or exists(select 1 from school_members m join school_classes c on c.id=m.class_id where c.school_id=target_school and m.user_id=p.id) or exists(select 1 from school_guardians g join school_members m on m.user_id=g.student_id join school_classes c on c.id=m.class_id where c.school_id=target_school and g.parent_id=p.id) or exists(select 1 from school_classes c where c.school_id=target_school and c.owner_teacher_id=p.id) order by p.id;
end$$;
create table school_usage_events(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),school_id uuid references school_schools(id),class_id uuid references school_classes(id),action text not null check(action in('registered','signed_in','lesson_updated','completion_saved','question_asked','answer_published','ocr_used','transcription_used','ai_draft_used','resource_attached','photo_attached')),source text not null check(source in('server','client')),session_key uuid,recorded_at timestamptz not null default now());
create index school_usage_time on school_usage_events(school_id,recorded_at desc);
alter table school_usage_events enable row level security;
create policy usage_manager_read on school_usage_events for select to authenticated using(is_system_admin() or (school_id is not null and is_school_manager(school_id)));
create function public.record_school_usage(usage_action text,target_class uuid) returns void language plpgsql security definer set search_path=public as $$declare institution uuid;begin
 if not school_account_enabled() or not can_read_school_class(target_class) then raise exception 'Not authorized';end if;
 if usage_action not in('ocr_used','transcription_used','ai_draft_used') then raise exception 'Unsupported client event';end if;
 select school_id into institution from school_classes where id=target_class;
 insert into school_usage_events(actor_id,school_id,class_id,action,source) values(auth.uid(),institution,target_class,usage_action,'client');
end$$;
-- Database mutations are authoritative; client usage only measures browser-side feature completion.
create function public.log_school_data_usage() returns trigger language plpgsql security definer set search_path=public as $$declare event_class uuid;institution uuid;event_actor uuid;event_action text;begin
 if tg_table_name='school_lessons' then event_class:=new.class_id;event_actor:=new.teacher_id;event_action:='lesson_updated';
 elsif tg_table_name='school_completions' then event_actor:=new.student_id;select class_id into event_class from school_lessons where id=new.lesson_id;event_action:='completion_saved';
 elsif tg_table_name='school_questions' then event_class:=new.class_id;if tg_op='INSERT' then event_actor:=new.author_id;event_action:='question_asked';else if new.approved_answer is not distinct from old.approved_answer then return new;end if;event_actor:=new.answered_by;event_action:='answer_published';end if;
 end if;
 select school_id into institution from school_classes where id=event_class;
 insert into school_usage_events(actor_id,school_id,class_id,action,source) values(event_actor,institution,event_class,event_action,'server');return new;
end$$;
create trigger lesson_usage after insert or update on school_lessons for each row execute procedure log_school_data_usage();
create trigger completion_usage after insert or update on school_completions for each row execute procedure log_school_data_usage();
create trigger question_usage after insert or update on school_questions for each row execute procedure log_school_data_usage();
create function public.log_school_auth_usage() returns trigger language plpgsql security definer set search_path=public as $$declare action_name text;session_id uuid;institution uuid;begin
 if tg_op='INSERT' then action_name:='registered';else if new.last_sign_in_at is not distinct from old.last_sign_in_at then return new;end if;action_name:='signed_in';end if;
 session_id:=gen_random_uuid();insert into school_usage_events(actor_id,action,source,session_key) values(new.id,action_name,'server',session_id);
 for institution in select distinct scoped.school_id from (select s.school_id from school_staff s where s.user_id=new.id union select c.school_id from school_members m join school_classes c on c.id=m.class_id where m.user_id=new.id union select c.school_id from school_classes c where c.owner_teacher_id=new.id union select c.school_id from school_guardians g join school_members m on m.user_id=g.student_id join school_classes c on c.id=m.class_id where g.parent_id=new.id) scoped loop
 insert into school_usage_events(actor_id,school_id,action,source,session_key) values(new.id,institution,action_name,'server',session_id);
 end loop;return new;
end$$;
create trigger school_auth_usage after insert or update of last_sign_in_at on auth.users for each row execute procedure log_school_auth_usage();
create table school_notification_settings(school_id uuid primary key references school_schools(id),lesson_end_enabled boolean not null default true,parent_updates_enabled boolean not null default true,student_updates_enabled boolean not null default true);
alter table school_notification_settings enable row level security;
create policy notification_settings_read on school_notification_settings for select to authenticated using(school_account_enabled() and (is_school_manager(school_id) or exists(select 1 from school_classes c where c.school_id=school_notification_settings.school_id and can_read_school_class(c.id))));
create policy notification_settings_write on school_notification_settings for all to authenticated using(is_school_manager(school_id)) with check(is_school_manager(school_id));
revoke all on function public.set_school_account_active(uuid,boolean) from public;
revoke all on function public.school_account_directory(uuid) from public;
revoke all on function public.record_school_usage(text,uuid) from public;
grant execute on function public.set_school_account_active(uuid,boolean) to authenticated;
grant execute on function public.school_account_directory(uuid) to authenticated;
grant execute on function public.record_school_usage(text,uuid) to authenticated;
create or replace function public.accept_school_invitation(invitation_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare invite school_invitations%rowtype;user_email text;verified timestamptz;existing_role text;
begin
 if auth.uid() is null or not school_account_enabled() then raise exception 'Active account required';end if;
 select lower(email),email_confirmed_at into user_email,verified from auth.users where id=auth.uid();
 if verified is null then raise exception 'Confirm your email before accepting';end if;
 select * into invite from school_invitations where token=invitation_token for update;
 if not found or invite.status<>'pending' or invite.expires_at<=now() then raise exception 'Invitation expired or unavailable';end if;
 if invite.email<>user_email then raise exception 'Sign in with the invited email';end if;
 existing_role:=school_role(auth.uid());if existing_role not in('student',invite.invite_role) then raise exception 'Existing account role conflicts with invitation';end if;
 update school_profiles set role=invite.invite_role where id=auth.uid();
 if invite.invite_role in('teacher','manager') then
  insert into school_staff(school_id,user_id,staff_role) values(invite.school_id,auth.uid(),invite.invite_role) on conflict(school_id,user_id) do update set staff_role=excluded.staff_role;
  if invite.invite_role='teacher' and invite.class_id is not null then insert into school_members(class_id,user_id,member_role) values(invite.class_id,auth.uid(),'teacher') on conflict(class_id,user_id) do update set member_role='teacher';end if;
 elsif invite.invite_role='student' then
  if invite.class_id is null then raise exception 'Class required';end if;
  insert into school_members(class_id,user_id,member_role) values(invite.class_id,auth.uid(),'student') on conflict(class_id,user_id) do update set member_role='student';
 else
  if invite.student_id is null then raise exception 'Student link required';end if;
  insert into school_guardians(parent_id,student_id) values(auth.uid(),invite.student_id) on conflict do nothing;
 end if;
 update school_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
end$$;


create function public.school_usage_summary(target_school uuid,since_time timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 if not is_system_admin() and (target_school is null or not is_school_manager(target_school)) then raise exception 'Not authorized';end if;
 if since_time<now()-interval '366 days' then raise exception 'Range too large';end if;
 with selected as (select * from school_usage_events where recorded_at>=since_time and (target_school is null or school_id=target_school)),type_counts as (select action,count(distinct coalesce(session_key,id)) as count from selected group by action),daily as (select recorded_at::date as day,count(distinct coalesce(session_key,id)) as count from selected group by recorded_at::date)
 select jsonb_build_object('activeUsers',(select count(distinct actor_id) from selected),'logins',(select count(distinct coalesce(session_key,id)) from selected where action='signed_in'),'registrations',(select count(*) from school_account_directory(target_school) where created_at>=since_time),'totalAccounts',(select count(*) from school_account_directory(target_school)),'roleCounts',coalesce((select jsonb_agg(jsonb_build_object('role',role,'count',count)) from (select role,count(*) as count from school_account_directory(target_school) group by role) grouped),'[]'::jsonb),'types',coalesce((select jsonb_agg(jsonb_build_object('action',action,'count',count) order by count desc) from type_counts),'[]'::jsonb),'daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',count) order by day) from daily),'[]'::jsonb)) into result;return result;
end$$;
revoke all on function public.school_usage_summary(uuid,timestamptz) from public;
grant execute on function public.school_usage_summary(uuid,timestamptz) to authenticated;

create function public.log_school_attachment_usage() returns trigger language plpgsql security definer set search_path=public as $$declare field_name text;institution uuid;event_action text;begin
 select school_id into institution from school_classes where id=new.class_id;
 foreach field_name in array array['photos','resources'] loop
  if jsonb_typeof(new.published_content->field_name)='array' and jsonb_array_length(new.published_content->field_name)>0 and (tg_op='INSERT' or (new.published_content->field_name) is distinct from (old.published_content->field_name)) then
   event_action:=case field_name when 'photos' then 'photo_attached' else 'resource_attached' end;
   insert into school_usage_events(actor_id,school_id,class_id,action,source) values(new.teacher_id,institution,new.class_id,event_action,'server');
  end if;
 end loop;return new;
end$$;
create trigger attachment_usage after insert or update on school_lessons for each row execute procedure log_school_attachment_usage();

commit;
