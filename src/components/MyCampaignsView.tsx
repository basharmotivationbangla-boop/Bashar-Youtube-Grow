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
  Users
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
import { getYouTubeThumbnail } from '../utils/youtube';

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
  const [myVideos, setMyVideos] = useState<VideoCampaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

    // 1. My Video Campaigns
    const qVideos = query(collection(db, 'videoCampaigns'), where('userId', '==', userProfile.uid));
    const unsubVideos = onSnapshot(qVideos, (snap) => {
      const list: VideoCampaign[] = [];
      snap.forEach((d) => list.push(d.data() as VideoCampaign));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyVideos(list);
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

  // Toggle video campaign status
  const handleToggleVideoStatus = async (camp: VideoCampaign) => {
    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    const campRef = doc(db, 'videoCampaigns', camp.id);
    try {
      await updateDoc(campRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `videoCampaigns/${camp.id}`);
    }
  };

  // Delete Video Campaign and refund remaining views
  const handleDeleteVideoCampaign = async (camp: VideoCampaign) => {
    if (!confirm('আপনি কি এই ক্যাম্পেইনটি মুছে দিতে চান? অবশিষ্ট অসম্পূর্ণ ভিউয়ের ক্রেডিট ব্যালেন্সে ফেরত দেওয়া হবে।')) return;
    if (!userProfile) return;

    const remainingViews = Math.max(0, camp.targetViews - camp.completedViews);
    const refundCredits = remainingViews * camp.costPerView;
    const now = new Date().toISOString();

    try {
      // 1. Delete campaign
      await deleteDoc(doc(db, 'videoCampaigns', camp.id));

      // 2. Refund if any
      if (refundCredits > 0) {
        const userRef = doc(db, 'users', userProfile.uid);
        await updateDoc(userRef, {
          credits: increment(refundCredits),
          updatedAt: now,
        });

        // Add refund transaction log
        const txRef = doc(db, 'transactions', `refund_${camp.id}_${Date.now()}`);
        await setDoc(txRef, {
          id: `refund_${camp.id}_${Date.now()}`,
          userId: userProfile.uid,
          type: 'campaign_refund',
          amount: refundCredits,
          description: `💰 ক্যাম্পেইন রিফান্ড (${remainingViews} অসম্পূর্ণ ভিউ)`,
          createdAt: now,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `videoCampaigns/${camp.id}`);
    }
  };

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto shadow-xl">
          <TrendingUp className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white">ড্যাশবোর্ড দেখতে লগইন করুন</h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
          লগইন বা সাইন আপ করলেই পাবেন ৫০০ ক্রেডিট ফ্রি এবং আপনার সব ভিডিও ক্যাম্পেইনের লাইভ রিপোর্ট।
        </p>
        <button
          onClick={openAuthModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm px-7 py-3.5 rounded-2xl shadow-xl shadow-red-600/30 cursor-pointer"
        >
          <span>লগইন / সাইন আপ করুন</span>
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
          {myVideos.map((camp) => {
            const percent = Math.min(100, Math.round((camp.completedViews / camp.targetViews) * 100));
            return (
              <div
                key={camp.id}
                className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xl hover:border-slate-700/80 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
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

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider ${
                        camp.completedViews >= camp.targetViews || camp.status === 'completed'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : camp.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {camp.completedViews >= camp.targetViews || camp.status === 'completed'
                          ? 'সম্পন্ন (প্রচার বন্ধ)' 
                          : camp.status === 'active' 
                          ? 'চলমান (Active)' 
                          : 'স্থগিত (Paused)'}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {camp.targetSeconds} সেকেন্ড ভিউ
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white truncate mt-1.5">
                      {camp.videoTitle}
                    </h4>

                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      খরচ: {camp.costPerView} ক্রেডিট/ভিউ • তারিখ: {new Date(camp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                  {/* Progress & Controls */}
                <div className="w-full md:w-80 shrink-0 space-y-2.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span>অগ্রগতি ({percent}%)</span>
                      {camp.completedViews >= camp.targetViews && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          ১০০% সম্পন্ন (আর প্রকাশ হবে না)
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
                    {camp.status !== 'completed' && camp.completedViews < camp.targetViews && (
                      <button
                        onClick={() => handleToggleVideoStatus(camp)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {camp.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{camp.status === 'active' ? 'পজ' : 'চালু'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteVideoCampaign(camp)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-red-600/20 hover:from-rose-600 hover:to-red-600 hover:text-white text-rose-300 text-xs font-bold border border-rose-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="মুছে ফেলুন এবং রিফান্ড নিন"
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
    </div>
  );
};
