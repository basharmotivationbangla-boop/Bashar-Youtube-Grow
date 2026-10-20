import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  X, 
  Coins, 
  Gift, 
  CheckCircle2, 
  Clock, 
  Flame,
  ArrowRight,
  MessageCircle
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, claimReferralReward, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ReferralRecord, REFERRAL_REWARD_CREDITS } from '../types';
import confetti from 'canvas-confetti';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, openAuthModal } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userProfile) {
      setReferrals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'referrals'),
      where('referrerUid', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ReferralRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ReferralRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReferrals(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching referrals:', err);
      handleFirestoreError(err, OperationType.LIST, 'referrals');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const referralLink = userProfile 
    ? `${window.location.origin}/?ref=${userProfile.uid}`
    : `${window.location.origin}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = encodeURIComponent(
    `🎬 Bashar YouTube Grow - ইউটিউব ভিডিও দেখে ক্রেডিট অর্জন করুন এবং আপনার নিজের ভিডিওতে আনলিমিটেড ভিউ নিন! এখনই সাইন আপ করে ৫০০ ক্রেডিট ফ্রি বোনাস নিন:`
  );
  const shareUrl = encodeURIComponent(referralLink);

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`, '_blank');
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank');
  };

  const handleShareTelegram = () => {
    window.open(`https://t.me/share/url?url=${shareUrl}&text=${shareText}`, '_blank');
  };

  const handleClaim = async (referral: ReferralRecord) => {
    if (!userProfile) return;
    setClaimingId(referral.id);
    try {
      await claimReferralReward(userProfile.uid, referral);
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
      });
    } catch (err) {
      console.error('Failed to claim referral reward:', err);
    } finally {
      setClaimingId(null);
    }
  };

  const totalReferrals = referrals.length;
  const claimedReferrals = referrals.filter((r) => r.status === 'claimed');
  const pendingReferrals = referrals.filter((r) => r.status === 'pending');
  const totalEarnedCredits = claimedReferrals.length * REFERRAL_REWARD_CREDITS;
  const pendingCredits = pendingReferrals.length * REFERRAL_REWARD_CREDITS;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleUp max-h-[92vh] flex flex-col"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative p-6 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  রেফারেল প্রোগ্রাম
                </span>
                <span className="text-[11px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  +{REFERRAL_REWARD_CREDITS.toLocaleString()} ক্রেডিট
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                বন্ধুদের ইনভাইট করুন ও ক্রেডিট আয় করুন
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

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto scrollbar-thin">
          {!userProfile ? (
            <div className="text-center p-8 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <Gift className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-base font-bold text-white">রেফারেল লিংক পেতে আগে লগইন করুন</h3>
              <p className="text-xs text-slate-400">
                লগইন করলেই আপনি আপনার নিজস্ব ইউনিক রেফারেল লিংক পেয়ে যাবেন।
              </p>
              <button
                onClick={() => {
                  onClose();
                  openAuthModal();
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md cursor-pointer"
              >
                লগইন / সাইন আপ (+৫০০ ক্রেডিট ফ্রি)
              </button>
            </div>
          ) : (
            <>
              {/* Unique Link Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>আপনার ইউনিক রেফারেল লিংক:</span>
                  <span className="text-[11px] text-emerald-400 font-semibold">প্রতি রেফারে ১,০০০ ক্রেডিট</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl focus-within:border-emerald-500/60 transition-colors">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="w-full bg-transparent text-xs text-slate-200 font-mono px-2 py-1 outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>কপি লিংক</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instant Social Share Buttons */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">সোশ্যাল মিডিয়ায় শেয়ার করুন:</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={handleShareFacebook}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Facebook</span>
                  </button>
                  <button
                    onClick={handleShareTelegram}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Telegram</span>
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl text-center">
                  <div className="text-[11px] text-slate-400 font-medium">মোট রেফারেল</div>
                  <div className="text-lg sm:text-xl font-black text-white mt-1 font-mono">
                    {totalReferrals} জন
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl text-center">
                  <div className="text-[11px] text-slate-400 font-medium">মোট অর্জিত</div>
                  <div className="text-lg sm:text-xl font-black text-amber-400 mt-1 font-mono">
                    {totalEarnedCredits.toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl text-center">
                  <div className="text-[11px] text-slate-400 font-medium">পেন্ডিং বোনাস</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1 font-mono">
                    {pendingCredits.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* How it works info */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20 space-y-2">
                <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>কীভাবে রেফারেল বোনাস কাজ করে?</span>
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>আপনার রেফারেল লিংক বন্ধুদের পাঠান।</li>
                  <li>বন্ধু লিংকে প্রবেশ করে নতুন অ্যাকাউন্ট তৈরি করলেই তিনি পাবেন ৫০০ ক্রেডিট সাইন-আপ বোনাস।</li>
                  <li>আর আপনি সাথে সাথে পেয়ে যাবেন <strong>১,০০০ ক্রেডিট</strong> রেফারেল রিওয়ার্ড!</li>
                </ul>
              </div>

              {/* Referrals List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    রেফার করা বন্ধুদের তালিকা ({referrals.length})
                  </h4>
                  {pendingReferrals.length > 0 && (
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                      {pendingReferrals.length} টি ক্লেইম বাকি
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    লোড হচ্ছে...
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="p-6 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-1.5">
                    <Users className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-300 font-semibold">এখনো কোনো বন্ধুকে রেফার করেননি</p>
                    <p className="text-[11px] text-slate-500">
                      উপরে থাকা লিংকটি কপি করে বন্ধুদের সাথে শেয়ার করুন এবং প্রতি রেফারে ১,০০০ ক্রেডিট উপার্জন করুন!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                    {referrals.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center font-bold">
                            {item.referredUserName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white truncate max-w-[150px] sm:max-w-xs">
                              {item.referredUserName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(item.createdAt).toLocaleDateString('bn-BD', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        <div>
                          {item.status === 'claimed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>+১,০০০ ক্লেইমড</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleClaim(item)}
                              disabled={claimingId === item.id}
                              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-3 py-1 rounded-xl text-xs shadow cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>{claimingId === item.id ? 'ক্লেইম হচ্ছে...' : '১,০০০ ক্রেডিট নিন'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Bashar YouTube Grow রেফারেল সিস্টেম
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
