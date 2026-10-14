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
