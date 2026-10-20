import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Coins, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  Filter, 
  AlertCircle,
  ExternalLink,
  Flame,
  Zap,
  Trash2,
  Check,
  Gift,
  SkipForward,
  Tv,
  CheckCircle2,
  Users
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
}

export const WatchVideoView: React.FC<WatchVideoViewProps> = ({ 
  onOpenDailyCheckIn, 
  onOpenRedeemModal,
  onOpenReferralModal 
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

  // Fetch campaigns from Firestore
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
          setCampaigns(list);
          setActiveCampaign((prev) => {
            if (prev) {
              const updated = list.find((c) => c.id === prev.id);
              return updated || prev;
            }
            return list.find((c) => c.status === 'active' && c.completedViews < c.targetViews) || list[0];
          });
        } else {
          // Fallback to initial seed campaigns if collection is fresh/empty
          const fallbackList: VideoCampaign[] = INITIAL_SEED_VIDEOS.map((seed, idx) => ({
            ...seed,
            id: `seed_campaign_${idx + 1}`,
            userId: 'system_admin',
            creatorEmail: 'basharmotivationbangla@gmail.com',
            createdAt: new Date().toISOString()
          }));
          setCampaigns(fallbackList);
          setActiveCampaign((prev) => prev || fallbackList[0]);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Notice when fetching video campaigns from Firestore:', error);
        // Fallback to initial seed campaigns on any temporary hiccup so the user always has videos to watch
        const fallbackList: VideoCampaign[] = INITIAL_SEED_VIDEOS.map((seed, idx) => ({
          ...seed,
          id: `seed_campaign_${idx + 1}`,
          userId: 'system_admin',
          creatorEmail: 'basharmotivationbangla@gmail.com',
          createdAt: new Date().toISOString()
        }));
        setCampaigns((prev) => (prev.length > 0 ? prev : fallbackList));
        setActiveCampaign((prev) => prev || fallbackList[0]);
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
        console.error('Error loading view records:', error);
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

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedDurationFilter === 'all') return true;
    return c.targetSeconds === selectedDurationFilter;
  });

  // Extract unique durations from active campaigns
  const uniqueDurations = Array.from(new Set(campaigns.map((c) => c.targetSeconds))).sort((a, b) => a - b);

  // Start watching
  const handleStartWatch = () => {
    if (!userProfile) {
      openAuthModal();
      return;
    }
    if (activeCampaign && activeCampaign.completedViews >= activeCampaign.targetViews) {
      alert('এই ক্যাম্পেইনের নির্ধারিত ভিউ (যেমন ১০/১০) সম্পূর্ণ হয়েছে! এর বেশি আর ভিউ হবে না। পরবর্তী ভিডিও আনা হচ্ছে।');
      handleNextVideo();
      return;
    }
    setIsPlaying(true);
  };

  // Fast Next Video: Instant transition without delays (ভিডিও তারাতারী আসবে)
  const handleNextVideo = () => {
    // Only select campaigns where completedViews < targetViews
    const availablePool = campaigns.filter(
      (c) => c.status === 'active' && c.completedViews < c.targetViews
    );

    if (availablePool.length === 0) {
      alert('বর্তমানে সব সক্রিয় ভিডিওর ভিউ কোটা পূর্ণ হয়ে গেছে! নতুন ভিডিও যোগ করুন অথবা অপেক্ষা করুন।');
      return;
    }

    // Try finding unwatched first, otherwise cycle any active available
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
    }
  };

  // Claim Earned Credits
  const handleClaimCredits = async () => {
    if (!userProfile) {
      openAuthModal();
      return;
    }
    if (!activeCampaign || !isCompleted) return;

    // Strict Target Views Enforcement: "ভিউ ১০ দিলে ১০ বারই হবে এর বেশী হবে না"
    if (activeCampaign.completedViews >= activeCampaign.targetViews) {
      alert('এই ক্যাম্পেইনের নির্ধারিত ভিউ (যেমন ১০/১০) সম্পূর্ণ হয়ে গেছে! এর বেশি আর ভিউ হবে না। পরবর্তী ভিডিও আনা হচ্ছে।');
      handleNextVideo();
      return;
    }

    setClaiming(true);
    const creditsToEarn = activeCampaign.targetSeconds; // 1 credit per second
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

      // 4. Increment campaign completedViews & mark 'completed' if target reached
      const campRef = doc(db, 'videoCampaigns', activeCampaign.id);
      const nextViews = activeCampaign.completedViews + 1;
      const isNowCompleted = nextViews >= activeCampaign.targetViews;
      try {
        await updateDoc(campRef, {
          completedViews: increment(1),
          status: isNowCompleted ? 'completed' : 'active',
          updatedAt: now,
        });
      } catch (campErr) {
        console.warn('Notice updating campaign views in Firestore:', campErr);
      }

      // Confetti celebration!
      confetti({
        particleCount: 130,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
      });

      setClaimSuccessMessage(`অভিনন্দন! +${creditsToEarn} ক্রেডিট আপনার একাউন্টে যোগ হয়েছে।`);

      // Fast Advance to next video: 500ms delay so user gets next video swiftly (ভিডিও তারাতারী আসবে)
      setTimeout(() => {
        handleNextVideo();
      }, 500);
    } catch (err: any) {
      console.error('Error claiming view credits:', err);
      handleFirestoreError(err, OperationType.UPDATE, `videoCampaigns/${activeCampaign.id}`);
    } finally {
      setClaiming(false);
    }
  };

  // Delete Video Functionality (User requested: এবং ভিডিও ডিলিট করতে পারি যেন)
  const handleDeleteVideo = async (camp: VideoCampaign) => {
    if (!userProfile) {
      openAuthModal();
      return;
    }
    const canDelete = camp.userId === userProfile.uid || isAdmin;
    if (!canDelete) {
      alert('আপনি শুধুমাত্র নিজের তৈরি করা ভিডিও ক্যাম্পেইন ডিলিট করতে পারবেন।');
      return;
    }

    if (!confirm(`আপনি কি "${camp.videoTitle}" ক্যাম্পেইনটি ডিলিট করতে চান? অবশিষ্ট অসম্পূর্ণ ভিউয়ের ক্রেডিট রিফান্ড হবে।`)) {
      return;
    }

    const remainingViews = Math.max(0, camp.targetViews - camp.completedViews);
    const refundCredits = remainingViews * camp.costPerView;
    const now = new Date().toISOString();

    try {
      await deleteDoc(doc(db, 'videoCampaigns', camp.id));

      if (refundCredits > 0 && camp.userId === userProfile.uid) {
        const userRef = doc(db, 'users', userProfile.uid);
        await updateDoc(userRef, {
          credits: increment(refundCredits),
          updatedAt: now,
        });

        const txRef = doc(db, 'transactions', `refund_${camp.id}_${Date.now()}`);
        await setDoc(txRef, {
          id: `refund_${camp.id}_${Date.now()}`,
          userId: userProfile.uid,
          type: 'campaign_refund',
          amount: refundCredits,
          description: `💰 ভিডিও ডিলিট রিফান্ড (${remainingViews} অসম্পূর্ণ ভিউ)`,
          createdAt: now,
        });
      }

      if (activeCampaign?.id === camp.id) {
        const remaining = campaigns.filter((c) => c.id !== camp.id);
        setActiveCampaign(remaining.length > 0 ? remaining[0] : null);
      }

      alert('ভিডিও ক্যাম্পেইনটি সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err) {
      console.error('Error deleting video:', err);
      handleFirestoreError(err, OperationType.DELETE, `videoCampaigns/${camp.id}`);
    }
  };

  // Seed sample campaigns
  const handleSeedCampaigns = async () => {
    if (!userProfile) {
      openAuthModal();
      return;
    }
    setLoading(true);
    const now = new Date().toISOString();
    try {
      for (const item of INITIAL_SEED_VIDEOS) {
        const id = `video_${item.videoId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const campRef = doc(db, 'videoCampaigns', id);
        const newCamp: VideoCampaign = {
          ...item,
          id,
          userId: userProfile.uid,
          creatorEmail: userProfile.email,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(campRef, newCamp);
      }
      confetti({ particleCount: 80, spread: 70 });
    } catch (err) {
      console.error('Error seeding sample videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = activeCampaign 
    ? Math.min(100, Math.round(((activeCampaign.targetSeconds - secondsRemaining) / activeCampaign.targetSeconds) * 100))
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sleek Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800/90 rounded-3xl p-5 sm:p-6 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-red-600/10 via-amber-500/5 to-transparent pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/30">
                <Flame className="w-4 h-4 text-white fill-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                ভিডিও ভিউ ও লাইভ ক্রেডিট আর্নিং
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              ভিডিও দেখার প্রতিটি সেকেন্ডের জন্য পাবেন সরাসরি ক্রেডিট। 
              <span className="font-extrabold text-amber-400 ml-1.5">১ সেকেন্ড ভিউ = ১ ক্রেডিট পয়েন্ট!</span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-4 py-2 rounded-2xl shadow-inner shrink-0">
            <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">তাত্ক্ষণিক রিওয়ার্ড</div>
              <div className="text-sm font-black text-amber-300 font-mono">লাইভ অটো ক্রেডিট</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Check-in Motivation Card for DAU */}
      {userProfile && !isClaimedToday && (
        <div 
          onClick={onOpenDailyCheckIn}
          className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/40 hover:border-amber-400/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl cursor-pointer transition-all hover:scale-[1.01] group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Gift className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-amber-300">
                  আজকের দৈনিক লগইন বোনাস সংগ্রহ করুন!
                </h3>
                <span className="text-[10px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  নতুন
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                প্রতিদিন নিয়মিত লগইন করে স্ট্রিক বাড়ান এবং ২০ থেকে মেগা ১০০ ক্রেডিট পর্যন্ত ফ্রি বোনাস উপভোগ করুন।
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDailyCheckIn?.();
            }}
            className="shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>বোনাস ক্লেইম করুন</span>
          </button>
        </div>
      )}



      {/* Dynamic Filter Bar */}
      {uniqueDurations.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold shrink-0 pl-1">
            <Filter className="w-3.5 h-3.5" />
            <span>ফিল্টার:</span>
          </div>
          <button
            onClick={() => setSelectedDurationFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedDurationFilter === 'all'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            সব ভিডিও ({campaigns.length})
          </button>
          {uniqueDurations.map((seconds) => {
            const count = campaigns.filter((c) => c.targetSeconds === seconds).length;
            return (
              <button
                key={seconds}
                onClick={() => setSelectedDurationFilter(seconds)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                  selectedDurationFilter === seconds
                    ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{seconds} সেকেন্ড</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area: Player & List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cinema Video Player Card */}
        <div className="lg:col-span-8 space-y-4">
          {activeCampaign ? (
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl">
              {/* YouTube History Sync & Fast Next Navigation Bar */}
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>🔴 YouTube History সিঙ্ক সক্রিয় (আপনার গুগল অ্যাকাউন্টে ভিউ রেকর্ড হবে)</span>
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                  {/* Auto-Next Switch */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 font-bold text-[11px] bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800 hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={autoPlayNext}
                      onChange={(e) => setAutoPlayNext(e.target.checked)}
                      className="rounded text-red-600 focus:ring-0 cursor-pointer"
                    />
                    <span>অটো-নেক্সট (তারাতারি ভিডিও)</span>
                  </label>

                  {/* Fast Next Video Button */}
                  <button
                    onClick={handleNextVideo}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-bold px-3 py-1 rounded-xl transition-all cursor-pointer text-xs shadow"
                    title="পরবর্তী ভিডিওতে যান (Instant Fast Next)"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                    <span>পরবর্তী ভিডিও</span>
                  </button>
                </div>
              </div>

              {/* Video Player Frame - playsinline=1 allows inline playback on all mobile devices */}
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
                  <div className="relative w-full h-full group cursor-pointer" onClick={handleStartWatch}>
                    <img
                      src={getYouTubeThumbnail(activeCampaign.videoId)}
                      alt={activeCampaign.videoTitle}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity duration-300"
                    />
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
                      <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-2xl shadow-red-600/50 group-hover:scale-110 transition-transform duration-300 ring-2 ring-white/20">
                        <Play className="w-9 h-9 fill-white ml-1" />
                      </div>
                      <p className="mt-4 text-white font-extrabold text-sm sm:text-base drop-shadow-md text-center">
                        ভিডিও প্লে করতে এখানে ক্লিক করুন
                      </p>
                      <span className="mt-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black text-xs px-3.5 py-1 rounded-full shadow-lg">
                        পুরো সময় দেখলে পাবেন +{activeCampaign.targetSeconds} ক্রেডিট
                      </span>
                    </div>
                  </div>
                )}

                {/* Floating Modern Countdown Badge */}
                <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 text-white font-mono text-xs sm:text-sm font-bold shadow-xl">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>
                    {isCompleted ? 'সময় সম্পন্ন!' : `${secondsRemaining}s বাকি`}
                  </span>
                </div>
              </div>

              {/* Shimmering Progress Bar */}
              <div className="w-full bg-slate-950 h-2.5">
                <div
                  className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 h-2.5 transition-all duration-1000 ease-linear shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Player Details & Action Controls */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-white line-clamp-2">
                      {activeCampaign.videoTitle}
                    </h2>
                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>টার্গেট সময়: <strong className="text-slate-200">{formatSecondsToTime(activeCampaign.targetSeconds)}</strong></span>
                      <span>•</span>
                      <span>ভিউ সম্পন্ন: <strong className="text-slate-200">{activeCampaign.completedViews} / {activeCampaign.targetViews}</strong></span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        ভিউ শতভাগ নিশ্চিত: ঠিক {activeCampaign.targetViews} বারই হবে (এর বেশি নয়)
                      </span>
                    </div>
                  </div>

                  {/* Reward Badge */}
                  <div className="shrink-0 flex items-center gap-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 px-4 py-2.5 rounded-2xl">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-[10px] text-amber-300/80 uppercase font-bold tracking-wider">পুরস্কার</div>
                      <div className="text-base font-black text-amber-300 font-mono">
                        +{activeCampaign.targetSeconds} ক্রেডিট
                      </div>
                    </div>
                  </div>
                </div>

                {/* Claim Success Notification */}
                {claimSuccessMessage && (
                  <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs sm:text-sm font-semibold animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{claimSuccessMessage}</span>
                  </div>
                )}

                {/* Watch Control Button + Delete video button if owner */}
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                  {!isPlaying && !isCompleted && (
                    <div className="w-full flex-1 flex flex-col sm:flex-row items-center gap-2.5">
                      <button
                        onClick={handleStartWatch}
                        className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold py-3.5 px-6 rounded-2xl transition-all shadow-xl shadow-red-600/30 active:scale-[0.99] cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>ভিডিও দেখা শুরু করুন ({activeCampaign.targetSeconds} সেকেন্ড)</span>
                      </button>

                      {/* Instant Fast Next Video Button */}
                      <button
                        onClick={handleNextVideo}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-colors cursor-pointer text-xs shrink-0"
                        title="তারাতারি পরবর্তী ভিডিও আনুন"
                      >
                        <SkipForward className="w-4 h-4 text-amber-400" />
                        <span>পরবর্তী ভিডিও</span>
                      </button>
                    </div>
                  )}

                  {isPlaying && !isCompleted && (
                    <div className="w-full flex items-center justify-between bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 text-xs sm:text-sm text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-medium">ভিডিও চলছে... দয়া করে কাউন্টডাউন শেষ হওয়া পর্যন্ত অপেক্ষা করুন</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-amber-400 text-lg">
                          {secondsRemaining}s
                        </span>
                        <button
                          onClick={handleNextVideo}
                          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="পরবর্তী ভিডিওতে স্কিপ করুন"
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
                      className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all animate-pulse text-base disabled:opacity-50 cursor-pointer"
                    >
                      {claiming ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-amber-300" />
                          <span>পয়েন্ট ক্লেইম করুন (+{activeCampaign.targetSeconds} ক্রেডিট)</span>
                          <CheckCircle className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  )}

                  {/* YouTube Direct Link with explicit History Sync label */}
                  <a
                    href={activeCampaign.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 p-3.5 text-red-400 hover:text-white bg-red-600/10 hover:bg-red-600/30 rounded-2xl transition-colors border border-red-500/30 shrink-0 text-xs font-bold"
                    title="YouTube History-তে ১০০% নিশ্চিত রেকর্ড করতে সরাসরি YouTube-এ ওপেন করুন"
                  >
                    <Tv className="w-4 h-4" />
                    <span className="hidden sm:inline">YouTube History সিঙ্ক</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                  </a>

                  {/* Delete this video button if user owns it or admin */}
                  {(userProfile?.uid === activeCampaign.userId || isAdmin) && (
                    <button
                      onClick={() => handleDeleteVideo(activeCampaign)}
                      className="p-3.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-2xl transition-colors border border-rose-500/30 shrink-0 cursor-pointer"
                      title="এই ভিডিওটি ডিলিট করুন"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <Play className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">কোনো ভিডিও সিলেক্ট করা নেই</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                ডানপাশের তালিকা থেকে একটি ভিডিও নির্বাচন করুন অথবা প্রাথমিক ডেমো ভিডিও যোগ করুন।
              </p>
              {campaigns.length === 0 && (
                <button
                  onClick={handleSeedCampaigns}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>প্রাথমিক ভিডিও ক্যাম্পেইন যোগ করুন</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Video List with inline delete option for owned videos */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-red-500" />
              <span>উপলব্ধ ভিডিও ({filteredCampaigns.length})</span>
            </h3>

            {campaigns.length === 0 && (
              <button
                onClick={handleSeedCampaigns}
                className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>লোড করুন</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1 scrollbar-thin">
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
                      ? 'bg-slate-800/95 border-red-500 ring-2 ring-red-500/30 shadow-lg'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-950">
                    <img
                      src={getYouTubeThumbnail(camp.videoId)}
                      alt={camp.videoTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold">
                      {camp.targetSeconds}s
                    </div>
                    {hasWatched && (
                      <div className="absolute inset-0 bg-emerald-950/75 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-white truncate line-clamp-1">
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
                      <span className="text-[10px] text-slate-500 font-mono">
                        {camp.completedViews}/{camp.targetViews} ভিউ
                      </span>
                    </div>

                    {/* Mini view progress */}
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
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
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">কোনো ভিডিও পাওয়া যায়নি।</p>
                <button
                  onClick={handleSeedCampaigns}
                  className="mt-3 text-xs bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl cursor-pointer"
                >
                  ডেমো ভিডিও লোড করুন
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
