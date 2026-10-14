-- Run once, after all-in-one.sql (or after management-analytics.sql).
-- Registration may REQUEST a role; only a system admin can grant it. Clients cannot insert/update requests.
create table public.school_role_requests(
 user_id uuid primary key references public.school_profiles(id) on delete cascade,
 requested_role text not null check(requested_role in('parent','teacher','manager')),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 decided_by uuid references public.school_profiles(id),
 decided_at timestamptz
);
alter table public.school_role_requests enable row level security;
create policy role_request_read on public.school_role_requests for select to authenticated using(user_id=auth.uid() or is_system_admin());

-- A request is recorded from the sign-up metadata. The profile is still created as a student.
create or replace function public.create_school_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare wanted text:=new.raw_user_meta_data->>'requested_role';
begin
 insert into school_profiles(id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'משתמש חדש'));
 if wanted in('parent','teacher','manager') then
  insert into school_role_requests(user_id,requested_role) values(new.id,wanted) on conflict(user_id) do nothing;
 end if;
 return new;
end$$;

create function public.decide_school_role_request(target_user uuid,approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare req school_role_requests%rowtype;
begin
 if not is_system_admin() then raise exception 'System admin only';end if;
 select * into req from school_role_requests where user_id=target_user and status='pending' for update;
 if not found then raise exception 'No pending request';end if;
 if approve then perform set_school_user_role(target_user,req.requested_role);end if;
 update school_role_requests set status=case when approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where user_id=target_user;
end$$;
revoke all on function public.decide_school_role_request(uuid,boolean) from public;
grant execute on function public.decide_school_role_request(uuid,boolean) to authenticated;

-- If the role is granted another way (e.g. an accepted invitation), close the matching pending request.
create function public.close_matching_role_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update school_role_requests set status='approved',decided_at=now() where user_id=new.id and status='pending' and requested_role=new.role;
 return new;
end$$;
create trigger school_role_changed after update of role on public.school_profiles for each row when (old.role is distinct from new.role) execute procedure public.close_matching_role_request();
