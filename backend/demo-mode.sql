-- Demo sandbox. Run once, after managed-children.sql.
-- Four real accounts (parent, child, teacher, school manager) living inside ONE demo school, with normal RLS.
-- Nothing bypasses protections, and no demo account is a system admin, so real data stays out of reach.
--   Turn ON : select public.setup_demo('<password from dist/demo-config.js>');
--   Turn OFF: select public.set_demo_enabled(false);   -- accounts disabled + banned, site hides the demo buttons
--   Reset   : select public.seed_demo_data();           -- (demo users can also press "reset" in the demo bar)

create table public.app_settings(key text primary key,value jsonb not null);
alter table public.app_settings enable row level security; -- no policies: only the functions below read it
insert into public.app_settings values('demo_enabled','false'),('demo_last_reset','null');
alter table public.school_profiles add column is_demo boolean not null default false;

create function public.demo_status() returns boolean language sql stable security definer set search_path=public as $$
select coalesce((select value='true'::jsonb from app_settings where key='demo_enabled'),false)$$;
grant execute on function public.demo_status() to anon,authenticated;

create function public.demo_user_ids() returns uuid[] language sql immutable as $$
select array['de000000-0000-4000-8000-0000000000d1','de000000-0000-4000-8000-0000000000d2','de000000-0000-4000-8000-0000000000d3','de000000-0000-4000-8000-0000000000d4']::uuid[]$$;
revoke all on function public.demo_user_ids() from public,anon,authenticated;

-- Wipes everything the demo accounts own and rebuilds a fresh demo school for the current week.
create function public.seed_demo_data() returns void language plpgsql security definer set search_path=public as $$
declare
 v_parent uuid:='de000000-0000-4000-8000-0000000000d1';v_child uuid:='de000000-0000-4000-8000-0000000000d2';
 v_teacher uuid:='de000000-0000-4000-8000-0000000000d3';v_manager uuid:='de000000-0000-4000-8000-0000000000d4';
 v_maya uuid:='de000000-0000-4000-8000-0000000000d5';
 v_school uuid:='de000000-0000-4000-8000-000000000001';v_class1 uuid:='de000000-0000-4000-8000-000000000011';v_class2 uuid:='de000000-0000-4000-8000-000000000012';
 demo_ids uuid[]:=demo_user_ids();sch uuid[];cls uuid[];kids uuid[];
 week_start date:=current_date-extract(dow from current_date)::int;
 v_question uuid:=gen_random_uuid();d int;
