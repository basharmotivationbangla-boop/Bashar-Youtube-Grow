import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Clock, 
  Coins, 
  CheckCircle, 
  Sparkles, 
  Filter, 
  ExternalLink, 
  Trash2, 
  AlertCircle,
  Flame,
  Check,
  Zap,
  Gift,
  RefreshCw,
  SkipForward,
  Tv,
  Eye,
  CheckCircle2,
  Users,
  Database
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  increment 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { VideoCampaign, ViewRecord, Transaction } from '../types';
import { getYouTubeThumbnail, formatSecondsToTime } from '../utils/youtube';
import { INITIAL_SEED_VIDEOS } from '../data/seedCampaigns';
import confetti from 'canvas-confetti';

interface WatchVideoViewProps {
  onOpenDailyCheckIn?: () => void;
  onOpenRedeemModal?: () => void;
  onOpenReferralModal?: () => void;
  onGoToCreate?: () => void;
}

export const WatchVideoView: React.FC<WatchVideoViewProps> = ({ 
  onOpenDailyCheckIn, 
  onOpenRedeemModal,
  onOpenReferralModal,
  onGoToCreate
}) => {
  const { userProfile, openAuthModal } = useAuth();
  const [campaigns, setCampaigns] = useState<VideoCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDurationFilter, setSelectedDurationFilter] = useState<number | 'all'>('all');
  const [activeCampaign, setActiveCampaign] = useState<VideoCampaign | null>(null);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isClaimedToday = userProfile?.lastCheckInDate === todayStr;
  
  // Timer & Watching State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [watchedRecords, setWatchedRecords] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = userProfile?.email === 'basharmotivationbangla@gmail.com';

  // Fetch campaigns from Firestore (Only ACTIVE & UNCOMPLETED campaigns are published)
  useEffect(() => {
    const q = query(collection(db, 'videoCampaigns'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: VideoCampaign[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as VideoCampaign);
        });

        if (list.length > 0) {
          // Strictly publish only campaigns where completedViews < targetViews and status is active
          const activeUncompletedList = list.filter(
            (c) => c.status === 'active' && (Number(c.completedViews) || 0) < Number(c.targetViews)
          );

          setCampaigns(activeUncompletedList);
          setActiveCampaign((prev) => {
            if (prev) {
              const updated = activeUncompletedList.find((c) => c.id === prev.id);
              if (updated) return updated;
            }
            return activeUncompletedList[0] || null;
          });
        } else {
          // Fallback to initial seed campaigns if collection is completely fresh/empty
          const fallbackList: VideoCampaign[] = INITIAL_SEED_VIDEOS.map((seed, idx) => ({
            ...seed,
            id: `seed_campaign_${idx + 1}`,
            userId: 'system_admin',
            creatorEmail: 'basharmotivationbangla@gmail.com',
            createdAt: new Date().toISOString()
          })).filter((c) => c.status === 'active' && (Number(c.completedViews) || 0) < Number(c.targetViews));
          setCampaigns(fallbackList);
          setActiveCampaign((prev) => prev || fallbackList[0] || null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Notice when fetching video campaigns from Firestore:', error);
        const fallbackList: VideoCampaign[] = INITIAL_SEED_VIDEOS.map((seed, idx) => ({
          ...seed,
          id: `seed_campaign_${idx + 1}`,
          userId: 'system_admin',
          creatorEmail: 'basharmotivationbangla@gmail.com',
          createdAt: new Date().toISOString()
        })).filter((c) => c.status === 'active' && (Number(c.completedViews) || 0) < Number(c.targetViews));
        setCampaigns((prev) => (prev.length > 0 ? prev : fallbackList));
        setActiveCampaign((prev) => prev || fallbackList[0] || null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch user's completed view records
  useEffect(() => {
    if (!userProfile) {
      setWatchedRecords(new Set());
      return;
    }

    const q = query(collection(db, 'viewRecords'), where('userId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const set = new Set<string>();
        snapshot.forEach((docSnap) => {
          const rec = docSnap.data() as ViewRecord;
          set.add(rec.campaignId);
        });
        setWatchedRecords(set);
      },
      (error) => {
        console.warn('Notice loading view records:', error);
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  // When active campaign changes, reset timer
  useEffect(() => {
    if (activeCampaign) {
      setSecondsRemaining(activeCampaign.targetSeconds);
      setIsCompleted(false);
      setIsPlaying(false);
      setClaimSuccessMessage(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [activeCampaign]);

  // Handle Timer Countdown
  useEffect(() => {
    if (isPlaying && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsCompleted(true);
            setIsPlaying(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, secondsRemaining]);

  // Start watching video
  const handleStartWatch = () => {
    if (!activeCampaign) return;
    if (activeCampaign.status !== 'active' || (Number(activeCampaign.completedViews) || 0) >= Number(activeCampaign.targetViews)) {
      alert('এই ক্যাম্পেইনের নির্ধারিত ভিউ কোটা সম্পূর্ণ হয়েছে! এটি আর প্রদর্শিত হবে না। পরবর্তী ভিডিওতে যাওয়া হচ্ছে।');
      handleNextVideo();
      return;
    }
    setIsPlaying(true);
  };

  // Fast Next Video: Instant transition without delays
  const handleNextVideo = () => {
    const availablePool = campaigns.filter(
      (c) => c.status === 'active' && (Number(c.completedViews) || 0) < Number(c.targetViews)
    );

    if (availablePool.length === 0) {
      setActiveCampaign(null);
      setIsPlaying(false);
      return;
    }

    const nextUnwatched = availablePool.find(
      (c) => c.id !== activeCampaign?.id && !watchedRecords.has(c.id)
    );
    const nextCandidate = nextUnwatched || availablePool.find((c) => c.id !== activeCampaign?.id) || availablePool[0];

    if (nextCandidate) {
      setActiveCampaign(nextCandidate);
      setSecondsRemaining(nextCandidate.targetSeconds);
      setIsCompleted(false);
      setClaimSuccessMessage(null);
      if (autoPlayNext && userProfile) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setActiveCampaign(null);
      setIsPlaying(false);
    }
  };

  // Claim Earned Credits
  const handleClaimCredits = async () => {
    if (!userProfile) {
      openAuthModal();
      return;
    }
    if (!activeCampaign || !isCompleted) return;

    if (activeCampaign.status !== 'active' || (Number(activeCampaign.completedViews) || 0) >= Number(activeCampaign.targetViews)) {
      alert('এই ক্যাম্পেইনের নির্ধারিত ভিউ সম্পূর্ণ হয়ে গেছে! এটি আর প্রদর্শিত হবে না। পরবর্তী ভিডিও আনা হচ্ছে।');
      handleNextVideo();
      return;
    }

    setClaiming(true);
    const creditsToEarn = activeCampaign.targetSeconds;
    const now = new Date().toISOString();
    const recordId = `${userProfile.uid}_${activeCampaign.id}_${Date.now()}`;

    try {
      // 1. Create ViewRecord
      const viewRecordRef = doc(db, 'viewRecords', recordId);
      const newRecord: ViewRecord = {
        id: recordId,
        userId: userProfile.uid,
        campaignId: activeCampaign.id,
        videoId: activeCampaign.videoId,
        secondsWatched: activeCampaign.targetSeconds,
        creditsEarned: creditsToEarn,
        createdAt: now,
      };
      await setDoc(viewRecordRef, newRecord);

      // 2. Create Transaction Log
      const txRef = doc(db, 'transactions', `tx_${recordId}`);
      const newTx: Transaction = {
        id: `tx_${recordId}`,
        userId: userProfile.uid,
        type: 'view_reward',
        amount: creditsToEarn,
        description: `🎬 ভিডিও ভিউ রিওয়ার্ড: ${activeCampaign.videoTitle.slice(0, 35)} (${activeCampaign.targetSeconds} সেকেন্ড)`,
        createdAt: now,
      };
      await setDoc(txRef, newTx);

      // 3. Increment viewer credits in user doc
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        credits: increment(creditsToEarn),
        updatedAt: now,
      });

      // 4. Increment campaign completedViews safely and mark completed if target reached
      const campRef = doc(db, 'videoCampaigns', activeCampaign.id);
      const currentCompleted = Number(activeCampaign.completedViews) || 0;
      const nextViews = currentCompleted + 1;
      const isNowCompleted = nextViews >= Number(activeCampaign.targetViews);

      try {
        await updateDoc(campRef, {
          completedViews: increment(1),
          status: isNowCompleted ? 'completed' : 'active',
          updatedAt: now,
        });
      } catch (campErr) {
        console.warn('Notice updating campaign views in Firestore:', campErr);
      }

      // Immediately prune from local active campaigns list if now completed
      if (isNowCompleted) {
        setCampaigns((prev) => prev.filter((c) => c.id !== activeCampaign.id));
      }

      // Confetti celebration!
      confetti({
        particleCount: 140,
        spread: 95,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
      });

      if (isNowCompleted) {
        setClaimSuccessMessage(`অভিনন্দন! +${creditsToEarn} ক্রেডিট যোগ হয়েছে। এই ভিডিওর নির্ধারিত কোটা পূর্ণ হওয়ায় প্রচার সমাপ্ত হয়েছে।`);
      } else {
        setClaimSuccessMessage(`অভিনন্দন! +${creditsToEarn} ক্রেডিট আপনার একাউন্টে সফলভাবে যোগ হয়েছে।`);
      }

      setTimeout(() => {
        handleNextVideo();
      }, 500);
    } catch (err: any) {
      console.warn('Notice claiming view credits:', err);
      handleFirestoreError(err, OperationType.UPDATE, `videoCampaigns/${activeCampaign.id}`);
    } finally {
      setClaiming(false);
    }
  };

  // Delete Video Functionality with remaining credit refund
  const handleDeleteVideo = async (camp: VideoCampaign) => {
    if (!userProfile) {
      openAuthModal();
      return;
    }

    const remainingViews = Math.max(0, camp.targetViews - camp.completedViews);
    const refundCredits = remainingViews * camp.costPerView;

    const confirmMsg = refundCredits > 0
      ? `আপনি কি এই ক্যাম্পেইনটি মুছে দিতে চান? অবশিষ্ট ${remainingViews}টি ভিউয়ের জন্য ${refundCredits.toLocaleString()} ক্রেডিট আপনার ব্যালেন্সে রিফান্ড করা হবে।`
      : 'আপনি কি এই ক্যাম্পেইনটি মুছে দিতে চান?';

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    const now = new Date().toISOString();

    try {
      if (refundCredits > 0) {
        const userRef = doc(db, 'users', userProfile.uid);
        await updateDoc(userRef, {
          credits: increment(refundCredits),
          updatedAt: now,
        });

        const txRef = doc(db, 'transactions', `refund_${camp.id}_${Date.now()}`);
        const refundTx: Transaction = {
          id: `refund_${camp.id}_${Date.now()}`,
          userId: userProfile.uid,
          type: 'campaign_refund',
          amount: refundCredits,
          description: `💰 ক্যাম্পেইন মোছা রিফান্ড: ${camp.videoTitle.slice(0, 30)} (${remainingViews}টি অবিক্রীত ভিউ)`,
          createdAt: now,
        };
        await setDoc(txRef, refundTx);
      }

      await deleteDoc(doc(db, 'videoCampaigns', camp.id));
      alert(`ক্যাম্পেইন সফলভাবে মুছে ফেলা হয়েছে!${refundCredits > 0 ? ` আপনার একাউন্টে ${refundCredits.toLocaleString()} ক্রেডিট ফেরত দেওয়া হয়েছে।` : ''}`);
      
      if (activeCampaign?.id === camp.id) {
        const remaining = campaigns.filter(c => c.id !== camp.id);
        setActiveCampaign(remaining[0] || null);
      }
    } catch (err: any) {
      console.warn('Notice deleting video:', err);
      handleFirestoreError(err, OperationType.DELETE, `videoCampaigns/${camp.id}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtered campaigns (Guaranteed: strictly exclude any completed video)
  const filteredCampaigns = campaigns.filter((c) => {
    if (c.status !== 'active' || (Number(c.completedViews) || 0) >= Number(c.targetViews)) return false;
    if (selectedDurationFilter === 'all') return true;
    return c.targetSeconds === selectedDurationFilter;
  });

  const uniqueDurations = Array.from(
    new Set(
      campaigns
        .filter((c) => c.status === 'active' && (Number(c.completedViews) || 0) < Number(c.targetViews))
        .map((c) => c.targetSeconds)
    )
  ).sort((a, b) => a - b);

  const progressPercent = activeCampaign 
    ? Math.min(100, Math.round(((activeCampaign.targetSeconds - secondsRemaining) / activeCampaign.targetSeconds) * 100))
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Live Community Heartbeat Bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900/80 to-amber-950/40 border border-red-500/20 p-3 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-sm" />
          </span>
          <span className="font-extrabold text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>লাইভ কমিউনিটি ভিডিও ভিউ প্ল্যাটফর্ম</span>
          </span>
          <span className="hidden md:inline text-slate-400 font-medium">|</span>
          <span className="hidden md:inline text-slate-300">
            শতভাগ অর্গানিক ওয়াচটাইম ও পয়েন্ট আর্নিং
          </span>
        </div>

        <div className="flex items-center gap-2.5 ml-auto text-[11px] font-semibold text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Google Cloud Firestore</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          </span>
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>YouTube সিঙ্ক</span>
          </span>
          <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl font-mono">
            ১ সে. = ১ পয়েন্ট
          </span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Video Pool */}
        <div className="relative overflow-hidden bg-slate-900/70 backdrop-blur-xl border border-slate-800 hover:border-red-500/40 rounded-3xl p-5 shadow-xl transition-all duration-300 group hover:-translate-y-0.5 shadow-black/40">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-red-600/15 rounded-full blur-2xl pointer-events-none group-hover:bg-red-600/25 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                সক্রিয় ভিডিও পুল
              </span>
              <div className="text-3xl font-black text-white mt-1.5 flex items-baseline gap-2 font-mono">
                <span>{campaigns.length}</span>
                <span className="text-xs text-slate-400 font-sans font-medium">টি ভিডিও প্রস্তুত</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600/20 to-rose-600/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-red-400 ml-0.5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 relative z-10">
            লাইভ কমিউনিটি ভিডিও দেখে প্রতি সেকেন্ডে পয়েন্ট পান
          </p>
        </div>

        {/* Card 2: View Reward Rate */}
        <div className="relative overflow-hidden bg-slate-900/70 backdrop-blur-xl border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 shadow-xl transition-all duration-300 group hover:-translate-y-0.5 shadow-black/40">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/25 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ভিউ রিওয়ার্ড রেট
              </span>
              <div className="text-3xl font-black text-amber-400 mt-1.5 flex items-baseline gap-2 font-mono">
                <span>১ সে. = ১ পয়েন্ট</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 relative z-10">
            শতভাগ সঠিক হিসাব: যত সেকেন্ড দেখবেন ঠিক তত পয়েন্ট জমা হবে
          </p>
        </div>

        {/* Card 3: User Balance / Daily Check-in */}
        <div className="relative overflow-hidden bg-slate-900/70 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xl transition-all duration-300 group hover:-translate-y-0.5 shadow-black/40">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                আপনার বর্তমান ব্যালেন্স
              </span>
              <div className="text-3xl font-black text-emerald-400 mt-1.5 flex items-baseline gap-2 font-mono">
                <span>{userProfile ? userProfile.credits.toLocaleString() : '৫০০ ফ্রি'}</span>
                <span className="text-xs text-slate-400 font-sans font-medium">ক্রেডিট</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-emerald-400" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] relative z-10">
            <span className="text-slate-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{userProfile ? `স্ট্রিক: ${userProfile.checkInStreak || 1} দিন` : 'Google দিয়ে যুক্ত হলেই ৫০০ পয়েন্ট ফ্রি'}</span>
            </span>
            {userProfile && !isClaimedToday ? (
              <button
                onClick={onOpenDailyCheckIn}
                className="text-amber-300 font-extrabold hover:text-amber-200 cursor-pointer flex items-center gap-1 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-lg active:scale-95 transition-all shadow-sm"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>বোনাস নিন</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Content Area: Cinema Video Player (8 cols) & Queue (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cinema Video Player Card */}
        <div className="lg:col-span-8 space-y-4">
          {activeCampaign ? (
            <div className="relative group">
              {/* Vibrant ambient backlight glow behind player */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-red-600/30 via-rose-600/20 to-amber-500/25 rounded-3xl blur-2xl opacity-75 pointer-events-none -z-10 group-hover:opacity-90 transition-opacity duration-500" />

              <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
                {/* Top Cinema Control Bar */}
                <div className="p-3.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span>YouTube History সিঙ্ক সক্রিয়</span>
                  </div>

                  <div className="flex items-center gap-2.5 ml-auto">
                    {/* Auto-Next iOS-style switch */}
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 font-semibold text-xs bg-slate-900/95 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <span className="text-[11px]">অটো-নেক্সট</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={autoPlayNext}
                          onChange={(e) => setAutoPlayNext(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4.5 rounded-full transition-colors ${autoPlayNext ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-sm' : 'bg-slate-700'}`} />
                        <div className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${autoPlayNext ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </div>
                    </label>

                    {/* Fast Next Video Button */}
                    <button
                      onClick={handleNextVideo}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer text-xs border border-slate-700/80 shadow-sm active:scale-95"
                      title="পরবর্তী ভিডিওতে যান"
                    >
                      <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                      <span>পরবর্তী ভিডিও</span>
                    </button>
                  </div>
                </div>

                {/* Video Player Frame with Cinema Vignette */}
                <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                  {isPlaying ? (
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${activeCampaign.videoId}?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                      title={activeCampaign.videoTitle}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="origin-when-cross-origin"
                    />
                  ) : (
                    <div className="relative w-full h-full group/thumb cursor-pointer" onClick={handleStartWatch}>
                      <img
                        src={getYouTubeThumbnail(activeCampaign.videoId)}
                        alt={activeCampaign.videoTitle}
                        className="w-full h-full object-cover opacity-85 group-hover/thumb:opacity-95 group-hover/thumb:scale-105 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 flex flex-col items-center justify-center p-4">
                        <div className="relative w-22 h-22 rounded-3xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 flex items-center justify-center text-white shadow-2xl shadow-red-600/70 group-hover/thumb:scale-110 transition-transform duration-300 ring-4 ring-white/30">
                          <Play className="w-10 h-10 fill-white ml-1 drop-shadow" />
                          <div className="absolute -inset-2 rounded-3xl bg-red-500/20 blur-md pointer-events-none" />
                        </div>
                        <p className="mt-4 text-white font-black text-lg sm:text-xl drop-shadow-md text-center tracking-tight">
                          ভিডিও প্লে করতে ক্লিক করুন
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 font-black text-xs px-4 py-1.5 rounded-full shadow-xl shadow-amber-500/20">
                          <Coins className="w-4 h-4 text-slate-950" />
                          <span>+{activeCampaign.targetSeconds} ক্রেডিট রিওয়ার্ড পান</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Floating Modern Countdown Badge */}
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5 bg-slate-950/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/80 text-white font-mono text-xs sm:text-sm font-bold shadow-2xl">
                    <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                    <span className={isCompleted ? 'text-emerald-400 font-extrabold' : 'text-amber-300'}>
                      {isCompleted ? 'সময় সম্পন্ন!' : `${secondsRemaining}s বাকি`}
                    </span>
                  </div>
                </div>

                {/* Shimmering Dynamic Progress Bar */}
                <div className="w-full bg-slate-950 h-2 relative overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 h-2 transition-all duration-1000 ease-linear shadow-lg shadow-red-500/50"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Player Details & Action Controls */}
                <div className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <h2 className="text-lg sm:text-2xl font-black text-white leading-snug tracking-tight">
                        {activeCampaign.videoTitle}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>টার্গেট সময়: <strong className="text-white font-mono">{formatSecondsToTime(activeCampaign.targetSeconds)}</strong></span>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-red-400" />
                          <span>ভিউ অগ্রগতি: <strong className="text-white font-mono">{activeCampaign.completedViews} / {activeCampaign.targetViews}</strong></span>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                          {activeCampaign.targetViews} ভিউ পূর্ণ হলে সমাপ্ত
                        </span>
                      </div>
                    </div>

                    {/* Reward Badge */}
                    <div className="shrink-0 flex items-center gap-3 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-inner">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-300/80 uppercase font-bold tracking-wider">পুরস্কার</div>
                        <div className="text-xl font-black text-amber-300 font-mono tracking-tight">
                          +{activeCampaign.targetSeconds} ক্রেডিট
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Claim Success Notification */}
                  {claimSuccessMessage && (
                    <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs sm:text-sm font-semibold animate-fadeIn shadow-lg">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{claimSuccessMessage}</span>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
                    {!isPlaying && !isCompleted && (
                      <div className="w-full flex-1 flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                          onClick={handleStartWatch}
                          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-red-600/40 active:scale-[0.99] cursor-pointer text-sm sm:text-base"
                        >
                          <Play className="w-5 h-5 fill-white" />
                          <span>ভিডিও দেখা শুরু করুন ({activeCampaign.targetSeconds} সেকেন্ড)</span>
                        </button>

                        <button
                          onClick={handleNextVideo}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-5 rounded-2xl transition-colors cursor-pointer text-xs shrink-0 border border-slate-700 active:scale-95"
                        >
                          <SkipForward className="w-4 h-4 text-amber-400" />
                          <span>পরবর্তী ভিডিও</span>
                        </button>
                      </div>
                    )}

                    {isPlaying && !isCompleted && (
                      <div className="w-full flex items-center justify-between bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs sm:text-sm text-slate-200 shadow-inner">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                          </span>
                          <span className="font-semibold text-white">ভিডিও চলছে... সময় শেষ হওয়া পর্যন্ত অপেক্ষা করুন</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-amber-400 text-xl px-3 py-1 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            {secondsRemaining}s
                          </span>
                          <button
                            onClick={handleNextVideo}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer border border-slate-700"
                          >
                            স্কিপ ⏭
                          </button>
                        </div>
                      </div>
                    )}

                    {isCompleted && (
                      <button
                        onClick={handleClaimCredits}
                        disabled={claiming}
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4.5 px-6 rounded-2xl shadow-2xl shadow-emerald-600/40 transition-all text-base sm:text-lg disabled:opacity-50 cursor-pointer animate-pulse active:scale-[0.99]"
                      >
                        {claiming ? (
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-6 h-6 text-amber-300" />
                            <span>পয়েন্ট ক্লেইম করুন (+{activeCampaign.targetSeconds} ক্রেডিট)</span>
                            <CheckCircle className="w-6 h-6" />
                          </>
                        )}
                      </button>
                    )}

                    {/* YouTube Direct Link with explicit History Sync label */}
                    <a
                      href={activeCampaign.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 py-3.5 px-4 text-red-400 hover:text-white bg-red-600/10 hover:bg-red-600/30 rounded-2xl transition-colors border border-red-500/30 shrink-0 text-xs font-bold"
                      title="YouTube History-তে ভিউ নিশ্চিত করতে সরাসরি YouTube-এ দেখুন"
                    >
                      <Tv className="w-4 h-4 text-red-500" />
                      <span className="hidden sm:inline">YouTube History সিঙ্ক</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Delete this video button if user owns it or admin */}
                    {(userProfile?.uid === activeCampaign.userId || isAdmin) && (
                      <button
                        onClick={() => handleDeleteVideo(activeCampaign)}
                        className="p-3.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-2xl transition-colors border border-rose-500/30 shrink-0 cursor-pointer"
                        title="এই ভিডিওটি ডিলিট করুন এবং অবিক্রীত ভিউয়ের রিফান্ড নিন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">সব ভিডিওর ভিউ কোটা সম্পূর্ণ হয়েছে!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                যেসব ভিডিওর নির্ধারিত টার্গেট ভিউ সম্পূর্ণ হয়েছে সেগুলো নিয়ম অনুযায়ী আর প্রকাশিত হচ্ছে না। নতুন ভিডিও ক্যাম্পেইন তৈরি হলে স্বয়ংক্রিয়ভাবে এখানে চলে আসবে।
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onGoToCreate && (
                  <button
                    onClick={onGoToCreate}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs py-3 px-6 rounded-2xl shadow-lg shadow-red-600/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>নতুন ভিডিও ক্যাম্পেইন তৈরি করুন</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Video Queue List */}
        <div className="lg:col-span-4 space-y-3.5">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-red-500" />
              <span>ভিডিও কিউ ({filteredCampaigns.length})</span>
            </h3>
          </div>

          {/* Duration Filter Chips */}
          {uniqueDurations.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedDurationFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedDurationFilter === 'all'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                সব ভিডিও
              </button>
              {uniqueDurations.map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setSelectedDurationFilter(seconds)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                    selectedDurationFilter === seconds
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500 shadow-md shadow-red-600/30'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          )}

          {/* Queue Cards */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredCampaigns.map((camp) => {
              const isSelected = activeCampaign?.id === camp.id;
              const hasWatched = watchedRecords.has(camp.id);
              const isOwnerOrAdmin = userProfile?.uid === camp.userId || isAdmin;

              return (
                <div
                  key={camp.id}
                  onClick={() => setActiveCampaign(camp)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex gap-3.5 relative group ${
                    isSelected
                      ? 'bg-slate-800/95 border-red-500 ring-2 ring-red-500/30 shadow-xl shadow-red-500/10'
                      : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-26 h-17 shrink-0 rounded-xl overflow-hidden bg-slate-950 ring-1 ring-slate-800">
                    <img
                      src={getYouTubeThumbnail(camp.videoId)}
                      alt={camp.videoTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold">
                      {camp.targetSeconds}s
                    </div>
                    {hasWatched && (
                      <div className="absolute inset-0 bg-emerald-950/80 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                        চলছে
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-white truncate line-clamp-1 leading-snug">
                        {camp.videoTitle}
                      </h4>
                      {isOwnerOrAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(camp);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                          title="এই ভিডিও ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1 text-amber-400 font-extrabold font-mono">
                        <Coins className="w-3 h-3" />
                        <span>+{camp.targetSeconds}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {camp.completedViews}/{camp.targetViews} ভিউ
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (camp.completedViews / camp.targetViews) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCampaigns.length === 0 && (
              <div className="text-center py-10 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">সব ভিডিওর ভিউ কোটা সম্পন্ন!</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  নির্ধারিত ভিউ পাওয়া মাত্র ভিডিওর প্রকাশ স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যায়।
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  {onGoToCreate && (
                    <button
                      onClick={onGoToCreate}
                      className="text-xs bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer shadow-md"
                    >
                      নতুন ভিডিও যোগ করুন
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
