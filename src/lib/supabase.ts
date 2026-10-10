import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function cleanSupabaseUrl(rawUrl: string): string {
  let u = (rawUrl || '').trim();
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/rest\/v1\/?$/, '');
  u = u.replace(/\/rest\/?$/, '');
  return u;
}

const getInitialUrl = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('HH_SUPABASE_URL');
    if (stored && stored.startsWith('https://')) return cleanSupabaseUrl(stored);
  }
  return cleanSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
};

const getInitialKey = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('HH_SUPABASE_ANON_KEY');
    if (stored && stored.length > 10) return stored.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
};

let currentUrl = getInitialUrl();
let currentKey = getInitialKey();

export let isSupabaseConfigured = Boolean(
  currentUrl &&
  currentKey &&
  currentUrl !== 'https://your-project-ref.supabase.co' &&
  currentKey !== 'your-anon-public-key' &&
  currentUrl.startsWith('https://')
);

export let supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(currentUrl, currentKey)
  : createClient(
      'https://placeholder-project.supabase.co',
      'placeholder-anon-key'
    );

export function updateClientSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = cleanSupabaseUrl(url);
  const cleanKey = anonKey.trim();

  if (typeof window !== 'undefined') {
    localStorage.setItem('HH_SUPABASE_URL', cleanUrl);
    localStorage.setItem('HH_SUPABASE_ANON_KEY', cleanKey);
  }

  currentUrl = cleanUrl;
  currentKey = cleanKey;
  isSupabaseConfigured = Boolean(
    currentUrl &&
    currentKey &&
    currentUrl.startsWith('https://')
  );

  supabase = createClient(currentUrl, currentKey);
  return isSupabaseConfigured;
}

export function getClientConfig() {
  return {
    url: currentUrl,
    key: currentKey,
    isConfigured: isSupabaseConfigured
  };
}

export interface SupabaseProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'provider' | 'admin';
  avatar: string;
  is_approved: boolean;
  created_at: string;
}

export interface SupabaseService {
  id: string;
  name: string;
  category: string;
  description: string;
  base_price: number;
  duration: number;
  icon: string;
  inclusions: string[];
  exclusions: string[];
  is_active: boolean;
  keywords: string[];
  created_at?: string;
}

export interface SupabaseProvider {
  id: string;
  user_id: string;
  services: string[];
  experience: number;
  rating: number;
  review_count: number;
  jobs_done: number;
  trust_score: number;
  availability: {
    days: number[];
    slots: string[];
  };
  city: string;
  bio: string;
  created_at?: string;
}

export interface SupabaseBooking {
  id: string;
  customer_id: string;
  provider_id: string;
  service_id: string;
  date: string;
  time_slot: string;
  address: {
    label: string;
    line: string;
    city: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  problem_note: string;
  status: 'requested' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';
  price_breakdown: {
    visitFee: number;
    estimate: number;
    tax: number;
    total: number;
  };
  timeline: Array<{
    status: string;
    at: string;
    note?: string;
  }>;
  created_at?: string;
}

export interface SupabaseReview {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  rating: number;
  tags: string[];
  comment: string;
  created_at?: string;
}
