-- Paste into the Supabase SQL Editor and run once: updates the demo seed and rebuilds the demo data.
create or replace function public.seed_demo_data() returns void language plpgsql security definer set search_path=public as $$
declare
 v_parent uuid:='de000000-0000-4000-8000-0000000000d1';v_child uuid:='de000000-0000-4000-8000-0000000000d2';
 v_teacher uuid:='de000000-0000-4000-8000-0000000000d3';v_manager uuid:='de000000-0000-4000-8000-0000000000d4';
 v_maya uuid:='de000000-0000-4000-8000-0000000000d5';
 v_school uuid:='de000000-0000-4000-8000-000000000001';v_class1 uuid:='de000000-0000-4000-8000-000000000011';v_class2 uuid:='de000000-0000-4000-8000-000000000012';
 v_school2 uuid:='de000000-0000-4000-8000-000000000002';v_class3 uuid:='de000000-0000-4000-8000-000000000013';
 demo_ids uuid[]:=demo_user_ids();sch uuid[];cls uuid[];kids uuid[];
 week_start date:=current_date-extract(dow from current_date)::int;
 v_question uuid:=gen_random_uuid();d int;
begin
 if not exists(select 1 from school_profiles p where p.id=any(demo_ids)) then raise exception 'Run setup_demo first';end if;
 sch:=array(select s.id from school_schools s where s.owner_teacher_id=any(demo_ids) or s.id in(v_school,v_school2));
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
 -- a second school: the same teacher teaches there too, and Maya (and the demo child) study in more than one class
 insert into school_schools(id,name,owner_teacher_id) values(v_school2,'בית ספר הדגמה ב׳',v_teacher);
 insert into school_staff(school_id,user_id,staff_role) values(v_school2,v_teacher,'teacher');
 insert into school_classes(id,name,school_id,owner_teacher_id) values(v_class3,'ד׳3',v_school2,v_teacher);
 insert into school_members(class_id,user_id,member_role) values(v_class3,v_teacher,'teacher'),(v_class3,v_maya,'student'),(v_class2,v_child,'student');
 insert into school_class_join_codes(class_id,code,created_by) values(v_class1,'DEMOCLASS1',v_teacher);

 for d in 0..5 loop
  insert into school_lessons(class_id,subject,lesson_date,teacher_id,due_at,published_content) values
  (v_class1,'חשבון',week_start+d,v_teacher,(week_start+d+1)::timestamp+interval '8 hours',jsonb_build_object('subject','חשבון','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+d+1)::text,'dueTime','08:00','day',(week_start+d)::text,'details','עמוד '||(40+d)||' בחוברת — תרגילים 1–6. שימו לב לדרך הפתרון.','lesson',jsonb_build_object('topic','שברים','summary','חיבור וחיסור שברים עם מכנה משותף.','concepts','מונה, מכנה, שבר'))),
  (v_class1,'עברית',week_start+d,v_teacher,(week_start+d+1)::timestamp+interval '8 hours',jsonb_build_object('subject','עברית','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+d+1)::text,'dueTime','08:00','day',(week_start+d)::text,'details','לקרוא את הסיפור ״חברים בדרך״ ולענות על שאלות 1–3 במחברת.')),
  (v_class1,'אנגלית',week_start+d,v_teacher,null,jsonb_build_object('subject','אנגלית','teacher','מיכל כהן (דמו)','kind','none','due',(week_start+d)::text,'dueTime','08:00','day',(week_start+d)::text));
 end loop;
 insert into school_lessons(class_id,subject,lesson_date,teacher_id,due_at,published_content) values
 (v_class2,'חשבון',week_start+2,v_teacher,(week_start+3)::timestamp+interval '8 hours',jsonb_build_object('subject','חשבון','teacher','מיכל כהן (דמו)','kind','task','due',(week_start+3)::text,'dueTime','08:00','day',(week_start+2)::text,'details','תרגילי כפל בעמוד 12.'));
 insert into school_lessons(class_id,subject,lesson_date,teacher_id,due_at,published_content) values
 (v_class3,'מדעים',week_start+1,v_teacher,null,jsonb_build_object('subject','מדעים','teacher','מיכל כהן (דמו)','kind','none','due',(week_start+1)::text,'dueTime','08:00','day',(week_start+1)::text));
 if to_regclass('public.school_timetable') is not null then
  for d in 0..5 loop
   insert into school_timetable(class_id,weekday,start_time,end_time,subject,created_by) values
   (v_class1,d,'08:30','09:15','חשבון',v_teacher),(v_class1,d,'09:30','10:15','עברית',v_teacher),(v_class1,d,'10:45','11:30','אנגלית',v_teacher);
  end loop;
  insert into school_timetable(class_id,weekday,start_time,end_time,subject,created_by) values
  (v_class2,2,'08:30','09:15','חשבון',v_teacher),(v_class3,1,'08:30','09:15','מדעים',v_teacher);
 end if;
 insert into school_completions(lesson_id,student_id,completed_at) select l.id,v_child,now() from school_lessons l where l.class_id=v_class1 and l.subject='עברית' and l.lesson_date<=current_date limit 2;
 insert into school_questions(id,class_id,author_id,subject,question,approved_answer,answered_by,answered_at,student_id) values
 (v_question,v_class1,v_parent,'חשבון','לא הבנתי באיזה עמוד צריך לפתור את התרגילים',E'העמוד מופיע בהוראות המשימה. אפשר להתחיל מתרגיל 1.',v_teacher,now(),v_child);
 insert into school_class_answers(question_id,subject,class_id,public_question,approved_answer,teacher_id) values(v_question,'חשבון',v_class1,'באיזה עמוד התרגילים?',E'העמוד מופיע בהוראות המשימה. אפשר להתחיל מתרגיל 1.',v_teacher);
 insert into school_questions(class_id,author_id,subject,question,student_id) values(v_class1,v_parent,'עברית','האם צריך לכתוב את התשובות במחברת או להקליד?',v_child);
 update app_settings s set value=to_jsonb(now()) where s.key='demo_last_reset';
end$$;

select public.seed_demo_data();
