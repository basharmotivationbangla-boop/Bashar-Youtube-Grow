import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, AlertCircle, Eye, EyeOff, User, Mail, Lock, ArrowRight, Sparkles, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logInWithEmail, signUpWithEmail, signInWithGoogle, signInAsBasharOwner, OWNER_BASHAR_EMAIL } from '../firebase';
import confetti from 'canvas-confetti';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Form fields: নাম, gmail, password
  const [name, setName] = useState<string>('');
  const [gmail, setGmail] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('bashar_recent_gmail') || '';
  });
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setError(null);
      const saved = localStorage.getItem('bashar_recent_gmail');
      if (saved && !gmail) setGmail(saved);
    }
  }, [isAuthModalOpen]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      setError(err?.message || 'গুগল দিয়ে সাইন ইন করতে সমস্যা হয়েছে। দয়া করে নিচের ফর্মে আপনার Gmail দিয়ে লগইন করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerAccess = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAsBasharOwner();
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 } });
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'মালিক অ্যাকাউন্ট লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanGmail = gmail.trim().toLowerCase();
    if (!cleanGmail) {
      setError('অনুগ্রহ করে আপনার Gmail বা ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (!password) {
      setError('অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন।');
      return;
    }

    setLoading(true);

    try {
      if (activeTab === 'signup') {
        const cleanName = name.trim();
        if (!cleanName) {
          setError('অনুগ্রহ করে আপনার পুরো নাম লিখুন।');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে।');
          setLoading(false);
          return;
        }

        await signUpWithEmail(cleanName, cleanGmail, password);
      } else {
        await logInWithEmail(cleanGmail, password);
      }

      confetti({ particleCount: 130, spread: 90, origin: { y: 0.5 } });
      closeAuthModal();
      setPassword('');
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err?.message || 'প্রবেশ করতে সমস্যা হয়েছে। দয়া করে সঠিক তথ্য দিন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner highlighting Welcome Bonus */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg shrink-0">
                <Gift className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <span className="font-black text-base sm:text-lg tracking-wide block">
                  ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস!
                </span>
                <span className="text-xs text-white/90 font-medium">
                  {activeTab === 'signup' ? 'নতুন অ্যাকাউন্ট খুললেই ৫০০ ক্রেডিট পাবেন' : 'লগইন করে ভিডিও দেখে ক্রেডিট সংগ্রহ করুন'}
                </span>
              </div>
            </div>
            <button
              onClick={closeAuthModal}
              className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-black/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* 1. Official Google Sign-In with Firebase Auth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 active:scale-98"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google অ্যাকাউন্ট দিয়ে সরাসরি সাইন ইন করুন</span>
          </button>

          {/* 2. Platform Owner / Super Admin Quick Access ("Add me" basharmotivationbangla@gmail.com) */}
          <button
            type="button"
            onClick={handleOwnerAccess}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-red-600/20 via-amber-600/20 to-red-600/20 hover:from-red-600/30 hover:to-amber-600/30 border border-red-500/40 text-red-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 group"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>আমি বশার (Owner / Super Admin)</span>
            </div>
            <span className="text-[10px] bg-red-600 text-white font-mono px-2 py-0.5 rounded-full font-black">
              1-Click
            </span>
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">অথবা Gmail ও পাসওয়ার্ড</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Tabs: Log in / Sign up */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Log in</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Sign up</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-full">+৫০০</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* নাম (Name) - only on Sign up */}
            {activeTab === 'signup' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>নাম (Name):</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="আপনার পুরো নাম লিখুন"
                    required={activeTab === 'signup'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Gmail (ইমেইল) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Gmail / ইমেইল:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  placeholder="example@gmail.com"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                />
              </div>
            </div>

            {/* Password (পাসওয়ার্ড) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Password (পাসওয়ার্ড):</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeTab === 'signup' ? 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড' : 'পাসওয়ার্ড লিখুন'}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-600/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : activeTab === 'signup' ? (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Sign up সম্পন্ন করুন (+৫০০ ক্রেডিট)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  <span>Log in করুন</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Switch tab text link */}
          <div className="text-center pt-1 text-xs">
            {activeTab === 'login' ? (
              <p className="text-slate-400">
                নতুন ব্যবহারকারী?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setError(null);
                  }}
                  className="text-amber-300 font-bold hover:underline cursor-pointer ml-1"
                >
                  Sign up করে ৫০০ ক্রেডিট বোনাস নিন
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                  }}
                  className="text-amber-300 font-bold hover:underline cursor-pointer ml-1"
                >
                  Log in করুন
                </button>
              </p>
            )}
          </div>

          {/* Perks Section */}
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Sign up করলেই তাৎক্ষণিক ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>১ সেকেন্ড ভিডিও ভিউ = ১ ক্রেডিট পয়েন্ট অর্জন</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>নিজের YouTube ভিডিও সরাসরি প্রচারের সুবিধা</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Bashar YouTube Grow • নিরাপদ অ্যাকাউন্ট ও অর্গানিক ওয়াচটাইম
        </div>
      </div>
    </div>
  );
};
