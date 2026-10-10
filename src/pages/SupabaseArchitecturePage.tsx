import React, { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase, updateClientSupabaseConfig, getClientConfig } from '../lib/supabase.js';
import { api } from '../api/client.js';
import { showToast } from '../hooks/useToast.js';
import {
  Database, ShieldCheck, CheckCircle2, Copy, Play,
  Code, Layers, ArrowLeft, ExternalLink, Key, Check, Server, Table, RefreshCw, AlertCircle, Save, Sparkles
} from 'lucide-react';

interface SupabaseArchitecturePageProps {
  onNavigate: (tab: string, param?: any) => void;
}

export const SupabaseArchitecturePage: React.FC<SupabaseArchitecturePageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'schema' | 'seed' | 'rls'>('setup');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [syncReport, setSyncReport] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);

  // Form inputs for direct configuration in UI
  const initialClient = getClientConfig();
  const [inputUrl, setInputUrl] = useState(initialClient.url || '');
  const [inputKey, setInputKey] = useState(initialClient.key || '');

  const [connectionResult, setConnectionResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: isSupabaseConfigured ? 'success' : 'idle',
    message: isSupabaseConfigured ? 'Supabase credentials detected.' : 'Supabase credentials not yet configured.'
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.get('/api/supabase/status');
      if (res.success) {
        setServerStatus(res);
        if (res.url && !inputUrl) setInputUrl(res.url);
        if (res.health.connected) {
          setConnectionResult({
            status: 'success',
            message: 'Connected to Supabase PostgreSQL database successfully!'
          });
        } else if (res.health.configured) {
          setConnectionResult({
            status: 'error',
            message: res.health.message
          });
        }
      }
    } catch (e) {
      // server status check failed silently
    }
  };

  const handleSaveCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = inputUrl.trim();
    const cleanKey = inputKey.trim();

    if (!cleanUrl || !cleanKey) {
      showToast('Please provide both Project URL and API Key', 'error');
      return;
    }

    if (!cleanUrl.startsWith('https://')) {
      showToast('Project URL must start with https://', 'error');
      return;
    }

    setSavingKeys(true);
    try {
      // 1. Update on server
      const res = await api.post('/api/supabase/config', {
        url: cleanUrl,
        anonKey: cleanKey
      });

      // 2. Update in client
      updateClientSupabaseConfig(cleanUrl, cleanKey);

      if (res.success) {
        showToast('Supabase credentials saved successfully!', 'success');
        await checkStatus();
      } else {
        showToast(res.message || 'Failed to save credentials', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating credentials', 'error');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await api.post('/api/supabase/sync-all', {});
      setSyncReport(res);
      if (res.success) {
        showToast('All bookings, services, specialists & profiles synced to Supabase!', 'success');
        checkStatus();
      } else {
        showToast(res.message || 'Sync encountered an error', 'error');
      }
    } catch (err: any) {
      setSyncReport({
        success: false,
        message: err.message || 'Sync failed',
        details: err.message
      });
      showToast(err.message || 'Sync failed.', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await api.get('/api/supabase/status');
      if (res.success) {
        setServerStatus(res);
        if (res.health.connected) {
          setConnectionResult({
            status: 'success',
            message: `Connected to Supabase successfully! Verified ${res.health.servicesCount ?? 0} service rows.`
          });
          showToast('Supabase PostgreSQL connection verified successfully!', 'success');
        } else {
          setConnectionResult({
            status: 'error',
            message: res.health.message
          });
          showToast(res.health.message, 'error');
        }
      }
    } catch (err: any) {
      setConnectionResult({
        status: 'error',
        message: err.message || 'Failed to ping Supabase.'
      });
      showToast('Connection failed: ' + err.message, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const SCHEMA_SQL = `-- =========================================================================
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
on conflict (id) do nothing;`;

  const RLS_ONLY_SQL = `-- Safely drop all old policies to avoid ERROR 42710
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
create policy "Allow all on reviews" on public.reviews for all using (true) with check (true);`;

  const SEED_SQL = `INSERT INTO public.services (id, name, category, description, base_price, duration, icon, is_active)
VALUES 
  ('srv_plumbing', 'Plumbing Repair & Leak Fixing', 'plumbing', 'Tap cartridge replacement, leak fixing & drain clog clearing', 349, 60, '🔧', true),
  ('srv_electrical', 'Electrical Diagnostics & Wiring', 'electrical', 'MCB tripping fix, ceiling fan repair, and wiring troubleshooting', 399, 60, '⚡', true),
  ('srv_cleaning', 'Deep House Cleaning & Sanitization', 'cleaning', 'Kitchen chimney grease removal, bathroom tile scrub, and vacuuming', 1499, 180, '✨', true),
  ('srv_ac_repair', 'Split AC Service & Jet Pump Wash', 'ac_repair', 'Indoor coil jet foam wash, outdoor condenser wash, and gas check', 699, 75, '❄️', true)
ON CONFLICT (id) DO NOTHING;`;

  const isConnected = serverStatus?.health?.connected;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-16">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-stone-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#0F4C5C] uppercase tracking-wider">
              Relational Database & Backend
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
              isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'Supabase Connected' : 'Configuration Needed'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-stone-900">
            Supabase PostgreSQL Architecture
          </h1>

          <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
            HomeHaven uses Supabase for relational PostgreSQL data storage, Row Level Security (RLS), real-time booking dispatching, and conflict-free time slot locks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors self-start md:self-auto cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 text-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('setup')}
          className={`px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'setup'
              ? 'bg-[#0F4C5C] text-white shadow-xs'
              : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
          }`}
        >
          1. Connect Supabase Project
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'schema'
              ? 'bg-[#0F4C5C] text-white shadow-xs'
              : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
          }`}
        >
          2. PostgreSQL Schema & Tables (Fixed for 42710)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rls')}
          className={`px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'rls'
              ? 'bg-[#0F4C5C] text-white shadow-xs'
              : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
          }`}
        >
          3. Row Level Security (RLS Fix)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seed')}
          className={`px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'seed'
              ? 'bg-[#0F4C5C] text-white shadow-xs'
              : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
          }`}
        >
          4. Seed Data SQL Script
        </button>
      </div>

      {/* TAB 1: SETUP */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-950 via-stone-900 to-slate-900 rounded-[26px] p-6 sm:p-8 text-white border border-emerald-800/40 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Supabase Client Setup
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-white">
                  Connect Your Supabase Project
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Supabase provides a hosted PostgreSQL database, authentication, and instant REST APIs. Enter your project URL and API key below or set them in your environment.
                </p>
              </div>

              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-colors shrink-0 self-start md:self-auto cursor-pointer"
              >
                <span>Open Supabase Dashboard</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* In-App Direct Configuration Form */}
            <form onSubmit={handleSaveCredentials} className="p-5 bg-black/40 rounded-2xl border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  Configure Supabase Project Keys
                </span>
                <span className="text-[11px] text-stone-400">
                  Find these in your Supabase Dashboard &gt; <strong>Project Settings &gt; API</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block text-stone-300 font-semibold">
                    Project URL (VITE_SUPABASE_URL)
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-stone-300 font-semibold">
                    API Key / Anon Public Key (VITE_SUPABASE_ANON_KEY)
                  </label>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingKeys}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingKeys ? 'Saving...' : 'Save & Connect Credentials'}</span>
                </button>
              </div>
            </form>

            {/* Quick 3-Step Walkthrough */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-black/50 p-4 rounded-xl border border-stone-800 space-y-1.5">
                <span className="font-mono text-emerald-400 text-xs font-bold">Step 1</span>
                <h4 className="font-bold text-xs text-stone-100">Create Project in Supabase</h4>
                <p className="text-[11px] text-stone-400">
                  Sign in at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-300 underline">supabase.com</a> and create a project like <code className="text-white">HomeHaven</code>.
                </p>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-stone-800 space-y-1.5">
                <span className="font-mono text-emerald-400 text-xs font-bold">Step 2</span>
                <h4 className="font-bold text-xs text-stone-100">Run PostgreSQL Schema</h4>
                <p className="text-[11px] text-stone-400">
                  Go to <strong>Tab 2: PostgreSQL Schema</strong> above, click <strong>Copy SQL</strong>, paste in your Supabase SQL Editor and click <strong>Run</strong>.
                </p>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-stone-800 space-y-1.5">
                <span className="font-mono text-emerald-400 text-xs font-bold">Step 3</span>
                <h4 className="font-bold text-xs text-stone-100">Sync App Data</h4>
                <p className="text-[11px] text-stone-400">
                  Click the <strong>Sync All Data to Supabase</strong> button below to push existing services, specialists and bookings into Supabase tables.
                </p>
              </div>
            </div>

            {/* Connection Test & Sync Bar */}
            <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-stone-200">Supabase Connection & Sync Status</span>
                <p className="text-xs text-stone-400">{connectionResult.message}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{testingConnection ? 'Checking...' : 'Ping Supabase'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  <span>{syncingAll ? 'Syncing...' : 'Sync All Data to Supabase'}</span>
                </button>
              </div>
            </div>

            {/* Sync Report if available */}
            {syncReport && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                syncReport.success
                  ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>{syncReport.success ? '✅ Supabase Sync Succeeded' : '⚠️ Supabase Sync Report'}</span>
                  <span>{syncReport.message}</span>
                </div>

                {syncReport.results && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
                    {Object.entries(syncReport.results).map(([tbl, info]: [string, any]) => (
                      <div key={tbl} className="p-2 rounded bg-black/40 border border-stone-800">
                        <strong className="block text-white uppercase">{tbl}</strong>
                        {info.error ? (
                          <span className="text-rose-400 block break-words text-[10px]">❌ {info.error}</span>
                        ) : (
                          <span className="text-emerald-400">✅ {info.count} rows</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!syncReport.success && (
                  <div className="pt-2 text-stone-300 text-[11px] border-t border-rose-500/20 space-y-1">
                    <p>💡 <strong>How to fix this:</strong></p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Go to <strong>Tab 2: PostgreSQL Schema & Tables</strong> above.</li>
                      <li>Click <strong>"Copy SQL"</strong> (it includes the fix for error 42710 and full write permissions).</li>
                      <li>In your Supabase SQL Editor tab, paste and click <strong>"Run"</strong>.</li>
                      <li>Come back here and click <strong>"Sync All Data to Supabase"</strong>!</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Troubleshooting Section */}
          <div className="bg-white p-6 rounded-[22px] border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>Fixing Common Supabase Issues</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                <span className="font-bold text-stone-900 block">1. ERROR 42710 (Policy already exists)</span>
                <p className="text-stone-600 leading-relaxed">
                  PostgreSQL throws error 42710 if a policy with the same name was previously created. Tab 2 contains an automated <code className="font-mono bg-stone-200 px-1 py-0.5 rounded">DO $$</code> cleanup block that safely clears duplicate policies before creating fresh ones.
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                <span className="font-bold text-stone-900 block">2. Row-Level Security Blocks Insert</span>
                <p className="text-stone-600 leading-relaxed">
                  By default, tables with RLS enabled reject inserts unless an <code className="font-mono bg-stone-200 px-1 py-0.5 rounded">ALL</code> or <code className="font-mono bg-stone-200 px-1 py-0.5 rounded">INSERT</code> policy is active. Our updated script allows universal reads and writes for both anon and authenticated users.
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                <span className="font-bold text-stone-900 block">3. Data Not Showing in Table Editor</span>
                <p className="text-stone-600 leading-relaxed">
                  After booking or syncing, navigate to Supabase <strong>Table Editor &gt; bookings</strong> and click the <strong>Refresh</strong> icon (circular arrow in the top right of the table) to reload the latest records.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEMA */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[22px] border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold font-serif-display text-stone-900">
                    PostgreSQL Schema & RLS Fix for Supabase SQL Editor
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-300">
                    Safe for Re-run (No 42710 Errors)
                  </span>
                </div>
                <p className="text-xs text-stone-600">
                  This SQL script drops any duplicate older policies automatically, creates all 5 tables (services, providers, profiles, bookings, reviews), sets up unique slot locks, and grants full read/write access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(SCHEMA_SQL, 'schema_sql')}
                className="px-4 py-2.5 rounded-xl bg-[#0F4C5C] hover:bg-[#0c3c49] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto shadow-xs"
              >
                {copiedId === 'schema_sql' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId === 'schema_sql' ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>How to run:</strong> In your Supabase Dashboard, open <strong>SQL Editor</strong>, open a new query (or replace everything in <em>Untitled query</em>), paste this script, and click <strong>Run</strong> (or press <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">Ctrl/Cmd + Enter</kbd>).
              </span>
            </div>

            <div className="bg-stone-950 text-emerald-400 p-5 rounded-xl font-mono text-xs overflow-x-auto border border-stone-800 max-h-[500px]">
              <pre><code>{SCHEMA_SQL}</code></pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RLS FIX */}
      {activeTab === 'rls' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[22px] border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-serif-display text-stone-900">
                  Row Level Security (RLS) Policy Reset Script
                </h3>
                <p className="text-xs text-stone-600">
                  If your tables already exist and you only need to fix <strong>ERROR 42710</strong> or enable write permissions for syncing and booking, run this lightweight policy script.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(RLS_ONLY_SQL, 'rls_sql')}
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedId === 'rls_sql' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId === 'rls_sql' ? 'Copied!' : 'Copy RLS Script'}</span>
              </button>
            </div>

            <div className="bg-stone-950 text-teal-300 p-5 rounded-xl font-mono text-xs overflow-x-auto border border-stone-800 max-h-96">
              <pre><code>{RLS_ONLY_SQL}</code></pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SEED DATA */}
      {activeTab === 'seed' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[22px] border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-serif-display text-stone-900">
                  Initial Seed SQL for Supabase
                </h3>
                <p className="text-xs text-stone-600">
                  Populate your Supabase tables with initial home service categories and rates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(SEED_SQL, 'seed_sql')}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedId === 'seed_sql' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'seed_sql' ? 'Copied!' : 'Copy Seed SQL'}</span>
              </button>
            </div>

            <div className="bg-stone-950 text-teal-300 p-5 rounded-xl font-mono text-xs overflow-x-auto border border-stone-800">
              <pre><code>{SEED_SQL}</code></pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
