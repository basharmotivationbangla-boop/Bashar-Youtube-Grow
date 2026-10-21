import React, { useState } from 'react';
import { 
  Play, 
  PlusCircle, 
  LayoutDashboard, 
  Coins, 
  LogOut, 
  User as UserIcon,
  HelpCircle,
  Gift,
  MoreVertical,
  X,
  Trash2,
  ChevronRight,
  Sparkles,
  Users,
  Flame,
  Key,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logOut } from '../firebase';

interface NavbarProps {
  currentTab: 'watch' | 'create' | 'dashboard';
  onSelectTab: (tab: 'watch' | 'create' | 'dashboard') => void;
  onOpenHowItWorks: () => void;
  onOpenDailyCheckIn: () => void;
  onOpenRedeemModal: () => void;
  onOpenReferralModal?: () => void;
  onOpenDatabaseStatus?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  onSelectTab, 
  onOpenHowItWorks,
  onOpenDailyCheckIn,
  onOpenRedeemModal,
  onOpenReferralModal,
  onOpenDatabaseStatus
}) => {
  const { userProfile, openAuthModal } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isClaimedToday = userProfile?.lastCheckInDate === todayStr;

  const handleSignOut = async () => {
    try {
      await logOut();
      setUserDropdownOpen(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSelectNav = (tab: 'watch' | 'create' | 'dashboard') => {
    onSelectTab(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-2xl border-b border-slate-800/80 text-white shadow-xl shadow-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Left: 3-Dots Menu Button + Brand Logo & Title */}
            <div className="flex items-center gap-3">
              {/* 3-DOTS MENU BUTTON - Placed directly to the LEFT of the brand */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="relative p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 hover:border-red-500/50 text-slate-300 hover:text-white transition-all shadow-md group cursor-pointer active:scale-95"
                title="মেনু খুলুন (ভিডিও ভিউ, ক্যাম্পেইন তৈরি, ড্যাশবোর্ড)"
              >
                <MoreVertical className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                <span className="sr-only">Menu</span>
              </button>

              {/* Brand Logo & Title (Clean, no open tabs next to it) */}
              <div 
                onClick={() => onSelectTab('watch')}
                className="flex items-center gap-3 cursor-pointer group select-none"
              >
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 group-hover:shadow-red-500/40 transition-all duration-300 shrink-0">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-white/30" />
                </div>
                <div>
                  <h1 className="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                    Bashar Youtube Grow
                  </h1>
                  <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                    ১ সেকেন্ড ভিডিও ভিউ = ১ ক্রেডিট পয়েন্ট
                  </p>
                </div>
              </div>
            </div>

            {/* Middle: Desktop Segmented Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 border border-slate-800/90 p-1 rounded-2xl shadow-inner">
              <button
                onClick={() => onSelectTab('watch')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'watch'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>ভিডিও দেখুন</span>
              </button>

              <button
                onClick={() => onSelectTab('create')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'create'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>ক্যাম্পেইন তৈরি</span>
              </button>

              <button
                onClick={() => onSelectTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>আমার ড্যাশবোর্ড</span>
              </button>
            </nav>

            {/* Right Elements: Promo Code + Daily Check-in + Help + Credits + Auth */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Powerful Cloud Database Status Indicator & Modal Trigger */}
              <button
                onClick={onOpenDatabaseStatus}
                title="Google Cloud Firestore ডাটাবেস স্ট্যাটাস দেখুন"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 hover:text-emerald-200 transition-all shadow-sm cursor-pointer active:scale-95 group"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="hidden xl:inline">ক্লাউড ডাটাবেস</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-sm"></span>
                </span>
              </button>

              {/* Promo Code Quick Redeem Button */}
              <button
                onClick={onOpenRedeemModal}
                title="প্রমো কোড রিডিম করুন"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">প্রমো কোড</span>
              </button>

              {/* Help button */}
              <button
                onClick={onOpenHowItWorks}
                title="কীভাবে কাজ করে?"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors border border-transparent hover:border-slate-700/60 cursor-pointer"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Daily Check-in Button */}
              {userProfile ? (
                <button
                  onClick={onOpenDailyCheckIn}
                  title="দৈনিক চেক-ইন বোনাস"
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    !isClaimedToday
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white shadow-red-500/20 active:scale-95 animate-pulse'
                      : 'bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Gift className={`w-3.5 h-3.5 ${!isClaimedToday ? 'text-amber-200 animate-bounce' : 'text-amber-400'}`} />
                  <span className="hidden sm:inline">
                    {!isClaimedToday ? 'দৈনিক বোনাস' : `${userProfile.checkInStreak || 1} দিন স্ট্রিক`}
                  </span>
                  {!isClaimedToday && (
                    <span className="w-2 h-2 rounded-full bg-amber-300 absolute -top-0.5 -right-0.5 animate-ping" />
                  )}
                </button>
              ) : null}



              {/* Credit Balance Badge */}
              {userProfile ? (
                <div 
                  onClick={() => onSelectTab('dashboard')}
                  className="group flex items-center gap-2 bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-orange-500/10 border border-amber-500/30 hover:border-amber-400/60 px-3.5 py-1.5 rounded-2xl cursor-pointer transition-all shadow-md shadow-amber-500/5 hover:scale-[1.02]"
                >
                  <Coins className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-amber-300 text-sm font-mono tracking-tight">
                      {userProfile.credits.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-amber-200/70 font-semibold">পয়েন্ট</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-2xl text-xs font-bold hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  <span>+৫০০ ক্রেডিট ফ্রি</span>
                </button>
              )}

              {/* User Profile / Login */}
              {userProfile ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
                  >
                    {userProfile.photoURL ? (
                      <img
                        src={userProfile.photoURL}
                        alt={userProfile.displayName}
                        className="w-7 h-7 rounded-xl object-cover ring-1 ring-slate-700"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        {userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-200 max-w-[90px] truncate hidden sm:block">
                      {userProfile.displayName || 'User'}
                    </span>
                  </button>

                  {userDropdownOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-slate-200 animate-fadeIn"
                      onMouseLeave={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-4 py-2.5 border-b border-slate-800">
                        <p className="text-xs font-bold text-white truncate">{userProfile.displayName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{userProfile.email}</p>
                        <div className="mt-2 flex items-center justify-between text-xs bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-slate-400">ব্যালেন্স:</span>
                          <span className="font-extrabold text-amber-400 font-mono">{userProfile.credits.toLocaleString()} ক্রেডিট</span>
                        </div>
                      </div>

                      {/* Daily Check-in Option */}
                      <button
                        onClick={() => {
                          onOpenDailyCheckIn();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-800/60"
                      >
                        <div className="flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-amber-300">দৈনিক চেক-ইন বোনাস</span>
                        </div>
                        {!isClaimedToday ? (
                          <span className="text-[10px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            ক্লেইম করুন
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            🔥 {userProfile.checkInStreak || 1} দিন
                          </span>
                        )}
                      </button>



                      {/* Promo Code Option */}
                      <button
                        onClick={() => {
                          onOpenRedeemModal();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-800/60 text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>প্রমো কোড রিডিম</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('dashboard');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                        <span>আমার ড্যাশবোর্ড ও হিস্টোরি</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('create');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>নতুন ভিডিও ক্যাম্পেইন তৈরি</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('dashboard');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ভিডিও মুছুন / পরিচালনা</span>
                      </button>

                      <div className="border-t border-slate-800 mt-1 pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>লগআউট (Sign Out)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>লগইন / সাইন আপ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3-DOTS SIDEBAR DRAWER - Opens when clicking 3-dots icon */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs bg-slate-950 border-r border-slate-800/90 shadow-2xl p-6 flex flex-col justify-between z-10 animate-fadeIn">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-md">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-white">Bashar YouTube Grow</h2>
                    <p className="text-[10px] text-slate-400">মেনু নির্বাচন করুন</p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Options (The 3 Main Features) */}
              <div className="mt-6 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2">
                  প্রধান মেনু
                </p>

                {/* 1. ভিডিও ভিউ */}
                <button
                  onClick={() => handleSelectNav('watch')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    currentTab === 'watch'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      currentTab === 'watch' ? 'bg-white/20' : 'bg-red-500/10 text-red-400'
                    }`}>
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <span>ভিডিও ভিউ (Watch)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>

                {/* 2. ক্যাম্পেইন তৈরি */}
                <button
                  onClick={() => handleSelectNav('create')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    currentTab === 'create'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      currentTab === 'create' ? 'bg-white/20' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <span>ক্যাম্পেইন তৈরি (Add)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>

                {/* 3. আমার ড্যাশবোর্ড */}
                <button
                  onClick={() => handleSelectNav('dashboard')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    currentTab === 'dashboard'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      currentTab === 'dashboard' ? 'bg-white/20' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <span>আমার ড্যাশবোর্ড</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>

                {/* 4. দৈনিক চেক-ইন বোনাস */}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenDailyCheckIn();
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                    userProfile && !isClaimedToday
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 active:scale-[0.99]'
                      : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      userProfile && !isClaimedToday ? 'bg-black/20 text-slate-950' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <Gift className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span>দৈনিক চেক-ইন বোনাস</span>
                        {userProfile && !isClaimedToday && (
                          <span className="text-[10px] bg-black text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                            রেডি!
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${userProfile && !isClaimedToday ? 'text-slate-900/80 font-bold' : 'text-slate-400 font-normal'}`}>
                        {userProfile 
                          ? (isClaimedToday ? `স্ট্রিক: ${userProfile.checkInStreak || 1} দিন সম্পন্ন` : 'আজকের বোনাস এখনো নেওয়া হয়নি')
                          : 'প্রতিদিন লগইন করে ক্রেডিট পান'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>


                {/* 6. প্রমো কোড রিডিম */}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenRedeemModal();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>প্রমো কোড রিডিম করুন</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>

                {/* 7. শক্তিশালী ক্লাউড ডাটাবেস */}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenDatabaseStatus?.();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>শক্তিশালী ক্লাউড ডাটাবেস</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">লাইভ</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                </button>

                {/* Special Video Delete / Management shortcut */}
                <div className="pt-2">
                  <button
                    onClick={() => handleSelectNav('dashboard')}
                    className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4" />
                      <span>ভিডিও মুছুন ও রিফান্ড নিন</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Footer: Balance & Rules */}
            <div className="space-y-3 pt-6 border-t border-slate-800">
              {userProfile ? (
                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-300">ব্যালেন্স</span>
                  </div>
                  <span className="font-black text-amber-300 font-mono text-sm">
                    {userProfile.credits.toLocaleString()} ক্রেডিট
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    openAuthModal();
                  }}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold text-center"
                >
                  লগইন করুন (+৫০০ ক্রেডিট)
                </button>
              )}

              {/* Firebase Firestore & Auth Status Badge */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  Firebase Firestore & Auth
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  সক্রিয়
                </span>
              </div>

              <button
                onClick={() => {
                  setDrawerOpen(false);
                  onOpenHowItWorks();
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-white text-center flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>নিয়মাবলী কীভাবে কাজ করে?</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
