-- Run once, after role-requests.sql.
-- Children without an email: a parent creates a managed child profile (no sign-in, no email).
-- The child joins a class with a code from the teacher; the teacher approves the request.

-- 1. Profiles may exist without an auth user (managed children). Real accounts still get one profile each.
alter table public.school_profiles drop constraint school_profiles_id_fkey;
alter table public.school_profiles add column managed_by uuid references public.school_profiles(id) on delete cascade;
create function public.delete_school_profile() returns trigger language plpgsql security definer set search_path=public as $$begin delete from school_profiles where id=old.id;return old;end$$;
create trigger school_user_deleted after delete on auth.users for each row execute procedure public.delete_school_profile();

-- 2. Acting for a managed child (only its parent, only profiles flagged managed_by that parent).
create function public.can_act_for_student(s uuid) returns boolean language sql stable security definer set search_path=public as $$
select s=auth.uid() or (exists(select 1 from school_profiles where id=s and managed_by=auth.uid()) and exists(select 1 from school_guardians where parent_id=auth.uid() and student_id=s))$$;
drop policy completion_write on public.school_completions;
create policy completion_write on public.school_completions for all to authenticated
 using(can_act_for_student(student_id))
 with check(can_act_for_student(student_id) and school_role(student_id)='student' and exists(select 1 from school_lessons l join school_members m on m.class_id=l.class_id where l.id=lesson_id and m.user_id=school_completions.student_id and m.member_role='student'));

-- 3. Parent creates a child by name (max four children, enforced by the existing guardian trigger).
create function public.create_managed_child(child_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid:=gen_random_uuid();nm text:=trim(coalesce(child_name,''));
begin
 if school_role(auth.uid())<>'parent' then raise exception 'Parent only';end if;
 if nm='' or length(nm)>80 then raise exception 'Name required (up to 80 characters)';end if;
 insert into school_profiles(id,display_name,role,managed_by) values(cid,nm,'student',auth.uid());
 insert into school_guardians(parent_id,student_id) values(auth.uid(),cid);
 return cid;
end$$;

-- 4. Class join codes (teacher side) and join requests (parent side).
create table public.school_class_join_codes(
 class_id uuid primary key references public.school_classes(id) on delete cascade,
 code text not null unique,
 created_by uuid not null default auth.uid() references public.school_profiles(id),
 created_at timestamptz not null default now());
create table public.school_join_requests(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.school_classes(id) on delete cascade,
 student_id uuid not null references public.school_profiles(id) on delete cascade,
 requested_by uuid not null references public.school_profiles(id),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_by uuid references public.school_profiles(id),
 decided_at timestamptz,
 unique(class_id,student_id));
alter table public.school_class_join_codes enable row level security;
alter table public.school_join_requests enable row level security;
create function public.can_manage_class_join(c uuid) returns boolean language sql stable security definer set search_path=public as $$
select is_school_teacher(c) or exists(select 1 from school_classes where id=c and is_school_manager(school_id))$$;
create policy join_code_read on public.school_class_join_codes for select to authenticated using(can_manage_class_join(class_id));
create policy join_request_read on public.school_join_requests for select to authenticated using(requested_by=auth.uid() or can_manage_class_join(class_id));

create function public.create_class_join_code(target_class uuid) returns text language plpgsql security definer set search_path=public as $$
declare new_code text:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
begin
 if not can_manage_class_join(target_class) then raise exception 'Not authorized';end if;
 insert into school_class_join_codes(class_id,code) values(target_class,new_code) on conflict(class_id) do update set code=excluded.code,created_by=auth.uid(),created_at=now();
 return new_code;
end$$;

create function public.request_class_join(child uuid,join_code text) returns text language plpgsql security definer set search_path=public as $$
declare cls uuid;cname text;
begin
 if child=auth.uid() or not can_act_for_student(child) then raise exception 'Not authorized';end if;
 select c.id,c.name into cls,cname from school_class_join_codes j join school_classes c on c.id=j.class_id where j.code=upper(trim(coalesce(join_code,'')));
 if cls is null then raise exception 'Invalid class code';end if;
 if exists(select 1 from school_members where class_id=cls and user_id=child) then raise exception 'Already in this class';end if;
 insert into school_join_requests(class_id,student_id,requested_by) values(cls,child,auth.uid())
  on conflict(class_id,student_id) do update set status='pending',requested_by=auth.uid(),created_at=now(),decided_by=null,decided_at=null;
 return cname;
end$$;

create function public.decide_class_join_request(request_id uuid,approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare req school_join_requests%rowtype;
begin
 select * into req from school_join_requests where id=request_id and status='pending' for update;
 if not found then raise exception 'No pending request';end if;
 if not can_manage_class_join(req.class_id) then raise exception 'Not authorized';end if;
 if approve then insert into school_members(class_id,user_id,member_role) values(req.class_id,req.student_id,'student') on conflict(class_id,user_id) do nothing;end if;
 update school_join_requests set status=case when approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where id=request_id;
end$$;

revoke all on function public.create_managed_child(text),public.create_class_join_code(uuid),public.request_class_join(uuid,text),public.decide_class_join_request(uuid,boolean) from public;
grant execute on function public.create_managed_child(text),public.create_class_join_code(uuid),public.request_class_join(uuid,text),public.decide_class_join_request(uuid,boolean) to authenticated;

-- 5. Usage events must reference a real account: a managed child's action is recorded as the parent's.
create or replace function public.log_school_data_usage() returns trigger language plpgsql security definer set search_path=public as $$declare event_class uuid;institution uuid;event_actor uuid;event_action text;begin
 if tg_table_name='school_lessons' then event_class:=new.class_id;event_actor:=new.teacher_id;event_action:='lesson_updated';
 elsif tg_table_name='school_completions' then event_actor:=coalesce(auth.uid(),new.student_id);select class_id into event_class from school_lessons where id=new.lesson_id;event_action:='completion_saved';
 elsif tg_table_name='school_questions' then event_class:=new.class_id;if tg_op='INSERT' then event_actor:=new.author_id;event_action:='question_asked';else if new.approved_answer is not distinct from old.approved_answer then return new;end if;event_actor:=new.answered_by;event_action:='answer_published';end if;
 end if;
 select school_id into institution from school_classes where id=event_class;
 insert into school_usage_events(actor_id,school_id,class_id,action,source) values(event_actor,institution,event_class,event_action,'server');return new;
end$$;
