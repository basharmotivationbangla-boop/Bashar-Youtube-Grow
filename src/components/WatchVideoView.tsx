import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause,
  Clock, 
  Coins, 
  CheckCircle, 
  Sparkles, 
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
  ShieldCheck,
  Lock,
  MoreVertical,
  Copy,
  AlertTriangle,
  X,
  Radio,
  TrendingUp,
  ShieldAlert
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
import { 
  getYouTubeThumbnail, 
  formatSecondsToTime, 
  fetchYouTubeVideoDetails, 
  YouTubeVideoDetails 
} from '../utils/youtube';
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
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('bashar_auto_next');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAutoPlayNext = (val: boolean) => {
    setAutoPlayNext(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bashar_auto_next', String(val));
    }
  };

  // Protected delete & 3-dot dropdown states
  const [campaignToDelete, setCampaignToDelete] = useState<VideoCampaign | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [openMenuCampaignId, setOpenMenuCampaignId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Emergency Cancellation Modal State
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isClaimedToday = userProfile?.lastCheckInDate === todayStr;
  
  // Timer, Tab Reference & Locked Watching State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [earlyExitError, setEarlyExitError] = useState<string | null>(null);
  const [watchedRecords, setWatchedRecords] = useState<Set<string>>(new Set());
  const [videoDetailsMap, setVideoDetailsMap] = useState<Record<string, YouTubeVideoDetails>>({});
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const claimingRef = useRef<boolean>(false);
  const ytWindowRef = useRef<Window | null>(null);

  const isAdmin = userProfile?.email === 'basharmotivationbangla@gmail.com';

  // PAGE VISIBILITY API: Instantly pause the reward timer if user switches tabs or minimizes the window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab switched away or minimized: Pause timer immediately!
        setIsTimerPaused(true);
      } else if (document.visibilityState === 'visible') {
        // User returned to active tab: Resume timer immediately
        setIsTimerPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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

  // Fetch authentic YouTube details (exact title, channel author name) for all campaigns
  useEffect(() => {
    campaigns.forEach((camp) => {
      if (camp.videoId && !videoDetailsMap[camp.videoId]) {
        fetchYouTubeVideoDetails(camp.videoId).then((details) => {
          if (details?.title) {
            setVideoDetailsMap((prev) => ({ ...prev, [camp.videoId]: details }));
          }
        });
      }
    });
  }, [campaigns]);

  // When active campaign changes, reset timer and resolve YouTube details immediately
  useEffect(() => {
    if (activeCampaign) {
      setSecondsRemaining(activeCampaign.targetSeconds);
      setIsCompleted(false);
      setIsPlaying(false);
      setIsTimerPaused(false);
      setClaimSuccessMessage(null);
      setEarlyExitError(null);
      setShowExitConfirmModal(false);
      if (timerRef.current) clearInterval(timerRef.current);

      if (activeCampaign.videoId) {
        fetchYouTubeVideoDetails(activeCampaign.videoId).then((details) => {
          if (details?.title) {
            setVideoDetailsMap((prev) => ({ ...prev, [activeCampaign.videoId]: details }));
          }
        });
      }
    }
  }, [activeCampaign?.id, activeCampaign?.videoId]);

  // Fast Next Video: Instant transition without delays
  const handleNextVideo = () => {
    claimingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (ytWindowRef.current && !ytWindowRef.current.closed) {
      try {
        ytWindowRef.current.close();
      } catch (e) {
        // ignore cross-origin error
      }
    }
    ytWindowRef.current = null;
    setShowExitConfirmModal(false);
    setIsTimerPaused(false);

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
      setEarlyExitError(null);
      setIsPlaying(false);
    } else {
      setActiveCampaign(null);
      setIsPlaying(false);
    }
  };

  // Automatic Credit Claiming: Adds credits instantly upon video watch completion
  const handleClaimCredits = async (targetCampInput?: VideoCampaign) => {
    const targetCamp = targetCampInput || activeCampaign;
    if (!targetCamp) return;

    if (!userProfile) {
      setIsCompleted(false);
      setIsPlaying(false);
      setClaimSuccessMessage('লগইন না করলে কোনো ক্রেডিট জমা হবে না। ক্রেডিট সংগ্রহ করতে প্রথমে Log in অথবা Sign up করুন।');
      openAuthModal();
      return;
    }

    if (claimingRef.current) return;
    claimingRef.current = true;
    setClaiming(true);

    const creditsToEarn = targetCamp.targetSeconds;
    const now = new Date().toISOString();
    const recordId = `${userProfile.uid}_${targetCamp.id}_${Date.now()}`;

    try {
      // 1. Create ViewRecord
      const viewRecordRef = doc(db, 'viewRecords', recordId);
      const newRecord: ViewRecord = {
        id: recordId,
        userId: userProfile.uid,
        campaignId: targetCamp.id,
        videoId: targetCamp.videoId,
        secondsWatched: targetCamp.targetSeconds,
        creditsEarned: creditsToEarn,
        createdAt: now,
      };
      await setDoc(viewRecordRef, newRecord);
      setWatchedRecords((prev) => new Set(prev).add(targetCamp.id));

      // Also cache in local watch history for instant profile view accessibility
      try {
        const historyKey = `bashar_watch_history_${userProfile.uid}`;
        const rawHistory = localStorage.getItem(historyKey);
        const existingList = rawHistory ? JSON.parse(rawHistory) : [];
        const updatedList = [
          newRecord,
          ...existingList.filter((item: any) => item.id !== recordId && item.campaignId !== targetCamp.id)
        ].slice(0, 15);
        localStorage.setItem(historyKey, JSON.stringify(updatedList));
      } catch (cacheErr) {
        console.warn('Notice saving local watch history:', cacheErr);
      }

      // 2. Create Transaction Log
      const txRef = doc(db, 'transactions', `tx_${recordId}`);
      const newTx: Transaction = {
        id: `tx_${recordId}`,
        userId: userProfile.uid,
        type: 'view_reward',
        amount: creditsToEarn,
        description: `🎬 ইউটিউব অর্গানিক ভিউ রিওয়ার্ড: +${creditsToEarn} ক্রেডিট অটোমেটিক যোগ হয়েছে (${targetCamp.targetSeconds} সেকেন্ড)`,
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
      const campRef = doc(db, 'videoCampaigns', targetCamp.id);
      const currentCompleted = Number(targetCamp.completedViews) || 0;
      const nextViews = currentCompleted + 1;
      const isNowCompleted = nextViews >= Number(targetCamp.targetViews);

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
        setCampaigns((prev) => prev.filter((c) => c.id !== targetCamp.id));
      }

      // Cleanly close YouTube popup window on successful finish
      if (ytWindowRef.current && !ytWindowRef.current.closed) {
        try {
          ytWindowRef.current.close();
        } catch (e) {
          // ignore
        }
      }
      ytWindowRef.current = null;

      // Confetti celebration!
      confetti({
        particleCount: 180,
        spread: 110,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'],
      });

      if (autoPlayNext) {
        setClaimSuccessMessage(`🎉 অভিনন্দন! YouTube ভিউ সফল। +${creditsToEarn} ক্রেডিট অ্যাকাউন্টে যোগ হয়েছে। পরবর্তী ভিডিও প্রস্তুত হচ্ছে...`);
        setTimeout(() => {
          handleNextVideo();
        }, 1800);
      } else {
        setClaimSuccessMessage(`🎉 অভিনন্দন! YouTube ভিউ সফল। +${creditsToEarn} ক্রেডিট আপনার অ্যাকাউন্টে যোগ হয়েছে।`);
      }
    } catch (err: any) {
      console.warn('Notice claiming view credits:', err);
      handleFirestoreError(err, OperationType.UPDATE, `videoCampaigns/${targetCamp.id}`);
    } finally {
      setClaiming(false);
      claimingRef.current = false;
    }
  };

  // INESCAPABLE WATCH SYSTEM 1: Browser Navigation Trap (Back Button Prevention)
  useEffect(() => {
    if (isPlaying && !isCompleted) {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
        setToastMessage('🔒 ভিডিও দেখা সম্পূর্ণ না হওয়া পর্যন্ত বের হতে পারবেন না!');
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isPlaying, isCompleted]);

  // INESCAPABLE WATCH SYSTEM 2: Prevent Page Reload or Tab Close
  useEffect(() => {
    if (isPlaying && !isCompleted) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'সতর্কতা: YouTube ভিডিও দেখা শেষ হয়নি! এখনই বের হলে কোনো ক্রেডিট পাবেন না।';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isPlaying, isCompleted]);

  // INESCAPABLE WATCH SYSTEM 3: Continuous Anti-Cheat Tab Closure Heartbeat
  useEffect(() => {
    const handleFocusCheck = () => {
      if (isPlaying && !isCompleted && ytWindowRef.current) {
        // If the user closed or deleted the YouTube tab
        if (ytWindowRef.current.closed) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsPlaying(false);
          setSecondsRemaining(activeCampaign ? activeCampaign.targetSeconds : 30);
          setEarlyExitError('⚠️ আপনি নির্ধারিত সময়ের আগেই YouTube উইন্ডো কেটে দিয়েছেন! ভিডিও দেখা অসম্পূর্ণ হওয়ায় কোনো ক্রেডিট দেওয়া হয়নি।');
        }
      }
    };

    window.addEventListener('focus', handleFocusCheck);
    return () => {
      window.removeEventListener('focus', handleFocusCheck);
    };
  }, [isPlaying, isCompleted, activeCampaign]);

  // TIMER COUNTDOWN: Strictly controlled by isPlaying, !isTimerPaused, and active tab visibility
  useEffect(() => {
    if (isPlaying && !isTimerPaused && secondsRemaining > 0) {
      if (!userProfile) {
        setIsPlaying(false);
        openAuthModal();
        return;
      }

      timerRef.current = setInterval(() => {
        // Extra check using Page Visibility API directly:
        if (document.visibilityState === 'hidden') {
          setIsTimerPaused(true);
          return;
        }

        // Strict anti-cheat verification: Is the YouTube window still alive?
        if (ytWindowRef.current && ytWindowRef.current.closed) {
          clearInterval(timerRef.current!);
          setIsPlaying(false);
          setSecondsRemaining(activeCampaign ? activeCampaign.targetSeconds : 30);
          setEarlyExitError('⚠️ আপনি YouTube উইন্ডোটি কেটে দিয়েছেন! তাই সেশন ও পয়েন্ট বাতিল করা হয়েছে। সম্পূর্ণ পয়েন্ট পেতে পুরো সময় YouTube-এ ভিডিওটি দেখতে হবে।');
          return;
        }

        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);

            // Final double-check: ensure YouTube tab was not closed at the last second
            if (ytWindowRef.current && ytWindowRef.current.closed) {
              setIsPlaying(false);
              setEarlyExitError('⚠️ YouTube উইন্ডোটি সময় শেষ হওয়ার আগেই বন্ধ করা হয়েছিল! কোনো পয়েন্ট দেওয়া হয়নি।');
              return 0;
            }

            setIsCompleted(true);
            setIsPlaying(false);

            // Automatically claim credits the moment timer finishes!
            if (activeCampaign) {
              handleClaimCredits(activeCampaign);
            }
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
  }, [isPlaying, isTimerPaused, secondsRemaining, activeCampaign, userProfile, autoPlayNext]);

  // Start watching: Open the official YouTube pop-up window in locked mode
  const handleStartWatch = () => {
    if (!activeCampaign) return;
    if (!userProfile) {
      setClaimSuccessMessage('ভিডিও দেখার ক্রেডিট পেতে হলে প্রথমে Log in অথবা Sign up করতে হবে।');
      openAuthModal();
      return;
    }
    if (activeCampaign.status !== 'active' || (Number(activeCampaign.completedViews) || 0) >= Number(activeCampaign.targetViews)) {
      setToastMessage('এই ক্যাম্পেইনের নির্ধারিত ভিউ কোটা সম্পূর্ণ হয়েছে! পরবর্তী ভিডিওতে যাওয়া হচ্ছে।');
      handleNextVideo();
      return;
    }

    setEarlyExitError(null);
    setClaimSuccessMessage(null);
    setShowExitConfirmModal(false);
    setIsTimerPaused(false);

    // Open dedicated YouTube Cinema Pop-up Window
    const url = `https://www.youtube.com/watch?v=${activeCampaign.videoId}`;
    const width = Math.min(1080, window.screen.availWidth - 40);
    const height = Math.min(680, window.screen.availHeight - 80);
    const left = Math.max(10, Math.floor((window.screen.availWidth - width) / 2));
    const top = Math.max(10, Math.floor((window.screen.availHeight - height) / 2));
    
    const win = window.open(
      url, 
      'bashar_yt_watch_window', 
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );
    ytWindowRef.current = win;

    setIsPlaying(true);
    setSecondsRemaining(activeCampaign.targetSeconds);
    setIsCompleted(false);
  };

  // Re-focus or reopen YouTube pop-up window
  const handleRefocusYouTube = () => {
    if (!activeCampaign) return;
    const url = `https://www.youtube.com/watch?v=${activeCampaign.videoId}`;
    if (ytWindowRef.current && !ytWindowRef.current.closed) {
      try {
        ytWindowRef.current.focus();
      } catch (e) {
        // ignore
      }
    } else {
      const width = Math.min(1080, window.screen.availWidth - 40);
      const height = Math.min(680, window.screen.availHeight - 80);
      const left = Math.max(10, Math.floor((window.screen.availWidth - width) / 2));
      const top = Math.max(10, Math.floor((window.screen.availHeight - height) / 2));
      const win = window.open(
        url, 
        'bashar_yt_watch_window', 
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
      );
      ytWindowRef.current = win;
    }
  };

  // User confirmed forced exit
  const handleConfirmForcedExit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ytWindowRef.current && !ytWindowRef.current.closed) {
      try {
        ytWindowRef.current.close();
      } catch (e) {
        // ignore
      }
    }
    ytWindowRef.current = null;
    setIsPlaying(false);
    setIsTimerPaused(false);
    setShowExitConfirmModal(false);
    setSecondsRemaining(activeCampaign ? activeCampaign.targetSeconds : 30);
    setEarlyExitError('⛔ আপনি সেশন থেকে জোরপূর্বক বের হয়ে গেছেন! কোনো ক্রেডিট যোগ করা হয়নি।');
  };

  // Copy link helper
  const handleCopyLink = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setToastMessage('✅ YouTube ভিডিও লিংক কপি করা হয়েছে!');
    setTimeout(() => setToastMessage(null), 3000);
    setOpenMenuCampaignId(null);
  };

  // Secure Delete Verification: Checks that ONLY the creator or admin can request deletion
  const handleRequestDelete = (camp: VideoCampaign) => {
    setOpenMenuCampaignId(null);
    if (!userProfile) {
      openAuthModal();
      return;
    }

    const isRealOwner = (userProfile.uid && camp.userId && userProfile.uid === camp.userId) ||
                        (userProfile.email && camp.creatorEmail && userProfile.email === camp.creatorEmail) ||
                        isAdmin;

    if (!isRealOwner) {
      setToastMessage('⛔ নিরাপত্তা সতর্কতা: আপনি এই ভিডিওটির মূল মালিক নন।');
      return;
    }

    setCampaignToDelete(camp);
  };

  // Execute deletion with remaining views refund to creator
  const executeDeleteCampaign = async (camp: VideoCampaign) => {
    if (!userProfile) {
      openAuthModal();
      return;
    }

    const isRealOwner = (userProfile.uid && camp.userId && userProfile.uid === camp.userId) ||
                        (userProfile.email && camp.creatorEmail && userProfile.email === camp.creatorEmail) ||
                        isAdmin;

    if (!isRealOwner) {
      setToastMessage('⛔ নিরাপত্তা সতর্কতা: আপনি এই ভিডিওটির মূল মালিক নন।');
      setCampaignToDelete(null);
      return;
    }

    setDeleteLoading(true);
    const remainingViews = Math.max(0, camp.targetViews - camp.completedViews);
    const refundCredits = remainingViews * camp.costPerView;
    const now = new Date().toISOString();

    try {
      const campRef = doc(db, 'videoCampaigns', camp.id);

      // Step 1: Update status to 'deleted'
      try {
        await updateDoc(campRef, {
          status: 'deleted',
          updatedAt: now,
        });
      } catch (softErr) {
        console.warn('Notice setting status deleted:', softErr);
      }

      // Step 2: Refund remaining credits to the CAMPAIGN OWNER's account
      if (refundCredits > 0) {
        const ownerUserRef = doc(db, 'users', camp.userId);
        await updateDoc(ownerUserRef, {
          credits: increment(refundCredits),
          updatedAt: now,
        });

        const txRef = doc(db, 'transactions', `refund_${camp.id}_${Date.now()}`);
        const refundTx: Transaction = {
          id: `refund_${camp.id}_${Date.now()}`,
          userId: camp.userId,
          type: 'campaign_refund',
          amount: refundCredits,
          description: `💰 ক্যাম্পেইন মোছা রিফান্ড: ${camp.videoTitle.slice(0, 30)} (${remainingViews}টি অবিক্রীত ভিউ)`,
          createdAt: now,
        };
        await setDoc(txRef, refundTx);
      }

      // Step 3: Delete the document
      await deleteDoc(campRef);

      // Step 4: UI state updates
      setCampaigns((prev) => prev.filter((c) => c.id !== camp.id));
      if (activeCampaign?.id === camp.id) {
        const remaining = campaigns.filter((c) => c.id !== camp.id);
        setActiveCampaign(remaining[0] || null);
      }

      setCampaignToDelete(null);
      setToastMessage(`✅ ক্যাম্পেইন সফলভাবে মুছে ফেলা হয়েছে!${refundCredits > 0 ? ` +${refundCredits.toLocaleString()} ক্রেডিট ফেরত দেওয়া হয়েছে।` : ''}`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.warn('Notice deleting video:', err);
      handleFirestoreError(err, OperationType.DELETE, `videoCampaigns/${camp.id}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered campaigns
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
      {/* Real YouTube View Guarantee Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/70 border border-red-500/30 p-4 sm:p-5 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF0000] flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/40">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                  <span>ইউটিউব সরাসরি ভিউ সিস্টেম</span>
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                    ১০০% অর্গানিক
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>পাবলিক ভিউ বৃদ্ধি নিশ্চয়তা</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Page Visibility ট্র্যাকার সক্রিয়</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                সক্রিয়ভাবে ভিডিও দেখতে হবে। অন্য ট্যাবে গেলে বা মিনিমাইজ করলে <strong className="text-amber-400 font-bold">Page Visibility API</strong> সাথে সাথে টাইমার পজ করে দেবে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-400 font-medium">প্রতি সেকেন্ড দেখা =</div>
              <div className="text-sm font-black text-amber-400 font-mono">১ ক্রেডিট পুরস্কার</div>
            </div>
            <div className="h-8 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono">অ্যাক্টিভ ভিউ ট্র্যাকিং</span>
            </div>
          </div>
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
            ইউটিউবে সরাসরি ভিডিও দেখে প্রতি সেকেন্ডে পয়েন্ট সংগ্রহ করুন
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
            শতভাগ সক্রিয় ট্র্যাকিং: সক্রিয়ভাবে ভিডিও পুরো সময় দেখলেই ক্রেডিট জমা হয়
          </p>
        </div>

        {/* Card 3: User Balance / Daily Check-in */}
        <div className="relative overflow-hidden bg-slate-900/70 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xl transition-all duration-300 group hover:-translate-y-0.5 shadow-black/40">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                আপনার ব্যালেন্স
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
              <span>{userProfile ? `স্ট্রিক: ${userProfile.checkInStreak || 1} দিন` : 'Sign up করলেই ৫০০ ক্রেডিট ফ্রি'}</span>
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

      {/* Login Required Notice for earning credits */}
      {!userProfile && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-red-950/70 via-slate-900 to-amber-950/70 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm sm:text-base">ভিডিও দেখার ক্রেডিট পেতে Log in / Sign up আবশ্যক</div>
              <div className="text-xs text-amber-200/90 font-medium">লগইন বা সাইন আপ না করলে ভিডিও দেখে কোনো ক্রেডিট পাওয়া যাবে না। এখনই Sign up করে ৫০০ ক্রেডিট ফ্রি বোনাস নিন!</div>
            </div>
          </div>
          <button
            onClick={openAuthModal}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer shrink-0 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Log in / Sign up</span>
          </button>
        </div>
      )}

      {/* Main Content Area: YouTube Cinema Showcase (8 cols) & Queue (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: YouTube Cinema Player & Launcher Card */}
        <div className="lg:col-span-8 space-y-4">
          {activeCampaign ? (
            <div className="relative group">
              {/* Ambient backlight glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600/25 via-rose-600/15 to-amber-500/20 rounded-3xl blur-2xl opacity-75 pointer-events-none -z-10 group-hover:opacity-95 transition-opacity duration-500" />

              <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
                {/* Top Control Bar */}
                <div className="p-3.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="font-bold">YouTube সরাসরি সংযোগ ও Page Visibility সক্রিয়</span>
                  </div>

                  <div className="flex items-center gap-2.5 ml-auto">
                    {/* Auto-Next Switch */}
                    <label 
                      className="flex items-center gap-2.5 cursor-pointer select-none text-slate-200 font-semibold text-xs bg-slate-900/95 px-3 py-1.5 rounded-xl border border-slate-700/80 hover:border-red-500/40 transition-colors shadow-sm"
                      title={autoPlayNext ? 'অটো-নেক্সট চালু: ভিডিও দেখা সম্পন্ন হলে স্বয়ংক্রিয়ভাবে ক্রেডিট জমা হয়ে পরবর্তী ভিডিও আসবে' : 'অটো-নেক্সট বন্ধ: ভিডিও দেখা সম্পন্ন হলে ক্রেডিট জমা হবে কিন্তু পরবর্তী ভিডিও ম্যানুয়ালি ক্লিক করতে হবে'}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold">অটো-নেক্সট:</span>
                        <span className={`text-[11px] font-black ${autoPlayNext ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {autoPlayNext ? 'অন (ON)' : 'অফ (OFF)'}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={autoPlayNext}
                          onChange={(e) => handleToggleAutoPlayNext(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4.5 rounded-full transition-colors ${autoPlayNext ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm' : 'bg-slate-700'}`} />
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

                {/* Pre-Watch Cinema Visual Showcase Frame */}
                <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  <div className="relative w-full h-full group/thumb flex flex-col justify-between p-5 sm:p-6 overflow-hidden">
                    <img
                      src={getYouTubeThumbnail(activeCampaign.videoId)}
                      alt={videoDetailsMap[activeCampaign.videoId]?.title || activeCampaign.videoTitle}
                      className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover/thumb:opacity-95 group-hover/thumb:scale-[1.03] transition-all duration-700"
                    />
                    {/* Dark cinema gradient vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/50" />

                    {/* Top Badges */}
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 bg-[#FF0000] text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider">
                          <Play className="w-3.5 h-3.5 fill-white" />
                          YouTube
                        </span>
                        <span className="bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-md font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {activeCampaign.targetSeconds} সেকেন্ড
                        </span>
                      </div>

                      <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 backdrop-blur-md text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1 shadow-md font-mono">
                        <Coins className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+{activeCampaign.targetSeconds} ক্রেডিট রিওয়ার্ড</span>
                      </div>
                    </div>

                    {/* Center Giant YouTube Launch Button */}
                    <div className="relative z-10 flex flex-col items-center justify-center my-auto py-4 text-center">
                      {!userProfile ? (
                        <div 
                          onClick={openAuthModal}
                          className="cursor-pointer group/lock flex flex-col items-center"
                        >
                          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-2xl shadow-red-600/50 group-hover/lock:scale-110 transition-transform duration-300">
                            <Lock className="w-8 h-8 sm:w-9 sm:h-9" />
                          </div>
                          <p className="mt-3 text-white font-black text-sm sm:text-base drop-shadow tracking-tight">
                            ক্রেডিট সংগ্রহ করতে Log in / Sign up করুন
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-bold px-3 py-0.5 rounded-full border border-red-400/40 shadow">
                            <AlertCircle className="w-3 h-3" />
                            <span>লগইন ছাড়া কেউ ক্রেডিট পাবে না</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleStartWatch}
                          className="group/ytbtn flex flex-col items-center cursor-pointer select-none border-none bg-transparent"
                          title="YouTube-এ সরাসরি দেখুন এবং ভিউ বৃদ্ধি করুন"
                        >
                          {/* YouTube Play Icon with pulsating glow */}
                          <div className="relative flex items-center justify-center">
                            <div className="absolute -inset-3 bg-red-600/50 rounded-full blur-xl group-hover/ytbtn:bg-red-600/75 transition-all" />
                            <div className="relative w-20 h-15 sm:w-24 sm:h-17 rounded-2xl bg-[#FF0000] group-hover/ytbtn:bg-[#E60000] flex items-center justify-center text-white shadow-2xl shadow-red-600/60 group-hover/ytbtn:scale-110 transition-transform duration-300">
                              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-0.5" />
                            </div>
                          </div>
                          
                          <div className="mt-3.5 px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 group-hover/ytbtn:border-red-500/50 transition-all shadow-xl">
                            <div className="text-white font-black text-sm sm:text-base flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-400" />
                              <span>YouTube-এ দেখুন ও ভিউ বাড়ান (লকড মোড)</span>
                              <ExternalLink className="w-4 h-4 text-red-400 group-hover/ytbtn:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="text-[11px] text-amber-300 font-bold flex items-center justify-center gap-1 mt-0.5 font-mono">
                              <Coins className="w-3.5 h-3.5 text-amber-400" />
                              <span>+{activeCampaign.targetSeconds} ক্রেডিট রিওয়ার্ড যোগ হবে</span>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Bottom Quick Feature Notice */}
                    <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-300 bg-black/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ইউটিউব চ্যানেল গ্রোথ অ্যালগরিদম সক্রিয়</span>
                      </span>
                      <span className="text-slate-400 font-mono">
                        ভিউ অগ্রগতি: {activeCampaign.completedViews}/{activeCampaign.targetViews}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic YouTube Progress Track */}
                <div className="w-full bg-slate-950 h-1.5 relative overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 h-full transition-all duration-1000 ease-linear shadow-sm"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* YouTube Title & Authentic Info Section */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Early Exit Error Alert if user closed YouTube tab early */}
                  {earlyExitError && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/70 border border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-fadeIn">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/40 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-rose-400" />
                        </div>
                        <div>
                          <div className="font-black text-rose-200 text-sm sm:text-base">
                            ভিউ অসম্পূর্ণ: YouTube উইন্ডো আগে কেটে দেওয়া হয়েছে!
                          </div>
                          <div className="text-xs text-rose-300/90 font-medium mt-0.5 leading-relaxed">
                            {earlyExitError}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={handleStartWatch}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>পুনরায় শুরু করুন</span>
                        </button>
                        <button
                          onClick={handleNextVideo}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 active:scale-95 cursor-pointer"
                        >
                          পরবর্তী ভিডিও ⏭
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. Exact YouTube Video Title */}
                  <div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight leading-snug line-clamp-2 select-text">
                      {videoDetailsMap[activeCampaign.videoId]?.title || activeCampaign.videoTitle}
                    </h1>
                  </div>

                  {/* 2. YouTube Channel Bar & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-3 border-b border-slate-800/80">
                    {/* Channel Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 p-0.5 shadow-md shrink-0">
                        <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white font-black text-sm uppercase">
                          {(videoDetailsMap[activeCampaign.videoId]?.authorName || 'YT').charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm sm:text-base hover:text-red-400 transition-colors">
                            {videoDetailsMap[activeCampaign.videoId]?.authorName || 'YouTube Creator'}
                          </span>
                          <span title="যাচাইকৃত চ্যানেল" className="inline-flex">
                            <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/20 shrink-0" />
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>YouTube অফিসিয়াল ভিডিও</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400 font-medium">অর্গানিক সিঙ্ক</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleStartWatch}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FF0000] hover:bg-[#CC0000] text-white transition-all cursor-pointer shadow-md shadow-red-600/30 active:scale-95"
                        title="YouTube-এ সরাসরি দেখুন ও ভিউ হিস্টোরি সিঙ্ক করুন"
                      >
                        <Lock className="w-3.5 h-3.5 text-white" />
                        <span>লকড মোডে দেখুন</span>
                        <ExternalLink className="w-3 h-3 text-white/80" />
                      </button>

                      <button
                        onClick={() => handleCopyLink(activeCampaign.videoId)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                        title="ভিডিও লিংক কপি করুন"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>কপি লিংক</span>
                      </button>

                      {/* Video Delete Option for Verified Owner or Admin */}
                      {((userProfile?.uid && activeCampaign.userId && userProfile.uid === activeCampaign.userId) || 
                        (userProfile?.email && activeCampaign.creatorEmail && userProfile.email === activeCampaign.creatorEmail) || 
                        isAdmin) && (
                        <button
                          onClick={() => handleRequestDelete(activeCampaign)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all cursor-pointer active:scale-95"
                          title="এই ভিডিওটি ডিলিট করুন এবং অবিক্রীত ভিউয়ের রিফান্ড নিন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছুন</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Campaign Requirements & Points Metric Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                    {/* Watch Duration Requirement */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">নির্ধারিত ওয়াচটাইম</div>
                        <div className="text-sm font-bold text-white font-mono">{formatSecondsToTime(activeCampaign.targetSeconds)}</div>
                      </div>
                    </div>

                    {/* Reward Credit */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">প্রতি ভিউয়ে পুরস্কার</div>
                        <div className="text-sm font-extrabold text-amber-300 font-mono">+{activeCampaign.targetSeconds} ক্রেডিট</div>
                      </div>
                    </div>

                    {/* View Progress */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">ভিউ অগ্রগতি</span>
                          <span className="text-white font-mono font-bold">{activeCampaign.completedViews} / {activeCampaign.targetViews}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-amber-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (Number(activeCampaign.completedViews || 0) / Number(activeCampaign.targetViews || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Claim Success Notification */}
                  {claimSuccessMessage && (
                    <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs sm:text-sm font-semibold animate-fadeIn shadow-lg">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="leading-relaxed">{claimSuccessMessage}</span>
                    </div>
                  )}

                  {/* 4. Watch Execution Action Bar */}
                  <div className="pt-2">
                    {!userProfile ? (
                      <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-red-950/70 via-slate-900 to-amber-950/70 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
                            <Lock className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-white text-sm">ভিডিও দেখার ক্রেডিট পেতে Log in / Sign up আবশ্যক</div>
                            <div className="text-xs text-amber-300 font-medium">লগইন বা সাইন আপ না করলে কেউ ভিডিও দেখলে ক্রেডিট নিতে পারবে না</div>
                          </div>
                        </div>
                        <button
                          onClick={openAuthModal}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer shrink-0 transition-all"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Log in / Sign up</span>
                        </button>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col sm:flex-row items-center gap-3">
                        <button
                          onClick={handleStartWatch}
                          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-xl shadow-red-600/30 active:scale-[0.99] cursor-pointer text-sm sm:text-base select-none"
                        >
                          <Lock className="w-5 h-5" />
                          <span>লকড মোডে YouTube ভিডিও দেখুন ও পয়েন্ট নিন ({activeCampaign.targetSeconds} সেকেন্ড)</span>
                          <ExternalLink className="w-4 h-4 text-white/80" />
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
                      alt={videoDetailsMap[camp.videoId]?.title || camp.videoTitle}
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isOwnerOrAdmin && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/15 border border-red-500/30 text-red-400 font-black px-1.5 py-0.2 rounded">
                              <ShieldCheck className="w-2.5 h-2.5 text-red-400" />
                              <span>আপনার ভিডিও</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug mt-0.5 group-hover:text-red-400 transition-colors">
                          {videoDetailsMap[camp.videoId]?.title || camp.videoTitle}
                        </h4>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="truncate max-w-[120px]">{videoDetailsMap[camp.videoId]?.authorName || 'YouTube Creator'}</span>
                          <CheckCircle2 className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        </div>
                      </div>

                      {/* 3-DOTS ACTIONS MENU */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuCampaignId(openMenuCampaignId === camp.id ? null : camp.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="মেনু"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuCampaignId === camp.id && (
                          <div 
                            className="absolute right-0 mt-1 w-56 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl py-1.5 z-40 animate-fadeIn text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleCopyLink(camp.videoId)}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-900 flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>ভিডিও লিংক কপি করুন</span>
                            </button>

                            <a
                              href={`https://www.youtube.com/watch?v=${camp.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-900 flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              <span>ইউটিউবে সরাসরি দেখুন</span>
                            </a>

                            {isOwnerOrAdmin ? (
                              <button
                                onClick={() => handleRequestDelete(camp)}
                                className="w-full text-left px-3.5 py-2 hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 font-bold transition-colors border-t border-slate-800/80 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>ক্যাম্পেইন ডিলিট ও রিফান্ড</span>
                              </button>
                            ) : (
                              <div className="px-3.5 py-2 border-t border-slate-800/80 flex items-start gap-2 text-[10px] text-slate-400">
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span>অন্য একাউন্টের ভিডিও। ডিলিট করার অধিকার সংরক্ষিত।</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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

      {/* ========================================================================= */}
      {/* 🔒 INESCAPABLE FULLSCREEN CINEMA WATCH OVERLAY (WITH PAGE VISIBILITY API) */}
      {/* ========================================================================= */}
      {isPlaying && activeCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-3xl flex flex-col justify-between p-4 sm:p-8 animate-fadeIn select-none overflow-y-auto">
          {/* Ambient Cyberpunk Glow Behind Cinema Screen */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/20 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-10 left-1/4 w-72 h-72 bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />

          {/* Top Status Header */}
          <div className="relative z-10 max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-600/20">
                <Lock className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-sm sm:text-base tracking-tight">
                    ইউটিউব ওয়াচ সেশন সম্পূর্ণ লকড
                  </span>
                  <span className="text-[10px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                    LOCKED
                  </span>
                </div>
                <p className="text-xs text-amber-300/90 font-medium">
                  {isTimerPaused 
                    ? 'ট্যাব সুইচ বা মিনিমাইজ সনাক্ত হয়েছে! টাইমার পজ করা হয়েছে।' 
                    : 'সক্রিয়ভাবে ভিডিও দেখুন। ট্যাব পরিবর্তন বা মিনিমাইজ করলে টাইমার স্বয়ংক্রিয়ভাবে পজ হবে।'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isTimerPaused ? (
                <span className="flex items-center gap-1.5 text-xs font-mono font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-xl animate-pulse">
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>টাইমার পজড (PAUSED)</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                    সক্রিয় দেখা হচ্ছে • ট্র্যাকিং রানিং
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center Immersive Monitoring Core */}
          <div className="relative z-10 max-w-xl mx-auto w-full my-auto py-6 flex flex-col items-center text-center space-y-6">
            
            {/* Page Visibility API Alert Banner when paused */}
            {isTimerPaused && (
              <div className="w-full p-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 flex items-center gap-3 text-left shadow-xl animate-bounce">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs sm:text-sm font-bold leading-snug">
                  <span>সতর্কতা: আপনি ট্যাব পরিবর্তন বা মিনিমাইজ করেছেন!</span>
                  <span className="block text-[11px] font-normal text-amber-300/90 mt-0.5">
                    পুরো ক্রেডিট পেতে ভিডিওটি সক্রিয়ভাবে দেখতে হবে। পেইজে ফিরে আসা মাত্র টাইমার পুনরায় চলবে।
                  </span>
                </div>
              </div>
            )}

            {/* Pulsating Circular Countdown Gauge */}
            <div className="relative flex items-center justify-center">
              {/* Outer Pulsing Glow Wave */}
              <div className={`absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full border pointer-events-none opacity-40 ${isTimerPaused ? 'border-amber-500/30' : 'border-red-500/25 animate-ping'}`} />
              <div className={`absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full border pointer-events-none ${isTimerPaused ? 'border-amber-500/40' : 'border-amber-500/20'}`} />

              <svg className="w-44 h-44 sm:w-52 sm:h-52 transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="80"
                  className="stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="80"
                  className={`transition-all duration-1000 ease-linear ${isTimerPaused ? 'stroke-amber-400' : 'stroke-red-500'}`}
                  strokeWidth="10"
                  strokeDasharray={502}
                  strokeDashoffset={502 - (502 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center select-none">
                <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight drop-shadow-lg ${isTimerPaused ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                  {secondsRemaining}s
                </span>
                <span className="text-xs text-amber-300 font-extrabold uppercase tracking-widest mt-1 flex items-center gap-1">
                  {isTimerPaused ? (
                    <>
                      <Pause className="w-3 h-3 text-amber-400" />
                      <span>পজড (PAUSED)</span>
                    </>
                  ) : (
                    <span>নির্ধারিত সময় বাকি</span>
                  )}
                </span>
              </div>
            </div>

            {/* Video Summary Capsule */}
            <div className="w-full bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-2xl flex items-center gap-3.5 text-left">
              <img
                src={getYouTubeThumbnail(activeCampaign.videoId)}
                alt=""
                className="w-20 h-14 rounded-2xl object-cover shrink-0 ring-1 ring-slate-700 shadow-md"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                  {videoDetailsMap[activeCampaign.videoId]?.title || activeCampaign.videoTitle}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span className="text-amber-400 font-extrabold font-mono">+{activeCampaign.targetSeconds} ক্রেডিট রিওয়ার্ড</span>
                  <span>•</span>
                  <span className="truncate">{videoDetailsMap[activeCampaign.videoId]?.authorName || 'YouTube Creator'}</span>
                </div>
              </div>
            </div>

            {/* Strict Locked Notice Box */}
            <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border border-red-500/40 text-left space-y-1.5 shadow-xl">
              <div className="flex items-center gap-2 text-rose-300 font-extrabold text-xs">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>Page Visibility API সিকিউরিটি রুলস</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ১. <strong>সক্রিয় থাকা বাধ্যতামূলক:</strong> আপনি অন্য ট্যাবে গেলে বা মিনিমাইজ করলে টাইমার সাথে সাথে থেমে যাবে।<br />
                ২. <strong>সম্পূর্ণ ক্রেডিট:</strong> সময় ০ সেকেন্ড হওয়ামাত্র একাউন্টে পয়েন্ট জমা হয়ে স্ক্রিন আনলক হবে।
              </p>
            </div>

            {/* Center Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRefocusYouTube}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/40 cursor-pointer active:scale-95 transition-all"
              >
                <Tv className="w-4 h-4" />
                <span>YouTube উইন্ডো সামনে আনুন (Focus)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowExitConfirmModal(true)}
                className="text-xs text-slate-400 hover:text-rose-400 py-2.5 px-4 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
              >
                সেশন জোরপূর্বক বাতিল করতে চাই ✕
              </button>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="relative z-10 max-w-5xl mx-auto w-full pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Page Visibility API ও অ্যান্টি-চিট গার্ড সক্রিয়</span>
            </span>
            <span className="text-[11px] text-amber-300/80 font-mono">
              প্রোগ্রেস: {progressPercent}% সম্পূর্ণ
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ⚠️ STRICT EXIT CONFIRMATION MODAL (CONFIRM FORCED EXIT WITH PENALTY) */}
      {/* ========================================================================= */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div 
            className="relative w-full max-w-md bg-slate-900 border border-red-500/50 rounded-3xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-white">আপনি কি নিশ্চিতভাবে বের হতে চান?</h3>
              <p className="text-xs text-rose-300 font-semibold leading-relaxed">
                সতর্কতা: এখনই বের হয়ে গেলে আপনার দেখা বাতিল হবে এবং আপনি <strong>০ ক্রেডিট</strong> পাবেন!
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-400 text-center font-mono">
              বাকি আছে: <strong className="text-amber-400 text-sm">{secondsRemaining} সেকেন্ড</strong>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
              >
                না, দেখা চালিয়ে যান
              </button>
              <button
                type="button"
                onClick={handleConfirmForcedExit}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                হ্যাঁ, বের হয়ে যান (বাতিল)
              </button>
            </div>
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
                  <h3 className="text-base font-black text-white">ভিডিও ক্যাম্পেইন মুছে ফেলবেন?</h3>
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
                  {videoDetailsMap[campaignToDelete.videoId]?.title || campaignToDelete.videoTitle}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                  <span>ভিউ সম্পন্ন: {campaignToDelete.completedViews}/{campaignToDelete.targetViews}</span>
                  <span>•</span>
                  <span>{campaignToDelete.targetSeconds} সেকেন্ড</span>
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
                        <span>আপনার ব্যালেন্সে ফেরত যোগ্য ক্রেডিট:</span>
                      </span>
                      <span className="font-mono text-amber-300 text-sm font-black">+{refund.toLocaleString()} ক্রেডিট</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      ওনার সুরক্ষা যাচাইকৃত: আপনি এই ক্যাম্পেইনের মূল মালিক ({userProfile?.displayName || userProfile?.email}) হিসেবে এটি নিয়ন্ত্রণ করছেন। অন্য কেউ এই ভিডিও ডিলিট করতে পারবে না।
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
