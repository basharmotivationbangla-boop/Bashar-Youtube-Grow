import React, { useState } from 'react';
import { 
  Gift, 
  Sparkles, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Coins, 
  ArrowRight,
  ShieldCheck,
  Key
} from 'lucide-react';
import { doc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import confetti from 'canvas-confetti';

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// The secret promo code is kept private and NEVER printed or exposed in the UI
const SECRET_PROMO_CODE = 'Fahmida3421';
const SECRET_PROMO_CREDITS = 10000000; // 1,00,00,000 credits (1 Crore)

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, openAuthModal } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!userProfile) {
      openAuthModal();
      return;
    }

    const trimmed = code.trim();
    if (!trimmed) {
      setError('দয়া করে আপনার প্রমো কোডটি প্রবেশ করান।');
      return;
    }

    // Verify secret code (case-insensitive) without leaking it
    if (trimmed.toUpperCase() !== SECRET_PROMO_CODE.toUpperCase()) {
      setError('অকার্যকর প্রমো কোড! দয়া করে আপনার সঠিক কোডটি পুনরায় যাচাই করে লিখুন।');
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();
    const uniqueTxId = `bonus_${userProfile.uid}_code_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Increment user credits by 10,000,000 in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        credits: increment(SECRET_PROMO_CREDITS),
        updatedAt: now,
      });

      // 2. Add transaction record
      const txRef = doc(db, 'transactions', uniqueTxId);
      const newTx: Transaction = {
        id: uniqueTxId,
        userId: userProfile.uid,
        type: 'bonus',
        amount: SECRET_PROMO_CREDITS,
        description: `🎉 স্পেশাল রিডিম কোড বোনাস (+${SECRET_PROMO_CREDITS.toLocaleString()} ক্রেডিট)`,
        createdAt: now,
      };
      await setDoc(txRef, newTx);

      // Celebration confetti
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899'],
      });

      setSuccess(`অভিনন্দন! আপনার অ্যাকাউন্টে ${SECRET_PROMO_CREDITS.toLocaleString()} ক্রেডিট সফলভাবে যুক্ত হয়েছে!`);
      setCode('');
    } catch (err: any) {
      console.error('Error redeeming promo code:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      setError('কোড রিডিম করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleUp"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-600/25 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                রিডিমশন
              </span>
              <h2 className="text-lg font-black text-white mt-0.5">
                প্রমো কোড রিডিম করুন
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-400 leading-relaxed">
            আপনার কাছে কোনো স্পেশাল প্রমো কোড থাকলে নিচে সঠিকভাবে লিখে সাবমিট করুন।
          </p>

          {/* Form */}
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                প্রমো কোড লিখুন:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="এখানে আপনার কোডটি টাইপ করুন..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3.5 text-sm sm:text-base font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                />
                {code && (
                  <button
                    type="button"
                    onClick={() => setCode('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-rose-300 text-xs font-semibold animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Celebration Message */}
            {success && (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl space-y-1.5 text-emerald-300 text-xs font-semibold animate-fadeIn">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>সফলভাবে রিডিম হয়েছে!</span>
                </div>
                <p className="text-xs text-emerald-200/90 leading-relaxed">
                  {success}
                </p>
              </div>
            )}

            {/* Current Balance Display if logged in */}
            {userProfile && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>বর্তমান ব্যালেন্স:</span>
                </div>
                <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                  {userProfile.credits.toLocaleString()} ক্রেডিট
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black py-3.5 px-6 rounded-2xl shadow-xl shadow-red-600/25 transition-all text-sm cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>কোড রিডিম করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick info note */}
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              যথাযথ কোড ব্যবহার করে যেকোনো সময় তাৎক্ষণিক ক্রেডিট বোনাস অর্জন করুন।
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
