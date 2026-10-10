import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export function cleanSupabaseUrl(rawUrl: string): string {
  let u = (rawUrl || '').trim();
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/rest\/v1\/?$/, '');
  u = u.replace(/\/rest\/?$/, '');
  return u;
}

let supabaseUrl = cleanSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '');
let supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isValidConfig(url: string, key: string): boolean {
  return Boolean(
    url &&
    key &&
    url !== 'https://your-project-ref.supabase.co' &&
    key !== 'your-anon-public-key' &&
    url.startsWith('https://')
  );
}

export let isServerSupabaseConfigured = isValidConfig(supabaseUrl, supabaseKey);

export let supabaseServer: SupabaseClient | null = isServerSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
  : null;

export function getServerSupabaseClient(): SupabaseClient | null {
  return supabaseServer;
}

export function getSupabaseCredentials() {
  return {
    url: supabaseUrl,
    configured: isServerSupabaseConfigured,
    keyMasked: supabaseKey ? `${supabaseKey.slice(0, 10)}...${supabaseKey.slice(-6)}` : ''
  };
}

export function updateServerSupabaseConfig(newUrl: string, newKey: string): { success: boolean; message: string } {
  const cleanUrl = cleanSupabaseUrl(newUrl);
  const cleanKey = newKey.trim();

  if (!cleanUrl || !cleanKey) {
    return { success: false, message: 'Both Supabase URL and Anon/Service Key are required.' };
  }

  if (!cleanUrl.startsWith('https://')) {
    return { success: false, message: 'Supabase URL must start with https://' };
  }

  try {
    supabaseUrl = cleanUrl;
    supabaseKey = cleanKey;
    isServerSupabaseConfigured = true;
    supabaseServer = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // Update or append in .env file
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Update or add VITE_SUPABASE_URL
      if (/^VITE_SUPABASE_URL=.*/m.test(envContent)) {
        envContent = envContent.replace(/^VITE_SUPABASE_URL=.*/m, `VITE_SUPABASE_URL="${cleanUrl}"`);
      } else {
        envContent += `\nVITE_SUPABASE_URL="${cleanUrl}"`;
      }

      // Update or add VITE_SUPABASE_ANON_KEY
      if (/^VITE_SUPABASE_ANON_KEY=.*/m.test(envContent)) {
        envContent = envContent.replace(/^VITE_SUPABASE_ANON_KEY=.*/m, `VITE_SUPABASE_ANON_KEY="${cleanKey}"`);
      } else {
        envContent += `\nVITE_SUPABASE_ANON_KEY="${cleanKey}"`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    } catch (fsErr) {
      console.warn('[Supabase Config] Failed to update .env on disk:', fsErr);
    }

    return { success: true, message: 'Supabase credentials updated and active.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to initialize Supabase client.' };
  }
}

export async function checkServerSupabaseHealth() {
  if (!isServerSupabaseConfigured || !supabaseServer) {
    return {
      configured: false,
      connected: false,
      tablesExist: false,
      message: 'Supabase credentials (URL and API Key) are not configured yet.'
    };
  }

  try {
    // 1. Check services table
    const { data: srvData, error: srvError } = await supabaseServer.from('services').select('id').limit(1);
    
    // 2. Check bookings table
    const { data: bookData, error: bookError } = await supabaseServer.from('bookings').select('id').limit(1);

    if (srvError || bookError) {
      const err = srvError || bookError;
      const isMissingTable = err?.message?.includes('does not exist') || err?.code === '42P01';
      const isRlsError = err?.message?.includes('row-level security') || err?.message?.includes('policy');

      return {
        configured: true,
        connected: false,
        tablesExist: !isMissingTable,
        message: isMissingTable
          ? `Tables not found in Supabase (${err?.message}). Please run schema.sql in your Supabase SQL Editor.`
          : isRlsError
          ? `Row-level security policy issue: ${err?.message}. Please run the updated schema.sql with permissive policies.`
          : `Connected to Supabase, but query error: ${err?.message}`
      };
    }

    return {
      configured: true,
      connected: true,
      tablesExist: true,
      servicesCount: srvData?.length ?? 0,
      bookingsCount: bookData?.length ?? 0,
      message: 'Connected to Supabase PostgreSQL database successfully!'
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tablesExist: false,
      message: err.message || 'Connection test failed.'
    };
  }
}
