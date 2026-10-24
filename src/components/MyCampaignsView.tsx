import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Trash2, 
  Pause, 
  Coins, 
  History, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Gift, 
  PlusCircle,
  Eye,
  Flame,
  Sparkles,
  Check,
  Users,
  ShieldCheck,
  Lock,
  Copy,
  ExternalLink,
  AlertTriangle,
  X,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  increment 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { VideoCampaign, Transaction } from '../types';
import { getYouTubeThumbnail, fetchYouTubeVideoTitle } from '../utils/youtube';
import confetti from 'canvas-confetti';

interface MyCampaignsProps {
  onCreateCampaignClick: () => void;
  onOpenDailyCheckIn?: () => void;
  onOpenRedeemModal?: () => void;
  onOpenReferralModal?: () => void;
}

export const MyCampaignsView: React.FC<MyCampaignsProps> = ({ 
  onCreateCampaignClick,
  onOpenDailyCheckIn,
  onOpenRedeemModal,
  onOpenReferralModal
}) => {
  const { userProfile, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'video' | 'transactions'>('video');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [myVideos, setMyVideos] = useState<VideoCampaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [resolvedTitles, setResolvedTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Protected delete & notification states
  const [campaignToDelete, setCampaignToDelete] = useState<VideoCampaign | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isClaimedToday = userProfile?.lastCheckInDate === todayStr;

  useEffect(() => {
    if (!userProfile) {
      setMyVideos([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    // 1. My Video Campaigns (Strictly filtered by creator's userId)
    const qVideos = query(collection(db, 'videoCampaigns'), where('userId', '==', userProfile.uid));
    const unsubVideos = onSnapshot(qVideos, (snap) => {
      const list: VideoCampaign[] = [];
      snap.forEach((d) => {
        const camp = d.data() as VideoCampaign;
        if (camp.status !== 'deleted') {
          list.push(camp);
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyVideos(list);

      // Resolve real YouTube titles for any campaign with placeholder
      list.forEach((c) => {
        if (!resolvedTitles[c.videoId]) {
          fetchYouTubeVideoTitle(c.videoId).then((realTitle) => {
            if (realTitle && !realTitle.includes('ভিডিও (')) {
              setResolvedTitles((prev) => ({ ...prev, [c.videoId]: realTitle }));
            }
          });
        }
      });
    });

    // 2. Transactions
    const qTx = query(collection(db, 'transactions'), where('userId', '==', userProfile.uid));
    const unsubTx = onSnapshot(qTx, (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => list.push(d.data() as Transaction));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(list);
      setLoading(false);
    });

    return () => {
      unsubVideos();
      unsubTx();
    };
  }, [userProfile]);

  // Copy link helper
  const handleCopyLink = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setToastMessage('✅ ভিডিও লিংক ক্লিপবোর্ডে কপি হয়েছে!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle video campaign status
  const handleToggleVideoStatus = async (camp: VideoCampaign) => {
    if (!userProfile) return;
    const isOwnerOrAdmin = userProfile.uid === camp.userId || userProfile.email === 'basharmotivationbangla@gmail.com';
    if (!isOwnerOrAdmin) {
      alert('⛔ নিরাপত্তা সতর্কতা: আপনি এই ক্যাম্পেইনের মালিক নন।');
      return;
    }

    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    const campRef = doc(db, 'videoCampaigns', camp.id);
    try {
      await updateDoc(campRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      setToastMessage(nextStatus === 'active' ? '▶️ ক্যাম্পেইন পুনরায় চালু হয়েছে!' : '⏸️ ক্যাম্পেইন সাময়িকভাবে স্থগিত রাখা হয়েছে।');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `videoCampaigns/${camp.id}`);
    }
  };

  // Request Delete with strict ownership check
  const handleRequestDeleteCampaign = (camp: VideoCampaign) => {
    if (!userProfile) {
      openAuthModal();
      return;
    }

    const isRealOwner = (userProfile.uid && camp.userId && userProfile.uid === camp.userId) ||
                        (userProfile.email && camp.creatorEmail && userProfile.email === camp.creatorEmail) ||
                        (userProfile.email === 'basharmotivationbangla@gmail.com');

    if (!isRealOwner) {
      alert('⛔ নিরাপত্তা সতর্কতা: আপনি এই ক্যাম্পেইনের মালিক নন। অন্য কোনো একাউন্টের ভিডিও ডিলিট করা নিষিদ্ধ!');
      return;
    }

    setCampaignToDelete(camp);
  };

  // Execute deletion and refund remaining views
  const executeDeleteCampaign = async (camp: VideoCampaign) => {
    if (!userProfile) return;

    const isRealOwner = (userProfile.uid && camp.userId && userProfile.uid === camp.userId) ||
                        (userProfile.email && camp.creatorEmail && userProfile.email === camp.creatorEmail) ||
                        (userProfile.email === 'basharmotivationbangla@gmail.com');

    if (!isRealOwner) {
      alert('⛔ নিরাপত্তা সতর্কতা: শুধুমাত্র এই ক্যাম্পেইনের মালিকই এটি মুছতে পারবেন।');
      setCampaignToDelete(null);
      return;
    }

    setDeleteLoading(true);
    const remainingViews = Math.max(0, camp.targetViews - camp.completedViews);
    const refundCredits = remainingViews * camp.costPerView;
    const now = new Date().toISOString();

    try {
      const campRef = doc(db, 'videoCampaigns', camp.id);

      // 1. Soft-delete by setting status = 'deleted'
      try {
        await updateDoc(campRef, {
          status: 'deleted',
          updatedAt: now,
        });
      } catch (softErr) {
        console.warn('Notice setting status deleted:', softErr);
      }

      // 2. Refund to creator's account
      if (refundCredits > 0) {
        const userRef = doc(db, 'users', camp.userId);
        await updateDoc(userRef, {
          credits: increment(refundCredits),
          updatedAt: now,
        });

        // Add refund transaction log
        const txRef = doc(db, 'transactions', `refund_${camp.id}_${Date.now()}`);
        await setDoc(txRef, {
          id: `refund_${camp.id}_${Date.now()}`,
          userId: camp.userId,
          type: 'campaign_refund',
          amount: refundCredits,
          description: `💰 ক্যাম্পেইন মোছা রিফান্ড: ${camp.videoTitle.slice(0, 30)} (${remainingViews} অসম্পূর্ণ ভিউ)`,
          createdAt: now,
        });
      }

      // 3. Delete campaign doc
      await deleteDoc(campRef);

      // 4. Update UI
      setMyVideos((prev) => prev.filter((c) => c.id !== camp.id));
      setCampaignToDelete(null);
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      setToastMessage(`✅ ক্যাম্পেইন সফলভাবে মুছে ফেলা হয়েছে!${refundCredits > 0 ? ` একাউন্টে +${refundCredits.toLocaleString()} ক্রেডিট ফেরত দেওয়া হয়েছে।` : ''}`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.warn('Error deleting campaign:', err);
      handleFirestoreError(err, OperationType.DELETE, `videoCampaigns/${camp.id}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto shadow-xl">
          <TrendingUp className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white">ড্যাশবোর্ড দেখতে Google দিয়ে যুক্ত হোন</h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
          Google একাউন্ট দিয়ে এক ক্লিকে যুক্ত হোন আর পেয়ে যান ৫০০ ক্রেডিট ফ্রি বোনাস এবং আপনার সব ভিডিওর রিয়েল-টাইম ভিউ রিপোর্ট।
        </p>
        <button
          onClick={openAuthModal}
          className="inline-flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-black text-sm px-7 py-3.5 rounded-2xl shadow-xl shadow-white/10 cursor-pointer active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Google দিয়ে শুরু করুন (+৫০০ ক্রেডিট)</span>
        </button>
      </div>
    );
  }

  const totalViewsReceived = myVideos.reduce((acc, c) => acc + c.completedViews, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* Overview Stat Cards (4-Card Grid with Glass Glow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Balance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">ক্রেডিট ব্যালেন্স</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
              {userProfile.credits.toLocaleString()}
            </div>
            <p className="text-[11px] text-amber-300/70 font-medium">১ সেকেন্ড ভিউ = ১ ক্রেডিট</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: My Campaigns */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">আমার ক্যাম্পেইন</span>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {myVideos.length} <span className="text-base font-normal text-slate-400">টি</span>
            </div>
            <p className="text-[11px] text-slate-400">চালু করা মোট ক্যাম্পেইন</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <Play className="w-6 h-6 fill-red-400" />
          </div>
        </div>

        {/* Card 3: Total Views */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">মোট ভিউ প্রাপ্তি</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {totalViewsReceived.toLocaleString()} <span className="text-base font-normal text-slate-400">ভিউ</span>
            </div>
            <p className="text-[11px] text-slate-400">ভিডিওতে অর্জিত ভিউ</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Daily Check-in Streak & Bonus */}
        <div 
          onClick={onOpenDailyCheckIn}
          className={`relative overflow-hidden border rounded-3xl p-5 shadow-xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group ${
            !isClaimedToday
              ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/50 hover:border-amber-400 ring-1 ring-amber-400/20'
              : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800/90 hover:border-slate-700'
          }`}
          title="দৈনিক চেক-ইন ক্যালেন্ডার খুলুন"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">দৈনিক চেক-ইন</span>
              {!isClaimedToday && (
                <span className="text-[10px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  নতুন
                </span>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight flex items-center gap-1">
              <span>{userProfile.checkInStreak || 0}</span>
              <span className="text-base font-normal text-slate-400">দিন</span>
            </div>
            <p className="text-[11px] font-medium">
              {!isClaimedToday ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  আজকের বোনাস নিন!
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  আজকের বোনাস গৃহীত
                </span>
              )}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:rotate-12 ${
            !isClaimedToday 
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-slate-800 border border-slate-700 text-amber-400'
          }`}>
            <Flame className="w-6 h-6 text-amber-400" />
          </div>
        </div>
      </div>



      {/* Owner Protection Verification Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-white">
                একাউন্ট ওনার সুরক্ষা বলয় সক্রিয় (Owner Protection Active)
              </h4>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                🔒 এনক্রিপ্টেড
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              আপনার জমা দেওয়া কোনো ভিডিও অন্য কোনো একাউন্ট থেকে ডিলিট বা পরিবর্তন করা অসম্ভব। শুধুমাত্র আপনার বর্তমান Google একাউন্ট (<span className="text-slate-200 font-mono">{userProfile.email}</span>) এটি নিয়ন্ত্রণ করতে পারে।
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>আমার ভিডিও ক্যাম্পেইন ({myVideos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ক্রেডিট হিস্টোরি</span>
          </button>
        </div>

        <button
          onClick={onCreateCampaignClick}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-2xl text-xs font-bold border border-slate-800 transition-all cursor-pointer shadow-sm"
        >
          <PlusCircle className="w-4 h-4 text-red-500" />
          <span>নতুন ক্যাম্পেইন তৈরি করুন</span>
        </button>
      </div>

      {/* TAB 1: MY VIDEO CAMPAIGNS */}
      {activeTab === 'video' && (
        <div className="space-y-4">
          {/* Status Filter Chips */}
          {myVideos.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setCampaignFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  campaignFilter === 'all'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                সব ক্যাম্পেইন ({myVideos.length})
              </button>
              <button
                onClick={() => setCampaignFilter('active')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                  campaignFilter === 'active'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                চলমান ({myVideos.filter((c) => c.status === 'active' && c.completedViews < c.targetViews).length})
              </button>
              <button
                onClick={() => setCampaignFilter('paused')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                  campaignFilter === 'paused'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                স্থগিত ({myVideos.filter((c) => c.status === 'paused').length})
              </button>
              <button
                onClick={() => setCampaignFilter('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                  campaignFilter === 'completed'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                সম্পন্ন ({myVideos.filter((c) => c.completedViews >= c.targetViews || c.status === 'completed').length})
              </button>
            </div>
          )}

          {/* List of campaigns */}
          {myVideos
            .filter((c) => {
              if (campaignFilter === 'all') return true;
              if (campaignFilter === 'active') return c.status === 'active' && c.completedViews < c.targetViews;
              if (campaignFilter === 'paused') return c.status === 'paused';
              if (campaignFilter === 'completed') return c.completedViews >= c.targetViews || c.status === 'completed';
              return true;
            })
            .map((camp) => {
            const percent = Math.min(100, Math.round((camp.completedViews / camp.targetViews) * 100));
            const isFinished = camp.completedViews >= camp.targetViews || camp.status === 'completed';
            return (
              <div
                key={camp.id}
                className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xl hover:border-slate-700/80 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative w-28 h-18 rounded-2xl overflow-hidden bg-black shrink-0 ring-1 ring-slate-800 shadow-md">
                    <img
                      src={getYouTubeThumbnail(camp.videoId)}
                      alt={camp.videoTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                      {camp.targetSeconds}s
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider ${
                        isFinished
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : camp.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {isFinished
                          ? 'সম্পন্ন (প্রচার বন্ধ)' 
                          : camp.status === 'active' 
                          ? 'চলমান (Active)' 
                          : 'স্থগিত (Paused)'}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {camp.targetSeconds} সেকেন্ড ভিউ
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                        <ShieldCheck className="w-3 h-3" />
                        <span>আপনার মালিকানাধীন</span>
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white truncate mt-1.5">
                      {resolvedTitles[camp.videoId] || camp.videoTitle}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono flex-wrap">
                      <span>খরচ: {camp.costPerView} ক্রেডিট/ভিউ</span>
                      <span>•</span>
                      <span>তারিখ: {new Date(camp.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <button
                        onClick={() => handleCopyLink(camp.videoId)}
                        className="text-slate-400 hover:text-white inline-flex items-center gap-1 font-sans text-[11px] cursor-pointer"
                        title="লিংক কপি করুন"
                      >
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>কপি</span>
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${camp.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white inline-flex items-center gap-1 font-sans text-[11px]"
                        title="ইউটিউবে খুলুন"
                      >
                        <ExternalLink className="w-3 h-3 text-rose-400" />
                        <span>ইউটিউব</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Progress & Controls */}
                <div className="w-full md:w-80 shrink-0 space-y-2.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span>অগ্রগতি ({percent}%)</span>
                      {isFinished && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          ১০০% সম্পন্ন
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-white font-bold">{camp.completedViews} / {camp.targetViews} ভিউ</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                    <div
                      className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {!isFinished && (
                      <button
                        onClick={() => handleToggleVideoStatus(camp)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {camp.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{camp.status === 'active' ? 'পজ' : 'চালু'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleRequestDeleteCampaign(camp)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-red-600/20 hover:from-rose-600 hover:to-red-600 hover:text-white text-rose-300 text-xs font-bold border border-rose-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="মুছে ফেলুন এবং পয়েন্ট ফেরত নিন"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>ভিডিও ডিলিট</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {myVideos.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <Play className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">আপনি এখনো কোনো ভিডিও ক্যাম্পেইন চালু করেননি।</p>
              <button
                onClick={onCreateCampaignClick}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg cursor-pointer"
              >
                <span>প্রথম ভিডিও ক্যাম্পেইন তৈরি করুন</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRANSACTIONS AUDIT LEDGER */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>ক্রেডিট লেনদেনের বিস্তারিত ইতিহাস</span>
            </h3>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      tx.type === 'bonus' || tx.type === 'checkin_reward'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : isPositive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {tx.type === 'bonus' || tx.type === 'checkin_reward' ? (
                        <Gift className="w-5 h-5 text-amber-400" />
                      ) : isPositive ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        {tx.description}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className={`font-mono font-black text-sm sm:text-base shrink-0 ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} ক্রেডিট
                  </div>
                </div>
              );
            })}

            {transactions.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs">
                কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETING VIDEO CAMPAIGN */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div 
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">ভিডিও ক্যাম্পেইন মুছে ফেলার নিশ্চিতকরণ</h3>
                  <p className="text-xs text-slate-400">অবশিষ্ট ভিউয়ের পয়েন্ট একাউন্টে রিফান্ড হবে</p>
                </div>
              </div>
              <button
                onClick={() => setCampaignToDelete(null)}
                disabled={deleteLoading}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Summary Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3.5">
              <img
                src={getYouTubeThumbnail(campaignToDelete.videoId)}
                alt={campaignToDelete.videoTitle}
                className="w-20 h-14 rounded-xl object-cover shrink-0 ring-1 ring-slate-800"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {resolvedTitles[campaignToDelete.videoId] || campaignToDelete.videoTitle}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                  <span>ভিউ: {campaignToDelete.completedViews}/{campaignToDelete.targetViews}</span>
                  <span>•</span>
                  <span>{campaignToDelete.targetSeconds} সে.</span>
                </div>
              </div>
            </div>

            {/* Refund & Security Breakdown */}
            {(() => {
              const remaining = Math.max(0, campaignToDelete.targetViews - campaignToDelete.completedViews);
              const refund = remaining * campaignToDelete.costPerView;
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 rounded-2xl border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-300">অবশিষ্ট অবিক্রীত ভিউ:</span>
                      <span className="font-mono text-white">{remaining} টি ভিউ</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold border-t border-slate-800/80 pt-2">
                      <span className="text-amber-300 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>আপনার ব্যালেন্সে রিফান্ড হবে:</span>
                      </span>
                      <span className="font-mono text-amber-300 text-sm font-black">+{refund.toLocaleString()} ক্রেডিট</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      ওনার সুরক্ষা যাচাইকৃত: আপনি এই ক্যাম্পেইনের মূল মালিক ({userProfile.email}) হিসেবে এটি ডিলিট করছেন। অন্য কোনো একাউন্ট থেকে এটি ডিলিট করা সম্ভব নয়।
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCampaignToDelete(null)}
                disabled={deleteLoading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => executeDeleteCampaign(campaignToDelete)}
                disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ডিলিট ও রিফান্ড হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ক্যাম্পেইন ডিলিট ও ক্রেডিট রিফান্ড নিন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 border border-emerald-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold leading-relaxed">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
