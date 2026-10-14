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
