import { Router } from 'express';
import { db } from '../config/db.js';
import {
  isServerSupabaseConfigured,
  supabaseServer,
  checkServerSupabaseHealth,
  updateServerSupabaseConfig,
  getSupabaseCredentials
} from '../config/supabase.js';
import crypto from 'crypto';

function toDeterministicUuid(str: string): string {
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/supabase/status - Test connection and readiness
router.get('/status', async (_req, res) => {
  const health = await checkServerSupabaseHealth();
  const creds = getSupabaseCredentials();

  res.json({
    success: true,
    configured: creds.configured,
    url: creds.url,
    keyMasked: creds.keyMasked,
    health,
    counts: {
      services: db.services.length,
      providers: db.providers.length,
      bookings: db.bookings.length,
      reviews: db.reviews.length,
      users: db.users.length
    }
  });
});

// POST /api/supabase/config - Save credentials dynamically without restarting
router.post('/config', async (req, res) => {
  const { url, anonKey } = req.body;
  if (!url || !anonKey) {
    return res.status(400).json({
      success: false,
      message: 'Both Supabase URL and API Key are required.'
    });
  }

  const result = updateServerSupabaseConfig(url, anonKey);
  if (!result.success) {
    return res.status(400).json(result);
  }

  const health = await checkServerSupabaseHealth();
  res.json({
    success: true,
    message: result.message,
    health
  });
});

// GET /api/supabase/schema - Read schema.sql from disk
router.get('/schema', (_req, res) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      return res.json({ success: true, sql });
    }
    res.status(404).json({ success: false, message: 'schema.sql file not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/supabase/sync-all - Push all current app data into Supabase tables
router.post('/sync-all', async (_req, res) => {
  if (!isServerSupabaseConfigured || !supabaseServer) {
    return res.status(400).json({
      success: false,
      message: 'Supabase credentials are not configured yet. Please enter your Project URL and API Key in the setup tab.'
    });
  }

  const results: Record<string, { count: number; error?: string }> = {
    services: { count: 0 },
    providers: { count: 0 },
    profiles: { count: 0 },
    bookings: { count: 0 },
    reviews: { count: 0 }
  };

  try {
    // 1. Sync Services
    const formattedServices = db.services.map(s => ({
      id: s._id,
      name: s.name,
      category: s.category,
      description: s.description,
      base_price: s.basePrice,
      duration: s.duration,
      icon: s.icon,
      inclusions: s.inclusions || [],
      exclusions: s.exclusions || [],
      is_active: s.isActive ?? true,
      keywords: s.keywords || []
    }));

    const { error: srvErr } = await supabaseServer.from('services').upsert(formattedServices);
    if (srvErr) results.services.error = srvErr.message;
    else results.services.count = formattedServices.length;

    // 2. Sync Providers
    const formattedProviders = db.providers.map(p => ({
      id: p._id,
      user_id: p.userId,
      services: p.services || [],
      experience: p.experience,
      rating: p.rating,
      review_count: p.reviewCount,
      jobs_done: p.jobsDone,
      trust_score: p.trustScore,
      availability: p.availability,
      city: p.city,
      bio: p.bio || ''
    }));

    const { error: provErr } = await supabaseServer.from('providers').upsert(formattedProviders);
    if (provErr) results.providers.error = provErr.message;
    else results.providers.count = formattedProviders.length;

    // 3. Sync Profiles (Users)
    const formattedProfiles = db.users.map(u => ({
      id: toDeterministicUuid(u._id),
      user_id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role || 'customer',
      avatar: u.avatar || '',
      is_approved: u.isApproved ?? true
    }));

    const { error: profErr } = await supabaseServer.from('profiles').upsert(formattedProfiles);
    if (profErr) results.profiles.error = profErr.message;
    else results.profiles.count = formattedProfiles.length;

    // 4. Sync Bookings
    // Deduplicate local bookings on active provider/date/timeSlot to ensure integrity
    const seenSlots = new Set<string>();
    const deduplicatedBookings = db.bookings.filter(b => {
      if (b.status === 'cancelled') return true;
      const key = `${b.providerId}|${b.date}|${b.timeSlot}`;
      if (seenSlots.has(key)) return false;
      seenSlots.add(key);
      return true;
    });

    const formattedBookings = deduplicatedBookings.map(b => ({
      id: b._id,
      customer_id: b.customerId,
      provider_id: b.providerId,
      service_id: b.serviceId,
      date: b.date,
      time_slot: b.timeSlot,
      address: b.address,
      problem_note: b.problemNote || '',
      status: b.status,
      price_breakdown: b.priceBreakdown,
      timeline: b.timeline,
      created_at: b.createdAt
    }));

    // Prevent duplicate key error on idx_unique_provider_booking_slot:
    // If Supabase already has an active booking for the exact same slot but with a different ID,
    // remove the stale conflicting row so the upsert succeeds seamlessly without constraint violation.
    for (const b of formattedBookings) {
      if (b.status !== 'cancelled') {
        try {
          await supabaseServer
            .from('bookings')
            .delete()
            .eq('provider_id', b.provider_id)
            .eq('date', b.date)
            .eq('time_slot', b.time_slot)
            .neq('id', b.id);
        } catch (cleanupErr) {
          console.warn('[Supabase Sync Cleanup Warning]', cleanupErr);
        }
      }
    }

    const { error: bookErr } = await supabaseServer.from('bookings').upsert(formattedBookings);
    if (bookErr) results.bookings.error = bookErr.message;
    else results.bookings.count = formattedBookings.length;

    // 5. Sync Reviews
    const formattedReviews = db.reviews.map(r => ({
      id: r._id,
      booking_id: r.bookingId,
      customer_id: r.customerId,
      provider_id: r.providerId,
      rating: r.rating,
      tags: r.tags || [],
      comment: r.comment || '',
      created_at: r.createdAt
    }));

    const { error: revErr } = await supabaseServer.from('reviews').upsert(formattedReviews);
    if (revErr) results.reviews.error = revErr.message;
    else results.reviews.count = formattedReviews.length;

    const anyError = Object.values(results).some(r => r.error);
    const errorsList = Object.entries(results)
      .filter(([_, v]) => Boolean(v.error))
      .map(([k, v]) => `${k}: ${v.error}`)
      .join('; ');

    let userFriendlyMessage = 'All services, specialists, profiles & bookings synced to Supabase!';
    if (anyError) {
      if (errorsList.includes('does not exist') || errorsList.includes('42P01')) {
        userFriendlyMessage = 'Tables do not exist in Supabase yet. Please run the script from "2. PostgreSQL Schema & Tables" in your Supabase SQL Editor and click "Run".';
      } else if (errorsList.includes('row-level security') || errorsList.includes('policy')) {
        userFriendlyMessage = 'Row Level Security policy blocked insert. Please run the updated SQL schema from "2. PostgreSQL Schema & Tables" which allows table writes.';
      } else {
        userFriendlyMessage = `Sync failed on: ${errorsList}`;
      }
    }

    res.json({
      success: !anyError,
      message: userFriendlyMessage,
      details: errorsList || null,
      results
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Sync failed',
      results
    });
  }
});

export default router;
