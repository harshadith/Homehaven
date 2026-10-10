import { Request, Response } from 'express';
import { db, IBooking } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { getServerSupabaseClient } from '../config/supabase.js';

function populateBooking(b: IBooking) {
  const service = db.services.find(s => s._id === b.serviceId);
  const provider = db.providers.find(p => p._id === b.providerId);
  const providerUser = provider ? db.users.find(u => u._id === provider.userId) : null;
  const customer = db.users.find(u => u._id === b.customerId);
  const review = db.reviews.find(r => r.bookingId === b._id);

  return {
    ...b,
    service: service || null,
    provider: provider ? {
      ...provider,
      user: providerUser ? {
        _id: providerUser._id,
        name: providerUser.name,
        email: providerUser.email,
        phone: providerUser.phone,
        avatar: providerUser.avatar
      } : null
    } : null,
    customer: customer ? {
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      avatar: customer.avatar
    } : null,
    review: review || null
  };
}

/**
 * Returns all reserved/busy slots across local database and Supabase PostgreSQL.
 * Used by Booking Wizard and Specialist schedules to prevent duplicate bookings.
 */
export async function getBusySlots(req: Request, res: Response) {
  const { providerId, date } = req.query as { providerId?: string; date?: string };

  const busySet = new Set<string>();

  // 1. From local db
  db.bookings.forEach(b => {
    if (b.status === 'cancelled') return;
    if (providerId && b.providerId !== providerId) return;
    if (date && b.date !== date) return;
    busySet.add(`${b.providerId}|${b.date}|${b.timeSlot}`);
  });

  // 2. From Supabase if configured
  const client = getServerSupabaseClient();
  if (client) {
    try {
      let query = client.from('bookings').select('provider_id, date, time_slot, status').neq('status', 'cancelled');
      if (providerId) query = query.eq('provider_id', providerId);
      if (date) query = query.eq('date', date);
      const { data } = await query;
      if (data) {
        data.forEach((b: any) => {
          busySet.add(`${b.provider_id}|${b.date}|${b.time_slot}`);
        });
      }
    } catch (err) {
      console.warn('[Busy Slots Supabase Query Error]', err);
    }
  }

  const busySlots = Array.from(busySet).map(s => {
    const [pId, d, slot] = s.split('|');
    return { providerId: pId, date: d, timeSlot: slot };
  });

  return res.json({ success: true, busySlots });
}

export async function createBooking(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const { providerId, serviceId, date, timeSlot, address, problemNote } = req.body;

  if (!providerId || !serviceId || !date || !timeSlot || !address) {
    return res.status(400).json({
      success: false,
      message: 'Provider, service, date, time slot, and address are required.'
    });
  }

  const provider = db.providers.find(p => p._id === providerId);
  if (!provider) {
    return res.status(404).json({ success: false, message: 'Selected provider not found.' });
  }

  const service = db.services.find(s => s._id === serviceId);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Selected service not found.' });
  }

  // 1. Local Conflict Check: Check if this provider is already booked at that date & time
  const localConflict = db.bookings.find(
    b => b.providerId === providerId &&
         b.date === date &&
         b.timeSlot === timeSlot &&
         b.status !== 'cancelled'
  );

  if (localConflict) {
    return res.status(400).json({
      success: false,
      message: `The selected time slot (${timeSlot}) on ${date} is already reserved for this specialist. Please select another slot.`
    });
  }

  // 2. Supabase Conflict Check: Verify with remote PostgreSQL if configured
  const client = getServerSupabaseClient();
  if (client) {
    try {
      const { data: supaConflict } = await client
        .from('bookings')
        .select('id')
        .eq('provider_id', providerId)
        .eq('date', date)
        .eq('time_slot', timeSlot)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (supaConflict) {
        return res.status(400).json({
          success: false,
          message: `The selected time slot (${timeSlot}) on ${date} is already reserved in the database. Please select another slot.`
        });
      }
    } catch (checkErr) {
      console.warn('[Supabase Conflict Check Warning]', checkErr);
    }
  }

  // Transparent Price Breakdown (INR)
  const visitFee = 149;
  const estimate = service.basePrice;
  const subtotal = visitFee + estimate;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const bookingId = `book_${Date.now()}`;
  const now = new Date().toISOString();

  const newBooking: IBooking = {
    _id: bookingId,
    customerId: req.user._id,
    providerId,
    serviceId,
    date,
    timeSlot,
    address: {
      label: address.label || 'Home',
      line: address.line || '',
      city: address.city || '',
      pincode: address.pincode || '',
      lat: address.lat,
      lng: address.lng
    },
    problemNote: problemNote || '',
    status: 'requested',
    priceBreakdown: {
      visitFee,
      estimate,
      tax,
      total
    },
    timeline: [
      {
        status: 'requested',
        at: now,
        note: 'Booking requested by customer'
      }
    ],
    createdAt: now
  };

  db.bookings.unshift(newBooking);
  db.save();

  // Persist to Supabase if configured
  let supabaseSynced = false;
  let supabaseError: string | null = null;

  if (client) {
    try {
      const { error } = await client.from('bookings').upsert({
        id: newBooking._id,
        customer_id: newBooking.customerId,
        provider_id: newBooking.providerId,
        service_id: newBooking.serviceId,
        date: newBooking.date,
        time_slot: newBooking.timeSlot,
        address: newBooking.address,
        problem_note: newBooking.problemNote || '',
        status: newBooking.status,
        price_breakdown: newBooking.priceBreakdown,
        timeline: newBooking.timeline,
        created_at: newBooking.createdAt
      });

      if (error) {
        // Rollback local db entry if it violated the slot constraint
        if (error.code === '23505' || error.message?.includes('idx_unique_provider_booking_slot')) {
          db.bookings = db.bookings.filter(b => b._id !== bookingId);
          db.save();
          return res.status(400).json({
            success: false,
            message: `The selected time slot (${timeSlot}) on ${date} has just been reserved. Please pick another slot.`
          });
        }
        console.error('[Supabase Sync Error]', error.message);
        supabaseError = error.message;
      } else {
        supabaseSynced = true;
        console.log('[Supabase Sync Success] Inserted booking:', newBooking._id);
      }
    } catch (err: any) {
      console.error('[Supabase Sync Exception]', err.message);
      supabaseError = err.message;
    }
  }

  res.status(201).json({
    success: true,
    booking: populateBooking(newBooking),
    supabaseSynced,
    supabaseError
  });
}

