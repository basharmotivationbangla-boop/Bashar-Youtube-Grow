import React, { useState } from 'react';
import { X, Gift, CheckCircle2, ArrowRight, User, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, signInWithGoogleDirect } from '../firebase';
import confetti from 'canvas-confetti';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userGmail, setUserGmail] = useState('');

  if (!isAuthModalOpen) return null;

  // 1. Primary Google Popup Sign In
  const handleGooglePopupSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle(userGmail.trim());
      confetti({ particleCount: 110, spread: 85, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Google popup auth caught:', err?.code, err?.message);
      // If user typed their email, use it directly
      if (userGmail.trim()) {
        try {
          await signInWithGoogleDirect(userGmail.trim());
          confetti({ particleCount: 110, spread: 85, origin: { y: 0.5 } });
          closeAuthModal();
          return;
        } catch (fallbackErr: any) {
          setError(fallbackErr?.message || 'প্রবেশ করতে সমস্যা হয়েছে।');
        }
      } else {
        setError('পপআপ ব্লক হয়েছে অথবা অনুমোদন নেই। নিচে আপনার নিজস্ব Gmail আইডিটি লিখুন এবং সরাসরি প্রবেশ করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Sign In with user's own Gmail ID
  const handleDirectGmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = userGmail.trim();
    if (!clean) {
      setError('দয়া করে আপনার নিজস্ব Gmail আইডি লিখুন (যেমন: name@gmail.com)');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signInWithGoogleDirect(clean);
      confetti({ particleCount: 110, spread: 85, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.error('Direct Gmail login error:', err);
      setError(err?.message || 'প্রবেশ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner highlighting Welcome Bonus */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                <Gift className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <div>
                <span className="font-black text-base sm:text-lg tracking-wide block">
                  ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস!
                </span>
                <span className="text-xs text-white/90 font-medium">
                  Google দিয়ে সরাসরি যুক্ত হোন ও ভিডিও প্রকাশ করুন
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
          {/* Explanatory Info */}
          <div className="text-center space-y-1.5 py-1">
            <h3 className="text-base sm:text-lg font-black text-white">
              Google / Gmail দিয়ে সরাসরি প্রবেশ
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              যেকোনো ব্যবহারকারী তার নিজস্ব Gmail আইডি দিয়ে তাৎক্ষণিক যুক্ত হতে পারবেন। কোনো পাসওয়ার্ডের ঝামেলা নেই।
            </p>
          </div>

          {/* Primary Action: Google 1-Click Popup Button */}
          <button
            type="button"
            onClick={handleGooglePopupSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-black py-3.5 px-5 rounded-2xl transition-all shadow-xl shadow-white/10 active:scale-[0.98] disabled:opacity-50 text-sm sm:text-base cursor-pointer border border-slate-200"
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
                <span>Google দিয়ে ১-ক্লিকে প্রবেশ করুন</span>
                <ArrowRight className="w-4 h-4 text-slate-700" />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-bold uppercase tracking-wider shrink-0">
              অথবা আপনার Gmail আইডি দিয়ে
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Form for ANY user to enter their own Gmail */}
          <form onSubmit={handleDirectGmailSignIn} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-red-400" />
                <span>আপনার Gmail আইডি লিখুন:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userGmail}
                  onChange={(e) => setUserGmail(e.target.value)}
                  placeholder="আপনার নাম@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                যে কেউ তার নিজস্ব Gmail আইডি দিয়ে স্বতন্ত্র অ্যাকাউন্ট তৈরি করতে পারবেন।
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>এই Gmail দিয়ে প্রবেশ করুন (+৫০০ ক্রেডিট)</span>
            </button>
          </form>

          {/* Error Notice */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Value Perks List */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>কোনো পাসওয়ার্ড বা দীর্ঘ সাইন আপ ফরম নেই</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>প্রতিটি অ্যাকাউন্টে তাৎক্ষণিক ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ক্যাম্পেইন তৈরি করে নিজের YouTube ভিডিও সরাসরি প্রকাশ করুন</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>১ সেকেন্ড ভিডিও ভিউ = ১ ক্রেডিট পয়েন্ট অর্জন</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Bashar YouTube Grow • ১০০% নিরাপদ ভিডিও ভিউ ও ক্যাম্পেইন প্ল্যাটফর্ম
        </div>
      </div>
    </div>
  );
};
