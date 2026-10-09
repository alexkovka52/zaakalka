-- Run once in Supabase SQL Editor. All user-owned tables enforce RLS.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', avatar_url text, age integer check (age between 13 and 110), sex text,
  height numeric(5,1) check (height between 80 and 260), weight numeric(5,1) check (weight between 25 and 400),
  goal text, level text, training_experience text, max_pullups integer not null default 0 check(max_pullups>=0),
  max_pushups integer not null default 0 check(max_pushups>=0), max_dips integer not null default 0 check(max_dips>=0),
  equipment text[] not null default '{}', training_frequency integer not null default 3 check(training_frequency between 1 and 7),
  language text not null default 'ru' check(language in ('ru','en','ro')), onboarding_completed boolean not null default false,
  protein_goal integer not null default 120 check(protein_goal between 1 and 500), nutrition_goal text, allergies text, dietary_restrictions text,
  xp integer not null default 0 check(xp between 0 and 999), current_level integer not null default 1 check(current_level>=1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Upper body', started_at timestamptz not null default now(), finished_at timestamptz,
  duration integer check(duration is null or duration>=0), xp_earned integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, started_at desc);
create unique index if not exists workout_one_active_per_user on public.workout_sessions(user_id) where finished_at is null;

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(), workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null, sets integer not null default 1 check(sets between 1 and 100), reps integer not null default 1 check(reps between 1 and 500),
  weight numeric(7,2) check(weight is null or weight>=0), duration integer check(duration is null or duration>=0), notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date, name text not null, protein numeric(7,2) not null default 0 check(protein>=0),
  fats numeric(7,2) not null default 0 check(fats>=0), carbs numeric(7,2) not null default 0 check(carbs>=0),
  calories numeric(8,2) not null default 0 check(calories>=0), image_url text, ai_analysis text,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals(user_id, date desc);

create table if not exists public.daily_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date, workout_completed boolean not null default false, protein_completed boolean not null default false,
  water_completed boolean not null default false, daily_goal_completed boolean not null default false, water_ml integer not null default 0 check(water_ml between 0 and 20000),
  xp_earned integer not null default 0, awarded_goals text[] not null default '{}',
  unique(user_id,date)
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, value text not null, xp integer not null default 0, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists activity_user_date_idx on public.activity_history(user_id, created_at desc);

create table if not exists public.user_dashboard_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  block_order text[] not null default array['workout','nutrition','water','goals','quote','weekly'], hidden_blocks text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 12000), created_at timestamptz not null default now()
);
create index if not exists ai_messages_user_date_idx on public.ai_messages(user_id, created_at desc);

