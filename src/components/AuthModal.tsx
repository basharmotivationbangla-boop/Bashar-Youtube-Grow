import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, AlertCircle, Zap, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, signInWithGoogleDirect } from '../firebase';
import confetti from 'canvas-confetti';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userGmail, setUserGmail] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('bashar_recent_gmail') || '';
  });

  useEffect(() => {
    if (isAuthModalOpen) {
      setError(null);
      const saved = localStorage.getItem('bashar_recent_gmail');
      if (saved) setUserGmail(saved);
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  // 1. Primary Google Popup Sign In (Fast 3.5s timeout to prevent hanging)
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle(undefined, 3500);
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Google sign-in attempt notice:', err?.code, err?.message);
      
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। প্রবেশ করতে আবার চেষ্টা করুন বা নিচে Gmail লিখুন।');
      } else if (err?.code === 'auth/popup-timeout') {
        setError('ব্রাউজারে Google পপআপ আসতে দেরি হচ্ছে। সময় বাঁচাতে নিচে সরাসরি আপনার Gmail লিখে "১-সেকেন্ডে প্রবেশ" বাটনে ক্লিক করুন:');
      } else {
        setError('দ্রুত প্রবেশ করতে নিচে সরাসরি আপনার Gmail আইডি লিখে সাইন ইন করুন:');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct 1-Second Instant Login with User's Gmail
  const handleDirectGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let clean = userGmail.trim().toLowerCase();
    if (!clean) {
      setError('দয়া করে আপনার সঠিক Gmail আইডি লিখুন।');
      return;
    }
    if (!clean.includes('@')) {
      clean = `${clean}@gmail.com`;
    }

    setLoading(true);
    setError(null);

    try {
      // Save for lightning-fast 1-click access next time
      if (typeof window !== 'undefined') {
        localStorage.setItem('bashar_recent_gmail', clean);
      }
      
      await signInWithGoogleDirect(clean);
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.error('Direct sign in error:', err);
      setError(err?.message || 'প্রবেশ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
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
                  Google দিয়ে দ্রুত প্রবেশ করুন ও ভিডিও দেখে ক্রেডিট নিন
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
          {/* Header Title & Policy */}
          <div className="text-center space-y-1.5 py-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/15 text-xs text-slate-200 font-semibold mb-1">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>তাৎক্ষণিক Google সাইন-ইন</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Google দিয়ে প্রবেশ করুন
            </h3>
            <p className="text-xs text-amber-300/90 font-medium leading-relaxed max-w-sm mx-auto">
              ⚠️ সতর্কবার্তা: Google দিয়ে প্রবেশ না করলে ভিডিও দেখলে ক্রেডিট নেওয়া যাবে না।
            </p>
          </div>

          {/* Action 1: Official Google Sign-In Button */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-black py-3.5 px-5 rounded-2xl transition-all shadow-xl shadow-white/10 active:scale-[0.98] disabled:opacity-50 text-sm cursor-pointer border border-slate-200"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google দিয়ে প্রবেশ করুন</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-400 whitespace-nowrap">
              বা সময় বাঁচাতে আপনার Gmail দিয়ে ১-সেকেন্ডে দ্রুত প্রবেশ
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Action 2: 1-Second Instant Gmail Login Form */}
          <form onSubmit={handleDirectGmailSubmit} className="space-y-2.5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>আপনার Gmail আইডি:</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>তাৎক্ষণিক লগইন</span>
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={userGmail}
                onChange={(e) => setUserGmail(e.target.value)}
                placeholder="name@gmail.com"
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={loading || !userGmail.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1 shadow-md shadow-red-600/20 active:scale-95 transition-all"
              >
                <span>১-সেকেন্ডে প্রবেশ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Value Perks List */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              <span>গুগল দিয়ে প্রবেশ করলেই ভিডিও দেখে সাথে সাথে ক্রেডিট জমা হবে</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>প্রতিটি অ্যাকাউন্টে তাৎক্ষণিক ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>১ সেকেন্ড ভিডিও ভিউ = ১ ক্রেডিট পয়েন্ট অর্জন</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ক্যাম্পেইন তৈরি করে নিজের YouTube ভিডিও সরাসরি প্রকাশ করুন</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Bashar YouTube Grow • ১০০% নিরাপদ Google সাইন-ইন ও অর্গানিক ওয়াচটাইম
        </div>
      </div>
    </div>
  );
};
