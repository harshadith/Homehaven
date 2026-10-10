import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { showToast } from '../hooks/useToast.js';
import { signInWithGoogleFirebase } from '../lib/firebase.js';
import {
  Wrench, ArrowRight, ShieldCheck, User, Shield, Briefcase,
  Zap, Sparkles, Wind, Paintbrush, Bug, Laptop, Hammer, CheckCircle2, Lock
} from 'lucide-react';

interface LoginProps {
  onNavigate: (tab: string, param?: any) => void;
  initialRole?: 'customer' | 'provider' | 'admin';
}

interface ProfessionOption {
  id: string;
  category: string;
  name: string;
  email: string;
  title: string;
  icon: string;
  experience: string;
  badgeColor: string;
}

const PROFESSIONS: ProfessionOption[] = [
  {
    id: 'plumbing',
    category: 'Plumbing',
    name: 'Ajay Sharma',
    email: 'ajay@homehaven.in',
    title: 'Master Plumber & Leak Specialist',
    icon: '🔧',
    experience: '10 yrs exp',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    id: 'electrical',
    category: 'Electrical',
    name: 'Rajesh Kumar',
    email: 'rajesh@homehaven.in',
    title: 'Senior Licensed Electrician',
    icon: '⚡',
    experience: '12 yrs exp',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'cleaning',
    category: 'Deep Cleaning',
    name: 'Priya Sundaram',
    email: 'priya@homehaven.in',
    title: 'Sanitization & Cleaning Pro',
    icon: '🧹',
    experience: '7 yrs exp',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'ac_repair',
    category: 'AC & HVAC',
    name: 'Vikramaditya Singh',
    email: 'vikram@homehaven.in',
    title: 'Certified Split AC Specialist',
    icon: '❄️',
    experience: '8 yrs exp',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  {
    id: 'painting',
    category: 'Wall Painting',
    name: 'Deepak Verma',
    email: 'deepak@homehaven.in',
    title: 'Master Interior & Texture Painter',
    icon: '🎨',
    experience: '9 yrs exp',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  {
    id: 'pest_control',
    category: 'Pest Control',
    name: 'Kavita Reddy',
    email: 'kavita@homehaven.in',
    title: 'Eco-Gel Pest Barrier Specialist',
    icon: '🛡️',
    experience: '6 yrs exp',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    id: 'appliance_repair',
    category: 'Appliance Repair',
    name: 'Suresh Nair',
    email: 'suresh@homehaven.in',
    title: 'Washer & Refrigerator Technician',
    icon: '🔌',
    experience: '11 yrs exp',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  {
    id: 'carpentry',
    category: 'Woodwork & Carpentry',
    name: 'Arjun Vishwakarma',
    email: 'arjun@homehaven.in',
    title: 'Modular Furniture & Door Specialist',
    icon: '🪚',
    experience: '10 yrs exp',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
  }
];

export const Login: React.FC<LoginProps> = ({ onNavigate, initialRole = 'customer' }) => {
  const { login, loginWithFirebaseGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'customer' | 'provider' | 'admin'>(initialRole);
  
  // Customer inputs
  const [customerEmail, setCustomerEmail] = useState('ananya@example.com');
  const [customerPassword, setCustomerPassword] = useState('customer123');
  
  // Google account input
  const [googleCustomEmail, setGoogleCustomEmail] = useState(() => {
    return localStorage.getItem('homehaven_last_google_email') || 'harshadithn383@gmail.com';
  });
  const [googleCustomName, setGoogleCustomName] = useState(() => {
    return localStorage.getItem('homehaven_last_google_name') || 'Harshadith N';
  });
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  
  // Specialist inputs
  const [selectedProfession, setSelectedProfession] = useState<ProfessionOption>(PROFESSIONS[0]);
  const [specialistEmail, setSpecialistEmail] = useState(PROFESSIONS[0].email);
  const [specialistPassword, setSpecialistPassword] = useState('provider123');
  
  // Admin inputs
  const [adminEmail, setAdminEmail] = useState('mohitnagalingam12146@gmail.com');
  const [adminPassword, setAdminPassword] = useState('google passis54');
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSelectProfession = (prof: ProfessionOption) => {
    setSelectedProfession(prof);
    setSpecialistEmail(prof.email);
    setSpecialistPassword('provider123');
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail || !customerPassword) {
      showToast('Please enter both email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await login(customerEmail, customerPassword);
      showToast(`Welcome back, ${user.name}!`, 'success');
      onNavigate('customer-dashboard');
    } catch (err: any) {
      showToast(err.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialistEmail || !specialistPassword) {
      showToast('Please enter specialist credentials', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await login(specialistEmail, specialistPassword);
      showToast(`Welcome to your ${selectedProfession.category} Specialist Hub!`, 'success');
      onNavigate('provider-dashboard');
    } catch (err: any) {
      showToast(err.message || 'Specialist login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      showToast('Please enter administrator credentials', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await login(adminEmail, adminPassword);
      showToast(`Administrator authenticated: ${user.name}`, 'success');
      onNavigate('admin-dashboard');
    } catch (err: any) {
      showToast(err.message || 'Admin authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (role: 'customer' | 'provider' | 'admin', customGoogleEmail?: string, customGoogleName?: string) => {
    setGoogleLoading(true);
    try {
      let presetEmail: string | undefined = customGoogleEmail;
      let presetName: string | undefined = customGoogleName;

      if (!presetEmail) {
        if (role === 'admin') {
          presetEmail = 'mohitnagalingam12146@gmail.com';
          presetName = 'Mohit Nagalingam (Admin)';
        } else if (role === 'provider') {
          presetEmail = selectedProfession.email;
          presetName = `${selectedProfession.name} (${selectedProfession.category})`;
        } else if (role === 'customer' && googleCustomEmail) {
          presetEmail = googleCustomEmail;
          presetName = googleCustomName || googleCustomEmail.split('@')[0];
        }
      }

      if (presetEmail) {
        localStorage.setItem('homehaven_last_google_email', presetEmail);
        if (presetName) localStorage.setItem('homehaven_last_google_name', presetName);
      }

      const googleUser = await signInWithGoogleFirebase(presetEmail, presetName);
      const user = await loginWithFirebaseGoogle({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.avatar,
        role,
        profession: role === 'provider' ? selectedProfession.id : undefined
      });

      showToast(`Signed in with Google (Firebase) as ${user.name}!`, 'success');
      if (user.role === 'admin') {
        onNavigate('admin-dashboard');
      } else if (user.role === 'provider') {
        onNavigate('provider-dashboard');
      } else {
        onNavigate('customer-dashboard');
      }
    } catch (err: any) {
      showToast(err.message || 'Google authentication encountered an error', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Container Box */}
      <div className="bg-white rounded-[28px] border border-stone-200/90 shadow-sm overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-stone-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#E36414]/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#E36414] text-white flex items-center justify-center mx-auto shadow-sm">
              <Wrench className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-white">
              HomeHaven Portal Login
            </h1>
            <p className="text-xs text-stone-300 max-w-md mx-auto">
              Select your role to access your dedicated workspace and secure tools
            </p>
          </div>
        </div>

        {/* 3 Portal Selection Tabs */}
        <div className="p-3 bg-stone-100/80 border-b border-stone-200 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'customer'
                ? 'bg-white text-[#0F4C5C] shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <User className="w-4 h-4 text-[#0F4C5C]" />
            <span>Customer Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('provider')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'provider'
                ? 'bg-white text-[#E36414] shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Briefcase className="w-4 h-4 text-[#E36414]" />
            <span>Specialist Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Admin Portal</span>
          </button>
        </div>

        {/* Tab 1: Customer Portal */}
        {activeTab === 'customer' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-serif-display text-stone-900">
                Customer Sign In
              </h2>
              <p className="text-xs text-stone-500">
                Book vetted doorstep home services, track technician arrival & review invoices.
              </p>
            </div>

            {/* Google Auth from Firebase Section */}
            <div className="space-y-3">
              {/* Primary Google Sign In Button */}
              <button
                type="button"
                disabled={googleLoading}
                onClick={() => handleGoogleAuth('customer')}
                className="w-full py-3 px-4 border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 transition-all flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50 group hover:border-[#4285F4]/40"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div className="flex items-center gap-1.5 text-left truncate">
                  <span>{googleLoading ? 'Connecting to Google (Firebase)...' : 'Sign in with Google'}</span>
                  {googleCustomEmail && (
                    <span className="text-[11px] text-stone-500 font-normal truncate">
                      ({googleCustomEmail})
                    </span>
                  )}
                </div>
              </button>

              {/* Google Account Switcher / Custom Account Options */}
              <div className="p-3 bg-stone-50/90 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Google Account for Firebase Sign In:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGoogleAccountPicker(!showGoogleAccountPicker)}
                    className="text-[10px] text-[#0F4C5C] font-semibold hover:underline cursor-pointer"
                  >
                    {showGoogleAccountPicker ? 'Hide Options' : 'Change Account / Custom Gmail'}
                  </button>
                </div>

                {/* Quick Account Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleCustomEmail('harshadithn383@gmail.com');
                      setGoogleCustomName('Harshadith N');
                      handleGoogleAuth('customer', 'harshadithn383@gmail.com', 'Harshadith N');
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      googleCustomEmail === 'harshadithn383@gmail.com'
                        ? 'bg-white border-[#4285F4] text-stone-900 shadow-2xs font-medium ring-1 ring-[#4285F4]/30'
                        : 'bg-white/60 border-stone-200 text-stone-600 hover:bg-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
                    <span>harshadithn383@gmail.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGoogleCustomEmail('customer.google@homehaven.in');
                      setGoogleCustomName('Google Verified User');
                      handleGoogleAuth('customer', 'customer.google@homehaven.in', 'Google Verified User');
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      googleCustomEmail === 'customer.google@homehaven.in'
                        ? 'bg-white border-[#4285F4] text-stone-900 shadow-2xs font-medium ring-1 ring-[#4285F4]/30'
                        : 'bg-white/60 border-stone-200 text-stone-600 hover:bg-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>customer.google@homehaven.in</span>
                  </button>
                </div>

                {/* Optional Custom Google Account Drawer */}
                {showGoogleAccountPicker && (
                  <div className="pt-2 mt-2 border-t border-stone-200 space-y-2">
                    <p className="text-[10px] text-stone-500">
                      Sign in using any Google / Gmail account with Firebase authentication:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">Google Email</label>
                        <input
                          type="email"
                          value={googleCustomEmail}
                          onChange={e => setGoogleCustomEmail(e.target.value)}
                          placeholder="your.email@gmail.com"
                          className="w-full text-xs p-2 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#4285F4]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">Full Name</label>
                        <input
                          type="text"
                          value={googleCustomName}
                          onChange={e => setGoogleCustomName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full text-xs p-2 rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#4285F4]"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={googleLoading || !googleCustomEmail}
                      onClick={() => handleGoogleAuth('customer', googleCustomEmail, googleCustomName)}
                      className="w-full py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Sign In with {googleCustomEmail || 'Google Account'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-stone-200 w-full" />
              <span className="bg-white px-3 text-[11px] text-stone-400 uppercase tracking-wider absolute">
                Or with Email & Password
              </span>
            </div>

            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="e.g. ananya@example.com"
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Password</label>
                <input
                  type="password"
                  value={customerPassword}
                  onChange={e => setCustomerPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0F4C5C] hover:bg-[#0A3642] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In as Customer'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Customer Switcher */}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <span className="text-[11px] font-semibold text-stone-700 block">
                Quick Test Customer Accounts:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerEmail('ananya@example.com');
                    setCustomerPassword('customer123');
                  }}
                  className="p-2 rounded-xl bg-white border border-stone-200 text-left hover:border-[#0F4C5C] transition-colors cursor-pointer"
                >
                  <p className="font-semibold text-stone-800">Ananya Iyer</p>
                  <p className="text-[10px] text-stone-500 font-mono">ananya@example.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerEmail('rohan@example.com');
                    setCustomerPassword('customer123');
                  }}
                  className="p-2 rounded-xl bg-white border border-stone-200 text-left hover:border-[#0F4C5C] transition-colors cursor-pointer"
                >
                  <p className="font-semibold text-stone-800">Rohan Verma</p>
                  <p className="text-[10px] text-stone-500 font-mono">rohan@example.com</p>
                </button>
              </div>
            </div>

            <div className="text-center pt-2 text-xs text-stone-500">
              New Customer?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="text-[#0F4C5C] font-semibold hover:underline cursor-pointer"
              >
                Create a homeowner account
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Specialist Portal */}
        {activeTab === 'provider' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#E36414] uppercase tracking-wider">
                  Specialist Trade Hub
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                  Select Trade Profession
                </span>
              </div>
              <h2 className="text-xl font-bold font-serif-display text-stone-900">
                Specialist Login by Profession
              </h2>
              <p className="text-xs text-stone-500">
                Choose your specific verified profession below to access assigned job requests, manage schedule, and update trade rates.
              </p>
            </div>

            {/* Profession Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700">Choose Your Trade Profession:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROFESSIONS.map(prof => {
                  const isSelected = selectedProfession.id === prof.id;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => handleSelectProfession(prof)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#E36414] bg-orange-50/50 ring-2 ring-[#E36414]/20'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{prof.icon}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#E36414]" />}
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-bold text-stone-900 leading-tight">{prof.category}</p>
                        <p className="text-[10px] text-stone-500 truncate">{prof.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Profession Highlight Card */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E36414] text-white flex items-center justify-center text-lg font-bold">
                  {selectedProfession.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-stone-900">{selectedProfession.name}</p>
                    <span className={`text-[10px] px-2 py-0.2 rounded-full border font-semibold ${selectedProfession.badgeColor}`}>
                      {selectedProfession.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">{selectedProfession.title} · {selectedProfession.experience}</p>
                  <p className="text-[10px] text-stone-400 font-mono">{selectedProfession.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGoogleAuth('provider')}
                className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl text-[11px] font-semibold text-stone-700 flex items-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
                title="Sign in with Google Firebase for this trade"
              >
                <span>Google (Firebase)</span>
              </button>
            </div>

            {/* Specialist Form */}
            <form onSubmit={handleSpecialistSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Specialist Email ({selectedProfession.category})</label>
                <input
                  type="email"
                  value={specialistEmail}
                  onChange={e => setSpecialistEmail(e.target.value)}
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#E36414]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Password</label>
                <input
                  type="password"
                  value={specialistPassword}
                  onChange={e => setSpecialistPassword(e.target.value)}
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#E36414]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#E36414] hover:bg-[#c7550e] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : `Log In as ${selectedProfession.category} Specialist`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-center text-[11px] text-stone-500">
              Only verified specialists with active trade credentials can receive dispatched customer bookings.
            </p>
          </div>
        )}

        {/* Tab 3: Admin Portal */}
        {activeTab === 'admin' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Administrative Access Only
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Admin Hub & Supabase DB Access
                </span>
              </div>
              <h2 className="text-xl font-bold font-serif-display text-stone-900">
                Administrator Command Sign In
              </h2>
              <p className="text-xs text-stone-500">
                Authorized administrators have exclusive access to Admin Hub and Supabase PostgreSQL Database.
              </p>
            </div>

            {/* Admin Credentials Showcase Box */}
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  Designated Admin Credentials:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-semibold">
                  ACTIVE
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white p-2 rounded-xl border border-emerald-200">
                  <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Admin Gmail</span>
                  <span className="text-stone-800 font-semibold break-all">mohitnagalingam12146@gmail.com</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-emerald-200">
                  <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Admin Password</span>
                  <span className="text-stone-800 font-semibold">google passis54</span>
                </div>
              </div>
            </div>

            {/* Google Auth with Firebase for Admin */}
            <button
              type="button"
              disabled={googleLoading}
              onClick={() => handleGoogleAuth('admin')}
              className="w-full py-3 px-4 border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 transition-all flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? 'Signing in with Google...' : 'Sign In as Admin with Google (Firebase)'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-stone-200 w-full" />
              <span className="bg-white px-3 text-[11px] text-stone-400 uppercase tracking-wider absolute">
                Or Direct Admin Login
              </span>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Administrator Gmail</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>{loading ? 'Authenticating Admin...' : 'Log In as Admin (Mohit Nagalingam)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-[11px] text-stone-500">
              <p className="font-semibold text-stone-700">🔒 High Security Zone:</p>
              <p>Only this admin account is authorized to view the Admin Hub, approve pending specialists, and configure Supabase PostgreSQL database architecture.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