create or replace function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id,name) values(new.id, coalesce(new.raw_user_meta_data->>'name','')) on conflict(user_id) do nothing;
  insert into public.user_dashboard_settings(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end; $$;
drop trigger if exists auth_user_profile_bootstrap on auth.users;
create trigger auth_user_profile_bootstrap after insert on auth.users for each row execute function public.on_auth_user_created();

create or replace function public.award_xp(p_user uuid, p_amount integer, p_type text, p_value text, p_metadata jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$
declare v_total integer; v_levels integer;
begin
  if p_amount<=0 then return; end if;
  update public.profiles set xp=xp+p_amount, current_level=current_level+((xp+p_amount)/1000), xp=(xp+p_amount)%1000, updated_at=now()
  where user_id=p_user returning current_level into v_levels;
  insert into public.activity_history(user_id,type,value,xp,metadata) values(p_user,p_type,p_value,p_amount,p_metadata);
end; $$;

revoke all on function public.award_xp(uuid,integer,text,text,jsonb) from public, anon, authenticated;
create or replace function public.maybe_award_daily(p_user uuid,p_date date) returns void language plpgsql security definer set search_path=public as $$
declare g public.daily_goals;
begin
  select * into g from public.daily_goals where user_id=p_user and date=p_date for update;
  if found and g.workout_completed and g.protein_completed and g.water_completed and not ('daily'=any(g.awarded_goals)) then
    update public.daily_goals set daily_goal_completed=true,awarded_goals=array_append(awarded_goals,'daily'),xp_earned=xp_earned+30 where id=g.id;
    perform public.award_xp(p_user,30,'goal','All daily goals',jsonb_build_object('date',p_date));
  end if;
end; $$;
revoke all on function public.maybe_award_daily(uuid,date) from public, anon, authenticated;

create or replace function public.finish_workout(p_session uuid) returns public.workout_sessions language plpgsql security definer set search_path=public as $$
declare v public.workout_sessions; v_user uuid:=auth.uid(); v_duration integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v from public.workout_sessions where id=p_session and user_id=v_user for update;
  if not found then raise exception 'Workout not found'; end if;
  if v.finished_at is not null then return v; end if;
  v_duration:=greatest(0,floor(extract(epoch from (now()-v.started_at)))::integer);
  update public.workout_sessions set finished_at=now(),duration=v_duration,xp_earned=20 where id=p_session returning * into v;
  perform public.award_xp(v_user,20,'workout',v.name,jsonb_build_object('session_id',p_session,'duration',v_duration));
  insert into public.daily_goals(user_id,date,workout_completed) values(v_user,current_date,true)
  on conflict(user_id,date) do update set workout_completed=true;
  perform public.maybe_award_daily(v_user,current_date);
  return v;
end; $$;

create or replace function public.change_water(p_delta integer) returns public.daily_goals language plpgsql security definer set search_path=public as $$
declare v public.daily_goals; v_user uuid:=auth.uid(); v_target integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  insert into public.daily_goals(user_id,date) values(v_user,current_date) on conflict(user_id,date) do nothing;
  select * into v from public.daily_goals where user_id=v_user and date=current_date for update;
  update public.daily_goals set water_ml=greatest(0,least(20000,water_ml+p_delta)) where id=v.id returning * into v;
  v_target:=2000;
  if v.water_ml>=v_target and not ('water'=any(v.awarded_goals)) then
    update public.daily_goals set water_completed=true,awarded_goals=array_append(awarded_goals,'water'),xp_earned=xp_earned+10 where id=v.id returning * into v;
    perform public.award_xp(v_user,10,'goal','Water goal',jsonb_build_object('date',current_date));
  else
    update public.daily_goals set water_completed=(water_ml>=v_target) where id=v.id returning * into v;
  end if;
  perform public.maybe_award_daily(v_user,current_date);
  return v;
end; $$;

create or replace function public.complete_daily_goal(p_goal text) returns public.daily_goals language plpgsql security definer set search_path=public as $$
declare v public.daily_goals; v_user uuid:=auth.uid(); v_amount integer; v_label text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_goal not in ('workout','protein','water') then raise exception 'Invalid goal'; end if;
  insert into public.daily_goals(user_id,date) values(v_user,current_date) on conflict(user_id,date) do nothing;
  select * into v from public.daily_goals where user_id=v_user and date=current_date for update;
  if p_goal='workout' and not exists(select 1 from public.workout_sessions where user_id=v_user and finished_at is not null and started_at::date=current_date) then raise exception 'Complete a workout first'; end if;
  if p_goal='protein' and coalesce((select sum(protein) from public.meals where user_id=v_user and date=current_date),0)<coalesce((select protein_goal from public.profiles where user_id=v_user),120) then raise exception 'Protein goal not reached'; end if;
  if p_goal='water' and v.water_ml<2000 then raise exception 'Water goal not reached'; end if;
  v_amount:=case when p_goal='workout' then 30 else 10 end;
  v_label:=case when p_goal='workout' then 'Workout goal' when p_goal='protein' then 'Protein goal' else 'Water goal' end;
  if not (p_goal=any(v.awarded_goals)) then
    update public.daily_goals set awarded_goals=array_append(awarded_goals,p_goal),xp_earned=xp_earned+v_amount where id=v.id;
    perform public.award_xp(v_user,v_amount,'goal',v_label,jsonb_build_object('date',current_date));
  end if;
  update public.daily_goals set workout_completed=workout_completed or p_goal='workout',protein_completed=protein_completed or p_goal='protein',water_completed=water_completed or p_goal='water',
    daily_goal_completed=(workout_completed or p_goal='workout') and (protein_completed or p_goal='protein') and (water_completed or p_goal='water')
  where id=v.id returning * into v;
  perform public.maybe_award_daily(v_user,current_date);
  return v;
end; $$;

create or replace function public.log_meal(p_name text,p_protein numeric,p_fats numeric,p_carbs numeric,p_calories numeric,p_image_url text default null,p_ai_analysis text default null) returns public.meals language plpgsql security definer set search_path=public as $$
declare v public.meals; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if length(trim(p_name)) not between 1 and 120 or p_protein<0 or p_fats<0 or p_carbs<0 or p_calories<0 then raise exception 'Invalid meal'; end if;
  insert into public.meals(user_id,date,name,protein,fats,carbs,calories,image_url,ai_analysis) values(v_user,current_date,trim(p_name),p_protein,p_fats,p_carbs,p_calories,p_image_url,p_ai_analysis) returning * into v;
  perform public.award_xp(v_user,5,'meal',v.name,jsonb_build_object('meal_id',v.id));
  return v;
end; $$;

create or replace function public.update_profile_goals() returns trigger language plpgsql security definer set search_path=public as $$
declare g public.daily_goals; v_user uuid; v_date date; v_total numeric; v_goal integer;
begin
  v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  v_date:=case when tg_op='DELETE' then old.date else new.date end;
  select protein_goal into v_goal from public.profiles where user_id=v_user;
  insert into public.daily_goals(user_id,date) values(v_user,v_date) on conflict(user_id,date) do nothing;
  select coalesce(sum(protein),0) into v_total from public.meals where user_id=v_user and date=v_date;
  select * into g from public.daily_goals where user_id=v_user and date=v_date for update;
  if v_total>=coalesce(v_goal,120) and not ('protein'=any(g.awarded_goals)) then
    update public.daily_goals set protein_completed=true,awarded_goals=array_append(awarded_goals,'protein'),xp_earned=xp_earned+10 where id=g.id;
    perform public.award_xp(v_user,10,'goal','Protein goal',jsonb_build_object('date',v_date));
  else update public.daily_goals set protein_completed=(v_total>=coalesce(v_goal,120)) where id=g.id; end if;
  perform public.maybe_award_daily(v_user,v_date);
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists meal_update_daily_protein on public.meals;
create trigger meal_update_daily_protein after insert or delete on public.meals for each row execute function public.update_profile_goals();

do $$ declare tbl text; begin
  foreach tbl in array array['profiles','workout_sessions','workout_exercises','meals','daily_goals','activity_history','user_dashboard_settings','ai_messages'] loop
    execute format('alter table public.%I enable row level security',tbl);
  end loop;
end $$;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists workouts_own on public.workout_sessions;
create policy workouts_own on public.workout_sessions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists exercises_own on public.workout_exercises;
create policy exercises_own on public.workout_exercises for all to authenticated using(exists(select 1 from public.workout_sessions w where w.id=workout_session_id and w.user_id=auth.uid())) with check(exists(select 1 from public.workout_sessions w where w.id=workout_session_id and w.user_id=auth.uid()));
drop policy if exists meals_own on public.meals;
create policy meals_own on public.meals for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists goals_own on public.daily_goals;
create policy goals_own on public.daily_goals for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists activity_own on public.activity_history;
create policy activity_own on public.activity_history for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists dashboard_settings_own on public.user_dashboard_settings;
create policy dashboard_settings_own on public.user_dashboard_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists ai_messages_own on public.ai_messages;
create policy ai_messages_own on public.ai_messages for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

grant execute on function public.finish_workout(uuid) to authenticated;
grant execute on function public.change_water(integer) to authenticated;
grant execute on function public.complete_daily_goal(text) to authenticated;
grant execute on function public.log_meal(text,numeric,numeric,numeric,numeric,text,text) to authenticated;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.finish_workout(uuid) from public, anon;
revoke all on function public.change_water(integer) from public, anon;
revoke all on function public.complete_daily_goal(text) from public, anon;
revoke all on function public.log_meal(text,numeric,numeric,numeric,numeric,text,text) from public, anon;

-- Keep users from writing their own XP, activity history, or completion flags directly.
revoke all on public.profiles, public.workout_sessions, public.workout_exercises, public.meals,
  public.daily_goals, public.activity_history, public.user_dashboard_settings, public.ai_messages from anon, authenticated;
grant select,insert on public.profiles to authenticated;
grant update(user_id,name,avatar_url,age,sex,height,weight,goal,level,training_experience,max_pullups,max_pushups,max_dips,equipment,training_frequency,language,onboarding_completed,protein_goal,nutrition_goal,allergies,dietary_restrictions,updated_at) on public.profiles to authenticated;
grant select,delete on public.workout_sessions to authenticated;
grant insert(user_id,name,started_at) on public.workout_sessions to authenticated;
grant select,delete on public.workout_exercises to authenticated;
grant insert(workout_session_id,exercise_name,sets,reps,weight,duration,notes) on public.workout_exercises to authenticated;
grant select,delete on public.meals to authenticated;
grant select on public.daily_goals,public.activity_history to authenticated;
grant select,insert,update on public.user_dashboard_settings to authenticated;
grant select,insert on public.ai_messages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('food-photos','food-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists food_photos_insert_own on storage.objects;
create policy food_photos_insert_own on storage.objects for insert to authenticated
with check(bucket_id='food-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists food_photos_select_own on storage.objects;
create policy food_photos_select_own on storage.objects for select to authenticated
using(bucket_id='food-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists food_photos_delete_own on storage.objects;
create policy food_photos_delete_own on storage.objects for delete to authenticated
using(bucket_id='food-photos' and (storage.foldername(name))[1]=auth.uid()::text);
