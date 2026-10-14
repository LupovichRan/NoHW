-- Run after admin-invitations.sql and role-management.sql.
begin;
alter table school_invitations drop constraint if exists school_invitations_invite_role_check;
alter table school_invitations add constraint school_invitations_invite_role_check check(invite_role in('teacher','parent','manager','student'));
drop policy invitation_create on school_invitations;
create policy invitation_create on school_invitations for insert to authenticated with check(created_by=auth.uid() and status='pending' and accepted_by is null and accepted_at is null and is_school_manager(school_id) and (invite_role<>'manager' or is_system_admin()) and (class_id is null or exists(select 1 from school_classes c where c.id=class_id and c.school_id=school_invitations.school_id)) and (invite_role<>'student' or class_id is not null) and (invite_role<>'parent' or (student_id is not null and exists(select 1 from school_members m join school_classes c on c.id=m.class_id where m.user_id=student_id and m.member_role='student' and c.school_id=school_invitations.school_id))));
create or replace function public.accept_school_invitation(invitation_token uuid) returns void language plpgsql security definer set search_path=public as $$
declare invite school_invitations%rowtype;user_email text;verified timestamptz;current_role text;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select lower(email),email_confirmed_at into user_email,verified from auth.users where id=auth.uid();
 if verified is null then raise exception 'Confirm your email before accepting';end if;
 select * into invite from school_invitations where token=invitation_token for update;
 if not found or invite.status<>'pending' or invite.expires_at<=now() then raise exception 'Invitation expired or unavailable';end if;
 if invite.email<>user_email then raise exception 'Sign in with the invited email';end if;
 current_role:=school_role(auth.uid());if current_role not in('student',invite.invite_role) then raise exception 'Existing account role conflicts with invitation';end if;
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