export async function getMyBookings(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  let list: IBooking[] = [];

  if (req.user.role === 'admin') {
    list = [...db.bookings];
  } else if (req.user.role === 'provider') {
    const providerProfile = db.providers.find(p => p.userId === req.user?._id);
    if (providerProfile) {
      list = db.bookings.filter(b => b.providerId === providerProfile._id);
    }
  } else {
    list = db.bookings.filter(b => b.customerId === req.user?._id);
  }

  // Sort by date/createdAt descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    count: list.length,
    bookings: list.map(populateBooking)
  });
}

export async function getBookingById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const booking = db.bookings.find(b => b._id === id);

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  // Authorization check: customer, provider, or admin
  const user = req.user;
  if (user && user.role !== 'admin') {
    const provider = db.providers.find(p => p._id === booking.providerId);
    const isOwner = booking.customerId === user._id || (provider && provider.userId === user._id);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  res.json({
    success: true,
    booking: populateBooking(booking)
  });
}

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const { id } = req.params;
  const { status, note } = req.body;

  const validStatuses = ['requested', 'accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status '${status}'.` });
  }

  const booking = db.bookings.find(b => b._id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  const provider = db.providers.find(p => p._id === booking.providerId);
  const isAuthorized =
    req.user.role === 'admin' ||
    (provider && provider.userId === req.user._id) ||
    (req.user._id === booking.customerId && (status === 'cancelled'));

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Not authorized to change this booking status.' });
  }

  booking.status = status;
  booking.timeline.push({
    status,
    at: new Date().toISOString(),
    note: note || `Status updated to ${status.replace(/_/g, ' ')}`
  });

  // If completed, increment jobs done
  if (status === 'completed' && provider) {
    provider.jobsDone = (provider.jobsDone || 0) + 1;
    // Update trust score
    provider.trustScore = Math.min(99, Math.round(
      (provider.rating * 14) +
      Math.min(provider.jobsDone * 0.25, 20) +
      Math.min(provider.experience * 1.2, 10)
    ));
  }

  db.save();

  const client = getServerSupabaseClient();
  if (client) {
    try {
      client.from('bookings').update({
        status: booking.status,
        timeline: booking.timeline
      }).eq('id', booking._id).then();
    } catch (err) {
      console.error('[Supabase Status Update Error]', err);
    }
  }

  res.json({
    success: true,
    booking: populateBooking(booking)
  });
}

export async function rescheduleBooking(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const { id } = req.params;
  const { date, timeSlot } = req.body;

  const booking = db.bookings.find(b => b._id === id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  if (booking.customerId !== req.user._id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only booking owner can reschedule.' });
  }

  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cannot reschedule completed or cancelled booking.' });
  }

  // 1. Local Conflict Check
  const conflict = db.bookings.find(
    b => b._id !== id &&
         b.providerId === booking.providerId &&
         b.date === date &&
         b.timeSlot === timeSlot &&
         b.status !== 'cancelled'
  );

  if (conflict) {
    return res.status(400).json({
      success: false,
      message: `The selected time slot (${timeSlot}) on ${date} is already reserved. Please pick another slot.`
    });
  }

  // 2. Supabase Conflict Check
  const clientReschedule = getServerSupabaseClient();
  if (clientReschedule) {
    try {
      const { data: supaConflict } = await clientReschedule
        .from('bookings')
        .select('id')
        .eq('provider_id', booking.providerId)
        .eq('date', date)
        .eq('time_slot', timeSlot)
        .neq('status', 'cancelled')
        .neq('id', id)
        .maybeSingle();

      if (supaConflict) {
        return res.status(400).json({
          success: false,
          message: `The selected time slot (${timeSlot}) on ${date} is already reserved in the database. Please pick another slot.`
        });
      }
    } catch (checkErr) {
      console.warn('[Supabase Reschedule Conflict Check Error]', checkErr);
    }
  }

  const oldDate = booking.date;
  const oldSlot = booking.timeSlot;

  booking.date = date;
  booking.timeSlot = timeSlot;
  booking.timeline.push({
    status: booking.status,
    at: new Date().toISOString(),
    note: `Rescheduled from ${oldDate} ${oldSlot} to ${date} ${timeSlot}`
  });

  db.save();

  if (clientReschedule) {
    try {
      clientReschedule.from('bookings').update({
        date: booking.date,
        time_slot: booking.timeSlot,
        timeline: booking.timeline
      }).eq('id', booking._id).then();
    } catch (err) {
      console.error('[Supabase Reschedule Update Error]', err);
    }
  }

  res.json({
    success: true,
    booking: populateBooking(booking)
  });
}

export async function cancelBooking(req: AuthRequest, res: Response) {
  return updateBookingStatus(req, res);
}
