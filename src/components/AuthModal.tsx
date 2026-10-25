import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, AlertCircle, Eye, EyeOff, User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logInWithEmail, signUpWithEmail } from '../firebase';
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
        <div className="p-6 space-y-5">
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
