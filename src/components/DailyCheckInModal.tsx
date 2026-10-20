import React, { useState } from 'react';
import { 
  X, 
  Gift, 
  Calendar, 
  Check, 
  Sparkles, 
  Flame, 
  Coins, 
  Clock, 
  ChevronRight,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { doc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { DAILY_CHECKIN_REWARDS, Transaction } from '../types';
import confetti from 'canvas-confetti';

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Format today's date in local YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Yesterday date string
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

  const lastCheckIn = userProfile?.lastCheckInDate;
  const currentStreak = userProfile?.checkInStreak || 0;
  const isClaimedToday = lastCheckIn === todayStr;

  // Calculate streak and day in 7-day cycle
  let nextStreak = 1;
  let dayInCycle = 1;

  if (isClaimedToday) {
    nextStreak = currentStreak;
    dayInCycle = currentStreak > 0 ? ((currentStreak - 1) % 7) + 1 : 1;
  } else if (lastCheckIn === yesterdayStr) {
    nextStreak = currentStreak + 1;
    dayInCycle = ((nextStreak - 1) % 7) + 1;
  } else {
    // Reset streak if day skipped or first time
    nextStreak = 1;
    dayInCycle = 1;
  }

  const todayReward = DAILY_CHECKIN_REWARDS.find((r) => r.day === dayInCycle) || DAILY_CHECKIN_REWARDS[0];

  const handleClaimDailyBonus = async () => {
    if (!userProfile) {
      onClose();
      openAuthModal();
      return;
    }

    if (isClaimedToday) return;

    setLoading(true);
    setError(null);
    const nowIso = new Date().toISOString();
    const txId = `checkin_${userProfile.uid}_${todayStr}`;

    try {
      // 1. Update user document
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        credits: increment(todayReward.credits),
        lastCheckInDate: todayStr,
        checkInStreak: nextStreak,
        updatedAt: nowIso,
      });

      // 2. Create Transaction log
      const txRef = doc(db, 'transactions', txId);
      const newTx: Transaction = {
        id: txId,
        userId: userProfile.uid,
        type: 'checkin_reward',
        amount: todayReward.credits,
        description: `🎁 দৈনিক চেক-ইন বোনাস: ${todayReward.label} (+${todayReward.credits} ক্রেডিট)`,
        createdAt: nowIso,
      };
      await setDoc(txRef, newTx);

      // Celebration confetti
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#ec4899'],
        });
      } catch (e) {
        // Confetti fallback
      }
    } catch (err: any) {
      console.error('Error claiming daily check-in:', err);
      setError('চেক-ইন বোনাস ক্লেইম করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
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
        className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner with ambient glow */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6">
          <div className="absolute top-0 right-0 w-48 h-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                <Gift className="w-6 h-6 text-amber-200 animate-bounce" />
              </div>
              <div>
                <h3 className="font-black text-lg sm:text-xl tracking-tight">দৈনিক চেক-ইন বোনাস</h3>
                <p className="text-xs text-white/90">প্রতিদিন লগইন করে ফ্রিতে বাড়তি ক্রেডিট সংগ্রহ করুন</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-black/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Streak Pill */}
          <div className="mt-4 flex items-center gap-2 bg-black/30 backdrop-blur-md w-fit px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-bold">
            <Flame className="w-4 h-4 text-amber-300" />
            <span>বর্তমান স্ট্রিক: {currentStreak} দিন সক্রিয়</span>
          </div>
        </div>

        {/* Modal Body: 7-Day Rewards Grid */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-slate-300">৭ দিনের পুরস্কার ক্যালেন্ডার</span>
              <span className="text-slate-400">প্রতিদিন লগইন করলে বেশি ক্রেডিট</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {DAILY_CHECKIN_REWARDS.map((reward) => {
                const isClaimed = isClaimedToday 
                  ? reward.day <= dayInCycle 
                  : reward.day < dayInCycle;
                const isCurrent = reward.day === dayInCycle && !isClaimedToday;
                const isMega = reward.day === 7;

                return (
                  <div
                    key={reward.day}
                    className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-between text-center transition-all ${
                      isClaimed
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-400'
                        : isCurrent
                        ? 'bg-slate-900 border-2 border-amber-400 shadow-lg shadow-amber-500/20 scale-105 ring-2 ring-amber-400/30'
                        : isMega
                        ? 'bg-slate-900/90 border border-amber-500/40'
                        : 'bg-slate-900/70 border border-slate-800 opacity-80'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400">
                      {reward.label}
                    </span>

                    <div className="my-2">
                      {isClaimed ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : isMega ? (
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                          <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                      ) : (
                        <Coins className={`w-6 h-6 mx-auto ${isCurrent ? 'text-amber-400' : 'text-slate-500'}`} />
                      )}
                    </div>

                    <div className="font-mono font-black text-xs">
                      +{reward.credits}
                    </div>

                    {isCurrent && (
                      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Area */}
          <div className="pt-2">
            {isClaimedToday ? (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                  <Check className="w-5 h-5" />
                  <span>আজকের {todayReward.credits} ক্রেডিট বোনাস নেওয়া হয়েছে!</span>
                </div>
                <p className="text-xs text-slate-400">
                  পরবর্তী বোনাস আগামীকাল আনলক হবে। স্ট্রিক ধরে রাখতে প্রতিদিন লগইন করুন!
                </p>
              </div>
            ) : (
              <button
                onClick={handleClaimDailyBonus}
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>আজকের {todayReward.label} বোনাস ক্লেইম করুন (+{todayReward.credits} ক্রেডিট)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>৭ম দিনে মেগা ১০০ ক্রেডিট বোনাস</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-medium cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
