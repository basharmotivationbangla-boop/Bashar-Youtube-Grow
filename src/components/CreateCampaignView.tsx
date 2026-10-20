import React, { useState } from 'react';
import { 
  Play, 
  Coins, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Clock,
  Eye,
  Minus,
  Plus,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users
} from 'lucide-react';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { VideoCampaign, Transaction } from '../types';
import { extractYouTubeVideoId, getYouTubeThumbnail } from '../utils/youtube';
import confetti from 'canvas-confetti';

interface CreateCampaignProps {
  onCampaignCreated: () => void;
  onGoToWatch: () => void;
  onOpenRedeemModal?: () => void;
  onOpenReferralModal?: () => void;
}

export const CreateCampaignView: React.FC<CreateCampaignProps> = ({ 
  onCampaignCreated, 
  onGoToWatch,
  onOpenRedeemModal,
  onOpenReferralModal
}) => {
  const { userProfile, openAuthModal } = useAuth();

  // Video Campaign Form State - 100% free-form custom input (No preset chips)
  const [videoUrl, setVideoUrl] = useState('');
  const [targetSeconds, setTargetSeconds] = useState<number | string>(60);
  const [targetViews, setTargetViews] = useState<number | string>(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Computed values
  const extractedVideoId = extractYouTubeVideoId(videoUrl);
  const numSeconds = typeof targetSeconds === 'number' ? targetSeconds : parseInt(targetSeconds, 10) || 0;
  const numViews = typeof targetViews === 'number' ? targetViews : parseInt(targetViews, 10) || 0;
  const totalVideoCost = numSeconds * numViews;

  const currentBalance = userProfile?.credits ?? 0;
  const isVideoCostAffordable = currentBalance >= totalVideoCost && totalVideoCost > 0;

  // Stepper helpers
  const adjustSeconds = (delta: number) => {
    setTargetSeconds((prev) => Math.max(5, (typeof prev === 'number' ? prev : parseInt(prev, 10) || 0) + delta));
  };

  const adjustViews = (delta: number) => {
    setTargetViews((prev) => Math.max(1, (typeof prev === 'number' ? prev : parseInt(prev, 10) || 0) + delta));
  };

  // Handle Video Campaign Submission
  const handleCreateVideoCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!userProfile) {
      openAuthModal();
      return;
    }

    if (!extractedVideoId) {
      setError('একটি সঠিক YouTube ভিডিও লিংক অথবা ভিডিও আইডি প্রদান করুন।');
      return;
    }

    if (numSeconds < 5) {
      setError('ভিডিও দেখার সময় কমপক্ষে ৫ সেকেন্ড হতে হবে।');
      return;
    }

    if (numViews < 1) {
      setError('কমপক্ষে ১টি ভিউ টার্গেট করতে হবে।');
      return;
    }

    if (!isVideoCostAffordable) {
      setError(`আপনার ব্যালেন্সে পর্যাপ্ত ক্রেডিট নেই! প্রয়োজন: ${totalVideoCost.toLocaleString()} ক্রেডিট, আপনার আছে: ${currentBalance.toLocaleString()} ক্রেডিট।`);
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();
    const campaignId = `vid_${extractedVideoId}_${Date.now()}`;
    const autoTitle = `ভিডিও #${extractedVideoId}`;

    try {
      // 1. Create VideoCampaign document with free-form seconds and views
      const campRef = doc(db, 'videoCampaigns', campaignId);
      const newCampaign: VideoCampaign = {
        id: campaignId,
        userId: userProfile.uid,
        creatorEmail: userProfile.email,
        videoUrl: `https://www.youtube.com/watch?v=${extractedVideoId}`,
        videoId: extractedVideoId,
        videoTitle: autoTitle,
        targetSeconds: numSeconds,
        costPerView: numSeconds,
        targetViews: numViews,
        completedViews: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(campRef, newCampaign);

      // 2. Deduct credits from user
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        credits: increment(-totalVideoCost),
        updatedAt: now,
      });

      // 3. Create Transaction log
      const txRef = doc(db, 'transactions', `tx_create_${campaignId}`);
      const newTx: Transaction = {
        id: `tx_create_${campaignId}`,
        userId: userProfile.uid,
        type: 'campaign_created',
        amount: -totalVideoCost,
        description: `🎬 ভিডিও ভিউ ক্যাম্পেইন: ${autoTitle} (${numViews} ভিউ, ${numSeconds} সেকেন্ড)`,
        createdAt: now,
      };
      await setDoc(txRef, newTx);

      confetti({ particleCount: 110, spread: 85, origin: { y: 0.6 } });
      setSuccessMsg('আপনার ভিডিও ভিউ ক্যাম্পেইনটি সফলভাবে লাইভ হয়েছে!');
      setVideoUrl('');
      setTimeout(() => onCampaignCreated(), 1500);
    } catch (err: any) {
      console.error('Error creating video campaign:', err);
      handleFirestoreError(err, OperationType.CREATE, `videoCampaigns/${campaignId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 border border-red-500/20 text-red-400 text-xs font-semibold shadow-inner">
          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>১০০% কাস্টম ভিডিও প্রমোশন</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text">
          নতুন ভিডিও ক্যাম্পেইন তৈরি করুন
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          কোনো ফিক্সড লিমিট নেই—আপনার পছন্দমতো <strong className="text-slate-200">ইচ্ছামতো যেকোনো সেকেন্ড</strong> এবং <strong className="text-slate-200">ইচ্ছামতো যেকোনো ভিউ</strong> সংখ্যা নির্ধারণ করুন।
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs sm:text-sm font-semibold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Campaign Form Card */}
      <form onSubmit={handleCreateVideoCampaign} className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-9 space-y-7 shadow-2xl shadow-black/60">
        {/* Subtle ambient lighting */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. YouTube Video URL */}
        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-bold text-slate-200">
            YouTube ভিডিও লিংক
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... অথবা https://youtu.be/..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-mono transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            যেকোনো YouTube ভিডিওর লিংক পেস্ট করুন, স্বয়ংক্রিয়ভাবে ভিডিও সনাক্ত হবে।
          </p>
        </div>

        {/* Live Detected Video Card */}
        {extractedVideoId && (
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center gap-4 animate-fadeIn">
            <div className="relative w-28 h-18 rounded-xl overflow-hidden bg-black shrink-0 ring-1 ring-slate-700">
              <img
                src={getYouTubeThumbnail(extractedVideoId)}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                ভিডিও সংযুক্ত হয়েছে
              </span>
              <p className="text-xs font-mono font-medium text-slate-200 mt-1 truncate">
                ID: {extractedVideoId}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ভিউয়াররা সরাসরি এই ভিডিওটি দেখবে
              </p>
            </div>
          </div>
        )}

        {/* 2. Free-form Custom Seconds Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>ইচ্ছামতো সময় (সেকেন্ড)</span>
            </label>
            <span className="text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
              ১ সেকেন্ড = ১ ক্রেডিট/ভিউ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustSeconds(-10)}
              className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-all"
              title="-১০ সেকেন্ড"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                min="5"
                max="7200"
                value={targetSeconds}
                onChange={(e) => setTargetSeconds(e.target.value)}
                placeholder="যেমন: ৩০, ৪৫, ৯০, ১৮০, ২৫০..."
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-base sm:text-lg font-mono font-bold text-white placeholder-slate-500 text-center focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
              />
              <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-medium pointer-events-none">
                সেকেন্ড
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustSeconds(10)}
              className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-all"
              title="+১০ সেকেন্ড"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            যেকোনো সংখ্যা লিখুন। প্রতি সেকেন্ড দেখার জন্য ভিউয়ার ১ ক্রেডিট পাবে।
          </p>
        </div>

        {/* 3. Free-form Custom Views Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-rose-400" />
              <span>ইচ্ছামতো ভিউ সংখ্যা</span>
            </label>
            <span className="text-xs text-slate-300 font-medium bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
              টার্গেট ভিউ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustViews(-5)}
              className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-all"
              title="-৫ ভিউ"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                min="1"
                max="50000"
                value={targetViews}
                onChange={(e) => setTargetViews(e.target.value)}
                placeholder="যেমন: ৫, ১২, ৫০, ১৫০, ১০০০..."
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-base sm:text-lg font-mono font-bold text-white placeholder-slate-500 text-center focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
              />
              <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-medium pointer-events-none">
                টি ভিউ
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustViews(5)}
              className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-all"
              title="+৫ ভিউ"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            নিখুঁত ভিউ কন্ট্রোল: আপনি যে কয়টি ভিউ (যেমন ১০ ভিউ) নির্ধারণ করবেন, ঠিক ততবারই দেখা হবে। <strong>১০ ভিউ দিলে ১০ বারই হবে, এর বেশি হবে না।</strong>
          </p>
        </div>

        {/* 4. Live Calculation Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">খরচ হিসাব</span>
            <div className="text-xs sm:text-sm text-slate-300 font-medium">
              <span className="text-white font-bold">{numSeconds}</span> সেকেন্ড × <span className="text-white font-bold">{numViews}</span> ভিউ
            </div>
            <p className="text-[11px] text-slate-500">আপনার বর্তমান ব্যালেন্স: {currentBalance.toLocaleString()} ক্রেডিট</p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">মোট ক্রেডিট লাগবে</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 flex items-center justify-end gap-1.5 font-mono">
                <Coins className="w-6 h-6 text-amber-400" />
                <span>{totalVideoCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning & Free Credits Option if insufficient credits */}
        {!isVideoCostAffordable && userProfile && totalVideoCost > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3 text-xs text-amber-300">
            <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-amber-400" />
                <span>আপনার ক্রেডিট প্রয়োজন: {totalVideoCost.toLocaleString()} (আছে: {currentBalance.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">

                {onOpenRedeemModal && (
                  <button
                    type="button"
                    onClick={onOpenRedeemModal}
                    className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>প্রমো কোড</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGoToWatch}
                  className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors"
                >
                  ভিডিও দেখুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || (!isVideoCostAffordable && !!userProfile)}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-[0.99] cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>ক্যাম্পেইন লাইভ করুন ({totalVideoCost.toLocaleString()} ক্রেডিট)</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
