import React, { useState } from 'react';
import { X, Mail, Lock, User, Gift, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Flame, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signUpWithEmail, loginWithEmail, signInWithGoogle, loginAnonymously } from '../firebase';
import confetti from 'canvas-confetti';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleInstantGuestSignIn = async () => {
    setError(null);
    setLoading(true);
    setShowGooglePrompt(false);
    try {
      await loginAnonymously();
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Anonymous login error:', err?.code, err?.message);
      if (err?.code === 'auth/operation-not-allowed') {
        setShowGooglePrompt(true);
        setError('Firebase এ Anonymous বা Email সাইন-ইন চালু নেই। দয়া করে "Google দিয়ে সাইন ইন করুন" বাটনে ক্লিক করুন।');
      } else {
        setError(err?.message || 'গেস্ট লগইন করার সময় সমস্যা হয়েছে।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Google sign-in notice:', err?.code, err?.message);
      setError(err?.message || 'গুগল দিয়ে লগইন করার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);
    setShowGooglePrompt(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('ইমেইল ও পাসওয়ার্ড প্রদান করুন।');
      return;
    }

    if (password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        try {
          await signUpWithEmail(cleanEmail, password, displayName.trim() || cleanEmail.split('@')[0]);
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          closeAuthModal();
        } catch (signupErr: any) {
          // If email is already registered, automatically log in with the provided password!
          if (signupErr?.code === 'auth/email-already-in-use') {
            try {
              await loginWithEmail(cleanEmail, password);
              confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
              closeAuthModal();
              return;
            } catch (autoLoginErr: any) {
              setError('এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি আছে। দয়া করে সঠিক পাসওয়ার্ড দিয়ে লগইন করুন অথবা নিচে Google সাইন ইন ব্যবহার করুন।');
            }
          } else {
            throw signupErr;
          }
        }
      } else {
        await loginWithEmail(cleanEmail, password);
        closeAuthModal();
      }
    } catch (err: any) {
      console.warn('Firebase Auth notice:', err?.code, err?.message);
      let msg = err?.message || 'লগইন বা সাইন আপ ব্যর্থ হয়েছে।';
      if (err?.code === 'auth/operation-not-allowed') {
        setShowGooglePrompt(true);
        msg = 'আপনার Firebase কনসোলে Email/Password সাইন-ইন সক্রিয় (Enable) করা নেই। দয়া করে নিচের "Google দিয়ে সাইন ইন করুন" বাটনে ক্লিক করে সাথে সাথে প্রবেশ করুন।';
      } else if (err?.code === 'auth/email-already-in-use') {
        msg = 'এই ইমেইল দিয়ে ইতিমধ্যে একাউন্ট তৈরি করা আছে। দয়া করে লগইন করুন।';
      } else if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        msg = 'ভুল ইমেইল অথবা পাসওয়ার্ড। আবার চেষ্টা করুন।';
      } else if (err?.code === 'auth/user-not-found') {
        msg = 'এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি। সাইন আপ করুন।';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'সঠিক ইমেইল ঠিকানা প্রদান করুন।';
      } else if (err?.code === 'auth/network-request-failed') {
        msg = 'ইন্টারনেট সংযোগ চেক করুন এবং পুনরায় চেষ্টা করুন।';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Instant Fresh 1-Click Sign-up
  const handleInstantFreshSignUp = async () => {
    setError(null);
    setLoading(true);
    setShowGooglePrompt(false);
    const randNum = Math.floor(100000 + Math.random() * 900000);
    const freshEmail = `user_${randNum}@basharyt.com`;
    const freshPass = 'bashar123456';
    const freshName = `User ${randNum}`;

    try {
      await signUpWithEmail(freshEmail, freshPass, freshName);
      confetti({ particleCount: 120, spread: 85, origin: { y: 0.5 } });
      closeAuthModal();
    } catch (err: any) {
      console.warn('Instant signup notice:', err?.code, err?.message);
      if (err?.code === 'auth/operation-not-allowed') {
        setShowGooglePrompt(true);
        setError('আপনার Firebase কনসোলে Email/Password সাইন-ইন চালু নেই। নিচের Google সাইন-ইন ব্যবহার করে তৎক্ষণাৎ প্রবেশ করুন।');
      } else {
        setError('নতুন অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate a random email into form
  const handleGenerateFreshEmail = () => {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setEmail(`bashar_${randNum}@gmail.com`);
    setPassword('bashar123456');
    setDisplayName(`Bashar User ${randNum}`);
    setError(null);
    setSuccessInfo('নতুন ইউনিক ইমেইল ও পাসওয়ার্ড বসানো হয়েছে!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner highlighting Welcome Bonus */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-300 animate-bounce" />
              <span className="font-extrabold text-sm sm:text-base tracking-wide">
                ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস!
              </span>
            </div>
            <button
              onClick={closeAuthModal}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-black/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-white/90 mt-1 font-medium">
            সাইন আপ করলেই আপনার Firebase Firestore অ্যাকাউন্টে তাৎক্ষণিক ৫০০ ক্রেডিট জমা হবে।
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Firebase Badge */}
          <div className="flex items-center justify-between px-3 py-1.5 mb-4 rounded-xl bg-slate-800/80 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Firebase Firestore & Auth</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              রিয়েল-টাইম ক্লাউড ডাটাবেস
            </span>
          </div>

          {/* Google Sign In Direct Option (Active on Firebase project bashar-apk-app) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full mb-3 flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-bold py-2.5 px-4 rounded-2xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm cursor-pointer ${
              showGooglePrompt ? 'ring-2 ring-amber-400 animate-pulse' : ''
            }`}
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
            <span>Google দিয়ে সাইন ইন করুন</span>
          </button>

          {/* Instant 1-Click Guest Sign In */}
          <button
            type="button"
            onClick={handleInstantGuestSignIn}
            disabled={loading}
            className="w-full mb-3 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-2xl transition-all shadow-md shadow-emerald-900/30 active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>⚡ তাৎক্ষণিক ১-ক্লিক গেস্ট লগইন (পাসওয়ার্ড ছাড়াই)</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 font-medium">অথবা পাসওয়ার্ড দিয়ে</span>
            </div>
          </div>

          {/* Switch Tab */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mb-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setSuccessInfo(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                isSignUp
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              নতুন একাউন্ট (Sign Up)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setSuccessInfo(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                !isSignUp
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              লগইন (Sign In)
            </button>
          </div>

          {/* Success notice */}
          {successInfo && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Error notice with contextual Google action */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {showGooglePrompt && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>এখনই Google দিয়ে প্রবেশ করুন</span>
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  আপনার নাম (Full Name)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="যেমন: Bashar Ahmed"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  ইমেইল এড্রেস (Email Address)
                </label>
                {isSignUp && (
                  <button
                    type="button"
                    onClick={handleGenerateFreshEmail}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>নতুন ইমেইল জেনারেট</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                পাসওয়ার্ড (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Perks for signing up */}
            {isSignUp && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>তাত্ক্ষণিক ৫০০ ক্রেডিট ফ্রি স্বয়ংক্রিয়ভাবে জমা হবে</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Firebase Firestore-এ পয়েন্ট ও ক্যাম্পেইন সুরক্ষিত থাকবে</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-red-600/30 active:scale-[0.98] disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'ইমেইল দিয়ে সাইন আপ করুন (+৫০০ ক্রেডিট)' : 'ইমেইল দিয়ে লগইন করুন'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>দ্রুত টেস্ট তথ্য বসাতে চান?</span>
            <button
              type="button"
              onClick={handleGenerateFreshEmail}
              className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              টেস্ট তথ্য বসান
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