begin
 if not exists(select 1 from school_profiles p where p.id=any(demo_ids)) then raise exception 'Run setup_demo first';end if;
 sch:=array(select s.id from school_schools s where s.owner_teacher_id=any(demo_ids) or s.id=v_school);
 cls:=array(select c.id from school_classes c where c.school_id=any(sch));
 kids:=array(select p.id from school_profiles p where p.managed_by=any(demo_ids) or p.id=v_maya);
 delete from school_ai_drafts x where x.class_id=any(cls);
 delete from school_class_answers x where x.class_id=any(cls);
 delete from school_questions x where x.class_id=any(cls) or x.student_id=any(kids) or x.author_id=any(demo_ids);
 delete from school_completions x where x.lesson_id in(select l.id from school_lessons l where l.class_id=any(cls)) or x.student_id=any(kids);
 delete from school_lessons x where x.class_id=any(cls);
 delete from school_lesson_slots x where x.class_id=any(cls);
 delete from school_join_requests x where x.class_id=any(cls) or x.student_id=any(kids);
 delete from school_class_join_codes x where x.class_id=any(cls);
 delete from school_class_permissions x where x.class_id=any(cls);
 delete from school_invitations x where x.school_id=any(sch);
 delete from school_usage_events x where x.school_id=any(sch) or x.class_id=any(cls);
 delete from school_members x where x.class_id=any(cls) or x.user_id=any(kids);
 delete from school_guardians x where x.parent_id=any(demo_ids) or x.student_id=any(demo_ids) or x.student_id=any(kids);
 delete from school_classes x where x.id=any(cls);
 delete from school_staff x where x.school_id=any(sch);
 delete from school_notification_settings x where x.school_id=any(sch);
 delete from school_schools x where x.id=any(sch);
 delete from school_family_subscriptions x where x.owner_parent_id=any(demo_ids);
 delete from school_role_requests x where x.user_id=any(demo_ids);
 delete from school_profiles x where x.id=any(kids);

 insert into school_schools(id,name,owner_teacher_id) values(v_school,'בית ספר הדגמה',v_teacher);
 insert into school_staff(school_id,user_id,staff_role) values(v_school,v_teacher,'teacher'),(v_school,v_manager,'manager');
 insert into school_classes(id,name,school_id,owner_teacher_id) values(v_class1,'ד׳1',v_school,v_teacher),(v_class2,'ד׳2',v_school,v_teacher);
 insert into school_members(class_id,user_id,member_role) values(v_class1,v_teacher,'teacher'),(v_class2,v_teacher,'teacher'),(v_class1,v_child,'student');
 insert into school_profiles(id,display_name,role,managed_by,is_demo) values(v_maya,'מאיה (דמו, ללא אימייל)','student',v_parent,true);
 insert into school_members(class_id,user_id,member_role) values(v_class2,v_maya,'student');
 insert into school_guardians(parent_id,student_id) values(v_parent,v_child),(v_parent,v_maya);
 insert into school_class_join_codes(class_id,code,created_by) values(v_class1,'DEMOCLASS1',v_teacher);

 for d in 0..4 loop
  insert into school_lessons(class_id,subject,lesson_date,teacher_id,due_at,published_content) values
  (v_class1,'חשבון',week_start+d,v_teacher,(week_start+d+1)::timestamp+interval '8 hours',jsonb_build_object('subject','חשבון','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+d+1)::text,'dueTime','08:00','day',(week_start+d)::text,'details','עמוד '||(40+d)||' בחוברת — תרגילים 1–6. שימו לב לדרך הפתרון.','lesson',jsonb_build_object('topic','שברים','summary','חיבור וחיסור שברים עם מכנה משותף.','concepts','מונה, מכנה, שבר'))),
  (v_class1,'עברית',week_start+d,v_teacher,(week_start+d+1)::timestamp+interval '8 hours',jsonb_build_object('subject','עברית','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+d+1)::text,'dueTime','08:00','day',(week_start+d)::text,'details','לקרוא את הסיפור ״חברים בדרך״ ולענות על שאלות 1–3 במחברת.')),
  (v_class1,'אנגלית',week_start+d,v_teacher,null,jsonb_build_object('subject','אנגלית','teacher','מיכל כהן (דמו)','kind','none','due',(week_start+d)::text,'dueTime','08:00','day',(week_start+d)::text));
 end loop;
 insert into school_lessons(class_id,subject,lesson_date,teacher_id,due_at,published_content) values
 (v_class2,'חשבון',week_start+2,v_teacher,(week_start+3)::timestamp+interval '8 hours',jsonb_build_object('subject','חשבון','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+3)::text,'dueTime','08:00','day',(week_start+2)::text,'details','תרגילי כפל בעמוד 12.'));
 insert into school_completions(lesson_id,student_id,completed_at) select l.id,v_child,now() from school_lessons l where l.class_id=v_class1 and l.subject='עברית' and l.lesson_date<=current_date limit 2;
 insert into school_questions(id,class_id,author_id,subject,question,approved_answer,answered_by,answered_at,student_id) values
 (v_question,v_class1,v_parent,'חשבון','לא הבנתי באיזה עמוד צריך לפתור את התרגילים',E'העמוד מופיע בהוראות המשימה. אפשר להתחיל מתרגיל 1.',v_teacher,now(),v_child);
 insert into school_class_answers(question_id,subject,class_id,public_question,approved_answer,teacher_id) values(v_question,'חשבון',v_class1,'באיזה עמוד התרגילים?',E'העמוד מופיע בהוראות המשימה. אפשר להתחיל מתרגיל 1.',v_teacher);
 insert into school_questions(class_id,author_id,subject,question,student_id) values(v_class1,v_parent,'עברית','האם צריך לכתוב את התשובות במחברת או להקליד?',v_child);
 update app_settings s set value=to_jsonb(now()) where s.key='demo_last_reset';
end$$;
revoke all on function public.seed_demo_data() from public,anon,authenticated;

create function public.setup_demo(demo_password text) returns void language plpgsql security definer set search_path=public,extensions as $$
declare u record;
begin
 if length(coalesce(demo_password,''))<8 then raise exception 'Password must be at least 8 characters';end if;
 for u in select * from(values
  ('de000000-0000-4000-8000-0000000000d1'::uuid,'demo-parent@nohomework-demo.test','הורה דמו','parent'),
  ('de000000-0000-4000-8000-0000000000d2','demo-child@nohomework-demo.test','ילד דמו','student'),
  ('de000000-0000-4000-8000-0000000000d3','demo-teacher@nohomework-demo.test','מורה דמו','teacher'),
  ('de000000-0000-4000-8000-0000000000d4','demo-manager@nohomework-demo.test','מנהל דמו','manager')) as t(id,email,name,role)
 loop
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  values('00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,crypt(demo_password,gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('display_name',u.name),now(),now(),'','','','')
  on conflict(id) do update set encrypted_password=excluded.encrypted_password;
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values(gen_random_uuid(),u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',now(),now(),now())
  on conflict do nothing;
  update school_profiles set role=u.role,display_name=u.name,is_demo=true,is_active=true where id=u.id;
 end loop;
 perform seed_demo_data();
 update app_settings set value='true' where key='demo_enabled';
end$$;
revoke all on function public.setup_demo(text) from public,anon,authenticated;

-- The kill switch. Off: demo accounts are deactivated (RLS blocks every table) and cannot sign in.
create function public.set_demo_enabled(on_off boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 update app_settings set value=to_jsonb(on_off) where key='demo_enabled';
 update school_profiles set is_active=on_off where id=any(demo_user_ids()) or is_demo;
 update auth.users set banned_until=case when on_off then null else 'infinity'::timestamptz end where id=any(demo_user_ids());
end$$;
revoke all on function public.set_demo_enabled(boolean) from public,anon,authenticated;

-- "Reset demo" button: any signed-in demo account, at most once every 20 seconds.
create function public.reset_demo_data() returns void language plpgsql security definer set search_path=public as $$
declare last_reset timestamptz;
begin
 if not demo_status() or not exists(select 1 from school_profiles where id=auth.uid() and is_demo and is_active) then raise exception 'Demo only';end if;
 select (value#>>'{}')::timestamptz into last_reset from app_settings where key='demo_last_reset' and value<>'null'::jsonb;
 if last_reset is not null and last_reset>now()-interval '20 seconds' then return;end if;
 perform seed_demo_data();
end$$;
revoke all on function public.reset_demo_data() from public,anon;
grant execute on function public.reset_demo_data() to authenticated;
