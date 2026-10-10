-- =========================================================================
-- HomeHaven PostgreSQL Schema & Initial Data for Supabase
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Safe to re-run multiple times without 42710 policy errors
-- =========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SERVICES (Home Service Catalog)
create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  description text not null,
  base_price numeric not null check (base_price >= 0),
  duration integer not null default 60,
  icon text not null default '🛠️',
  inclusions text[] default '{}',
  exclusions text[] default '{}',
  is_active boolean default true,
  keywords text[] default '{}',
  created_at timestamptz default now()
);

-- 2. PROVIDERS (Specialists)
create table if not exists public.providers (
  id text primary key,
  user_id text not null,
  services text[] default '{}',
  experience integer not null default 5,
  rating numeric(3, 2) default 5.0,
  review_count integer default 0,
  jobs_done integer default 0,
  trust_score integer default 95,
  availability jsonb not null default '{"days": [0,1,2,3,4,5,6], "slots": ["09:00", "11:00", "14:00", "16:30"]}',
  city text not null default 'Bengaluru',
  bio text default '',
  created_at timestamptz default now()
);

-- 3. PROFILES / USERS
create table if not exists public.profiles (
  id text primary key default gen_random_uuid()::text,
  user_id text unique,
  name text not null,
  email text not null,
  phone text,
  role text not null default 'customer',
  avatar text default '',
  is_approved boolean default true,
  created_at timestamptz default now()
);

-- 4. BOOKINGS (Appointments)
create table if not exists public.bookings (
  id text primary key,
  customer_id text not null,
  provider_id text not null,
  service_id text not null,
  date text not null,
  time_slot text not null,
  address jsonb not null default '{}',
  problem_note text default '',
  status text not null default 'requested',
  price_breakdown jsonb not null default '{"visitFee": 149, "estimate": 349, "tax": 90, "total": 588}',
  timeline jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Partial Unique Index (Prevents double booking non-cancelled slots)
create unique index if not exists idx_unique_provider_booking_slot
  on public.bookings (provider_id, date, time_slot)
  where (status != 'cancelled');

-- 5. REVIEWS
create table if not exists public.reviews (
  id text primary key,
  booking_id text not null,
  customer_id text not null,
  provider_id text not null,
  rating integer not null default 5,
  tags text[] default '{}',
  comment text default '',
  created_at timestamptz default now()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Fully idempotent: safely drops any existing policies first to prevent ERROR 42710
-- Grants full SELECT, INSERT, UPDATE, DELETE access for anon and authenticated
-- =========================================================================

-- Safely drop all existing policies on HomeHaven tables to avoid "policy already exists" (42710)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('services', 'providers', 'profiles', 'bookings', 'reviews')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Enable RLS
alter table public.services enable row level security;
alter table public.providers enable row level security;
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

-- Universal policies covering ALL actions (SELECT, INSERT, UPDATE, DELETE)
create policy "Allow all on services" on public.services for all using (true) with check (true);
create policy "Allow all on providers" on public.providers for all using (true) with check (true);
create policy "Allow all on profiles" on public.profiles for all using (true) with check (true);
create policy "Allow all on bookings" on public.bookings for all using (true) with check (true);
create policy "Allow all on reviews" on public.reviews for all using (true) with check (true);

-- =========================================================================
-- SEED DATA (Services & Specialists)
-- =========================================================================
insert into public.services (id, name, category, description, base_price, duration, icon, is_active, keywords)
values 
  ('srv_plumbing', 'Plumbing Repair & Leak Fixing', 'plumbing', 'Leak detection, tap cartridge replacement, washbasin blockage and jet spray fix.', 349, 60, '🔧', true, array['leak','tap','pipe','clog']),
  ('srv_electrical', 'Electrical Diagnostics & Wiring', 'electrical', 'MCB tripping diagnostics, switchboard repair, ceiling fan and geyser wiring fix.', 399, 60, '⚡', true, array['mcb','spark','switch','fan','wire']),
  ('srv_cleaning', 'Deep House Cleaning & Sanitization', 'cleaning', 'Kitchen degreasing, bathroom descaling, balcony scrub and vacuuming.', 1499, 180, '✨', true, array['cleaning','sanitize','kitchen','bathroom']),
  ('srv_ac_repair', 'Split AC Service & Jet Pump Wash', 'ac_repair', 'Indoor coil pressure wash, outdoor unit fin wash and gas pressure check.', 699, 75, '❄️', true, array['ac','cooling','gas','filter']),
  ('srv_painting', 'Interior Accent Wall Painting', 'painting', 'Putty sanding, primer coat and dual coat luxury washable emulsion application.', 2999, 240, '🎨', true, array['paint','wall','color']),
  ('srv_pest_control', 'Eco Gel Pest Control & Shielding', 'pest_control', 'Odorless German Bayer micro-gel dots for cockroaches and ants with 45-day warranty.', 849, 60, '🛡️', true, array['pest','cockroach','gel']),
  ('srv_appliance_repair', 'Washing Machine & Fridge Repair', 'appliance_repair', 'Diagnostics for washer spin error codes, refrigerator cooling issues and microwave.', 499, 60, '🔌', true, array['fridge','washer','machine']),
  ('srv_carpentry', 'Door Alignment & Modular Carpentry', 'carpentry', 'Door latch adjustments, soft-close hydraulic hinge repair and curtain rod mounting.', 449, 75, '🪚', true, array['carpenter','door','hinge','lock'])
on conflict (id) do nothing;

insert into public.providers (id, user_id, services, experience, rating, review_count, jobs_done, trust_score, city, bio)
values
  ('prov_01', 'user_prov_01', array['srv_plumbing', 'srv_ac_repair'], 10, 4.90, 68, 240, 98, 'Bengaluru', 'ITI certified master plumber and HVAC technician serving Koramangala & Indiranagar.'),
  ('prov_02', 'user_prov_02', array['srv_cleaning'], 7, 4.95, 84, 310, 99, 'Bengaluru', 'Hospital-grade sanitization expert. Uses eco-friendly Diversey chemicals.'),
  ('prov_03', 'user_prov_03', array['srv_electrical', 'srv_appliance_repair'], 9, 4.88, 52, 195, 96, 'Bengaluru', 'Licensed wireman with 9 years handling heavy appliances and inverter systems.'),
  ('prov_04', 'user_prov_04', array['srv_painting', 'srv_carpentry'], 8, 4.92, 45, 140, 97, 'Mumbai', 'Master applicator and finish carpenter serving Bandra and Juhu.'),
  ('prov_05', 'user_prov_05', array['srv_pest_control'], 8, 4.89, 56, 210, 97, 'Hyderabad', 'Urban pest management specialist with odorless German formulations.'),
  ('prov_06', 'user_prov_06', array['srv_carpentry', 'srv_appliance_repair', 'srv_plumbing'], 6, 4.78, 22, 75, 92, 'Bengaluru', 'Cabinetry and appliance troubleshooter based near Bellandur.')
on conflict (id) do nothing;
