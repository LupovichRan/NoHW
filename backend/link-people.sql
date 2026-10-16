-- Link an existing student or teacher to an additional class (any school). Run after permissions-hierarchy.sql.
--   admin / school manager : link a student or a teacher to a class of a school they manage
--   teacher                : link a student they can already see (their own classes) to another class of theirs
-- A student may belong to several classes and schools; a teacher to several classes and schools.
create or replace function public.entity_code(id uuid) returns text language plpgsql immutable as $$
declare h bigint:=0; s text:=id::text; i int;
begin for i in 1..length(s) loop h:=(h*31+ascii(substr(s,i,1))) % 4294967296; end loop; return lpad((h%1000)::text,3,'0'); end$$;

create or replace function public.link_person_to_class(p_person uuid,p_class uuid) returns void language plpgsql security definer set search_path=public as $$
declare r text; sch uuid; ok boolean:=false;
begin
 select school_role(p_person) into r; select school_id into sch from school_classes where id=p_class;
 if r not in('student','teacher') or sch is null then raise exception 'invalid person or class'; end if;
 if r='teacher' then ok:=is_school_manager(sch);
 else ok:=is_school_manager(sch) or (is_school_teacher(p_class) and exists(select 1 from school_members m where m.user_id=p_person and m.member_role='student' and is_school_teacher(m.class_id))); end if;
 if not ok then raise exception 'not allowed to link this person'; end if;
 insert into school_members(class_id,user_id,member_role) values(p_class,p_person,r) on conflict(class_id,user_id) do nothing;
 if r='teacher' then insert into school_staff(school_id,user_id,staff_role) values(sch,p_person,'teacher') on conflict do nothing; end if;
end$$;
revoke all on function public.link_person_to_class(uuid,uuid) from public,anon;
grant execute on function public.link_person_to_class(uuid,uuid) to authenticated;
