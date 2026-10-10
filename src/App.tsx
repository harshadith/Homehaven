import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastContainer } from './components/ui/Toast.js';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';

// Pages
import { Home } from './pages/Home.js';
import { Services } from './pages/Services.js';
import { ServiceDetail } from './pages/ServiceDetail.js';
import { ProviderList } from './pages/ProviderList.js';
import { BookingPage } from './pages/BookingPage.js';
import { MyBookings } from './pages/MyBookings.js';
import { BookingDetail } from './pages/BookingDetail.js';
import { HomeProfile } from './pages/HomeProfile.js';
import { CustomerDashboard } from './pages/customer/Dashboard.js';
import { ProviderDashboard } from './pages/provider/Dashboard.js';
import { ManageAvailability } from './pages/provider/ManageAvailability.js';
import { JobRequests } from './pages/provider/JobRequests.js';
import { AdminDashboard } from './pages/admin/Dashboard.js';
import { ManageServices } from './pages/admin/ManageServices.js';
import { ManageProviders } from './pages/admin/ManageProviders.js';
import { ManageBookings } from './pages/admin/ManageBookings.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { SupabaseArchitecturePage } from './pages/SupabaseArchitecturePage.js';

function MainApp() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [tabParam, setTabParam] = useState<any>(null);

  const navigate = (tab: string, param?: any) => {
    setCurrentTab(tab);
    setTabParam(param || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Home onNavigate={navigate} />;

      case 'services':
        return <Services onNavigate={navigate} initialFilter={typeof tabParam === 'string' ? tabParam : undefined} />;

      case 'service-detail':
        return <ServiceDetail serviceId={tabParam} onNavigate={navigate} />;

      case 'providers':
        return <ProviderList onNavigate={navigate} />;

      case 'book':
        return (
          <BookingPage
            initialServiceId={tabParam?.serviceId}
            initialProviderId={tabParam?.providerId}
            onNavigate={navigate}
          />
        );

      case 'my-bookings':
        return <MyBookings onNavigate={navigate} />;

      case 'booking-detail':
        return <BookingDetail bookingId={tabParam} onNavigate={navigate} />;

      case 'home-profile':
        return <HomeProfile onNavigate={navigate} />;

      case 'customer-dashboard':
        return <CustomerDashboard onNavigate={navigate} />;

      case 'provider-dashboard':
        return <ProviderDashboard onNavigate={navigate} />;

      case 'provider-availability':
        return <ManageAvailability onNavigate={navigate} />;

      case 'provider-jobs':
        return <JobRequests onNavigate={navigate} />;

      case 'admin-dashboard':
        if (user?.role !== 'admin') {
          return (
            <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-2xl">
                🛡️
              </div>
              <h2 className="text-xl font-bold font-serif-display text-stone-900">
                Admin Command Center Restricted
              </h2>
              <p className="text-xs text-stone-500">
                The Admin Hub and operational tools are exclusively available to platform administrators.
              </p>
              <button
                type="button"
                onClick={() => navigate('login', 'admin')}
                className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                Sign In as Administrator
              </button>
            </div>
          );
        }
        return <AdminDashboard onNavigate={navigate} />;

      case 'admin-services':
        if (user?.role !== 'admin') return <Login onNavigate={navigate} initialRole="admin" />;
        return <ManageServices onNavigate={navigate} />;

      case 'admin-providers':
        if (user?.role !== 'admin') return <Login onNavigate={navigate} initialRole="admin" />;
        return <ManageProviders onNavigate={navigate} />;

      case 'admin-bookings':
        if (user?.role !== 'admin') return <Login onNavigate={navigate} initialRole="admin" />;
        return <ManageBookings onNavigate={navigate} />;

      case 'login':
        return <Login onNavigate={navigate} initialRole={tabParam === 'admin' ? 'admin' : (tabParam === 'provider' ? 'provider' : 'customer')} />;

      case 'register':
        return <Register onNavigate={navigate} />;

      case 'supabase-architecture':
        if (user?.role !== 'admin') {
          return (
            <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto text-2xl">
                🔒
              </div>
              <h2 className="text-xl font-bold font-serif-display text-stone-900">
                Admin Portal Only: Supabase DB
              </h2>
              <p className="text-xs text-stone-500">
                Only the administrator portal can access the Admin Hub and Supabase PostgreSQL Database console.
              </p>
              <button
                type="button"
                onClick={() => navigate('login', 'admin')}
                className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                Sign In as Administrator
              </button>
            </div>
          );
        }
        return <SupabaseArchitecturePage onNavigate={navigate} />;

      default:
        return <Home onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF7F0] text-[#1A1A2E]">
      <ToastContainer />
      <Navbar currentTab={currentTab} onNavigate={navigate} />
      <main className="flex-1">
        {renderContent()}
      </main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
