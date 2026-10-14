-- Run after supabase-schema.sql. No payment provider is connected yet.
-- Membership clients may read; trial timestamps and billing statuses are server-only.
create table public.school_family_subscriptions (
 owner_parent_id uuid primary key references public.school_profiles(id),
 status text not null default 'trialing' check(status in('trialing','active','past_due','canceled')),
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now()+interval '3 months'),
 monthly_agorot integer not null default 990 check(monthly_agorot>=0),
 currency text not null default 'ILS' check(currency='ILS'),
 current_period_end timestamptz,
 provider_customer_id text,
 provider_subscription_id text
);
alter table public.school_family_subscriptions enable row level security;
create policy family_plan_read on public.school_family_subscriptions for select to authenticated using(owner_parent_id=auth.uid() or exists(select 1 from public.school_guardians g where g.parent_id=owner_parent_id and g.student_id=auth.uid()));
create function public.start_family_trial() returns trigger language plpgsql security definer set search_path=public as $$begin
 if school_role(new.parent_id) <> 'parent' or school_role(new.student_id) <> 'student' then raise exception 'Parent and student roles required';end if;
 insert into school_family_subscriptions(owner_parent_id) values(new.parent_id) on conflict(owner_parent_id) do nothing;
 return new;
end$$;
create trigger first_child_starts_trial after insert on public.school_guardians for each row execute procedure public.start_family_trial();
-- Existing linked families receive one shared trial, not a separate trial per child.
insert into public.school_family_subscriptions(owner_parent_id) select distinct parent_id from public.school_guardians where school_role(parent_id)='parent' on conflict(owner_parent_id) do nothing;
-- No client INSERT/UPDATE/DELETE policy: the browser cannot reset a trial or mark a subscription paid.
-- Paid statuses must be updated by a verified, idempotent payment-provider webhook.
-- Access enforcement remains off until checkout and webhook verification are implemented.

-- Serialize enrollment per parent to enforce the four-child limit under concurrency.
create function public.enforce_four_child_limit() returns trigger language plpgsql security definer set search_path=public as $$
declare linked integer;
begin
 perform 1 from school_profiles where id=new.parent_id for update;
 if tg_op='UPDATE' then
  select count(*) into linked from school_guardians where parent_id=new.parent_id and not(parent_id=old.parent_id and student_id=old.student_id);
 else select count(*) into linked from school_guardians where parent_id=new.parent_id; end if;
 if linked>=4 then raise exception 'A family subscription supports at most four children'; end if;
 return new;
end$$;
create trigger family_four_child_limit before insert or update of parent_id,student_id on public.school_guardians for each row execute procedure public.enforce_four_child_limit();
