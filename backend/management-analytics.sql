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
