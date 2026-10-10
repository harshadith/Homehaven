import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, IUser, IProvider } from '../config/db.js';
import { AuthRequest, JWT_SECRET } from '../middleware/auth.js';

function signToken(id: string, role: string): string {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response) {
  const { name, email, password, phone, role, city, bio, services } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const userRole = role === 'provider' ? 'provider' : (role === 'admin' ? 'admin' : 'customer');
  const isApproved = userRole === 'customer'; // Providers require admin approval

  const userId = `user_${Date.now()}`;
  const newUser: IUser = {
    _id: userId,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    phone: phone || '',
    role: userRole,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0F4C5C&textColor=ffffff`,
    addresses: [],
    isApproved,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);

  // If registering as provider, create provider profile
  if (userRole === 'provider') {
    const provId = `prov_${Date.now()}`;
    const newProv: IProvider = {
      _id: provId,
      userId,
      services: Array.isArray(services) ? services : [],
      experience: 1,
      rating: 5.0,
      reviewCount: 0,
      jobsDone: 0,
      trustScore: 85,
      availability: {
        days: [1, 2, 3, 4, 5],
        slots: ['09:00', '11:00', '14:00', '16:00']
      },
      city: city || 'Austin',
      bio: bio || 'Professional home service specialist.'
    };
    db.providers.push(newProv);
  }

  db.save();

  const token = signToken(newUser._id, newUser.role);
  const { password: _, ...userWithoutPassword } = newUser;

  res.status(201).json({
    success: true,
    token,
    user: userWithoutPassword
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Explicit check for requested Admin credentials
  if (cleanEmail === 'mohitnagalingam12146@gmail.com' && password === 'google passis54') {
    let adminUser = db.users.find(u => u.email.toLowerCase() === 'mohitnagalingam12146@gmail.com');
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      adminUser = {
        _id: 'user_admin_mohit',
        name: 'Mohit Nagalingam',
        email: 'mohitnagalingam12146@gmail.com',
        password: await bcrypt.hash('google passis54', salt),
        phone: '+91 98201 11223',
        role: 'admin',
        avatar: '/src/assets/images/admin_aarav_1791559371540.jpg',
        addresses: [],
        isApproved: true,
        createdAt: new Date().toISOString()
      };
      db.users.unshift(adminUser);
      db.save();
    } else {
      adminUser.role = 'admin';
      adminUser.isApproved = true;
      db.save();
    }

    const token = signToken(adminUser._id, 'admin');
    const { password: _, ...userWithoutPassword } = adminUser;
    return res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  }

  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = signToken(user._id, user.role);
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    token,
    user: userWithoutPassword
  });
}

export async function firebaseGoogleLogin(req: Request, res: Response) {
  const { email, name, avatar, role = 'customer', profession } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Google account email is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const isAdmin = cleanEmail === 'mohitnagalingam12146@gmail.com';
  const effectiveRole = isAdmin ? 'admin' : (role === 'provider' ? 'provider' : (role === 'admin' ? 'admin' : 'customer'));

  let user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const generatedPass = await bcrypt.hash(`g_auth_${Date.now()}`, salt);
    user = {
      _id: `user_g_${Date.now()}`,
      name: name || (isAdmin ? 'Mohit Nagalingam' : 'Google User'),
      email: cleanEmail,
      password: generatedPass,
      phone: '+91 98000 00000',
      role: effectiveRole,
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}&backgroundColor=0F4C5C&textColor=ffffff`,
      addresses: [],
      isApproved: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    if (effectiveRole === 'provider') {
      const professionServicesMap: Record<string, string[]> = {
        plumbing: ['srv_plumbing'],
        electrical: ['srv_electrical'],
        cleaning: ['srv_cleaning'],
        ac_repair: ['srv_ac_repair'],
        painting: ['srv_painting'],
        pest_control: ['srv_pest_control'],
        appliance_repair: ['srv_appliance_repair'],
        carpentry: ['srv_carpentry']
      };
      const assignedServices = profession && professionServicesMap[profession]
        ? professionServicesMap[profession]
        : ['srv_plumbing'];

      const newProv: IProvider = {
        _id: `prov_${Date.now()}`,
        userId: user._id,
        services: assignedServices,
        experience: 5,
        rating: 5.0,
        reviewCount: 1,
        jobsDone: 10,
        trustScore: 92,
        availability: {
          days: [1, 2, 3, 4, 5, 6],
          slots: ['09:00', '11:00', '14:00', '16:00']
        },
        city: 'Bengaluru',
        bio: `Verified Google-authenticated specialist for ${profession || 'home services'}.`
      };
      db.providers.push(newProv);
    }

    db.save();
  } else {
    // If existing user logs in as admin with specified admin email
    const existingUser = user!;
    if (isAdmin && existingUser.role !== 'admin') {
      existingUser.role = 'admin';
      db.save();
    } else if (!isAdmin && role === 'provider' && existingUser.role !== 'admin') {
      existingUser.role = 'provider';
      const existingProv = db.providers.find(p => p.userId === existingUser._id);
      if (!existingProv) {
        const professionServicesMap: Record<string, string[]> = {
          plumbing: ['srv_plumbing'],
          electrical: ['srv_electrical'],
          cleaning: ['srv_cleaning'],
          ac_repair: ['srv_ac_repair'],
          painting: ['srv_painting'],
          pest_control: ['srv_pest_control'],
          appliance_repair: ['srv_appliance_repair'],
          carpentry: ['srv_carpentry']
        };
        const assignedServices = profession && professionServicesMap[profession]
          ? professionServicesMap[profession]
          : ['srv_plumbing'];

        const newProv: IProvider = {
          _id: `prov_${Date.now()}`,
          userId: existingUser._id,
          services: assignedServices,
          experience: 5,
          rating: 5.0,
          reviewCount: 1,
          jobsDone: 10,
          trustScore: 92,
          availability: {
            days: [1, 2, 3, 4, 5, 6],
            slots: ['09:00', '11:00', '14:00', '16:00']
          },
          city: 'Bengaluru',
          bio: `Verified Google-authenticated specialist for ${profession || 'home services'}.`
        };
        db.providers.push(newProv);
      }
      db.save();
    }
  }

  const token = signToken(user._id, user.role);
  const { password: _, ...userWithoutPassword } = user;

  let providerProfile = null;
  if (user.role === 'provider') {
    providerProfile = db.providers.find(p => p.userId === user._id) || null;
  }

  res.json({
    success: true,
    token,
    user: userWithoutPassword,
    provider: providerProfile
  });
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const { password: _, ...userWithoutPassword } = req.user;
  let providerProfile = null;
  if (req.user.role === 'provider') {
    providerProfile = db.providers.find(p => p.userId === req.user?._id) || null;
  }

  res.json({
    success: true,
    user: userWithoutPassword,
    provider: providerProfile
  });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const user = db.users.find(u => u._id === req.user?._id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const { name, phone, addresses, avatar } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;
  if (Array.isArray(addresses)) {
    user.addresses = addresses.map((addr, idx) => ({
      _id: addr._id || `addr_${Date.now()}_${idx}`,
      label: addr.label || 'Home',
      line: addr.line || '',
      city: addr.city || '',
      pincode: addr.pincode || '',
      lat: addr.lat,
      lng: addr.lng
    }));
  }

  db.save();

  const { password: _, ...userWithoutPassword } = user;
  res.json({
    success: true,
    user: userWithoutPassword
  });
}
