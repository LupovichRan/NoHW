-- Who may add whom. Run once, after timetable.sql (or after managed-children.sql).
--   admin          : everything; creates schools, invites school managers (existing policies)
--   school manager : in their school invites teachers, parents, students; creates classes (existing policies)
--   teacher        : invites parents and students of their own classes (added here); cannot create schools or classes
--   parent         : adds children (create_managed_child, existing)
-- Teachers' invitations are additive policies: the manager/admin policy stays exactly as it was.
create policy invitation_create_teacher on public.school_invitations for insert to authenticated
 with check(created_by=auth.uid() and status='pending' and accepted_by is null and accepted_at is null
  and invite_role in('parent','student') and class_id is not null and is_school_teacher(class_id)
  and exists(select 1 from school_classes c where c.id=class_id and c.school_id=school_invitations.school_id)
  and (invite_role<>'parent' or (student_id is not null and exists(select 1 from school_members m where m.class_id=school_invitations.class_id and m.user_id=student_id and m.member_role='student'))));
-- A creator can read (and so get the token of) the invitations they made.
create policy invitation_creator_read on public.school_invitations for select to authenticated using(created_by=auth.uid());
-- ... and revoke them (managers/admins still revoke any invitation of their school).
create or replace function public.revoke_school_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare s uuid;c uuid;begin
 select school_id,created_by into s,c from school_invitations where id=invitation_id;
 if not found or not (is_school_manager(s) or c=auth.uid()) then raise exception 'Not authorized';end if;
 update school_invitations set status='revoked' where id=invitation_id and status='pending';
end$$;
