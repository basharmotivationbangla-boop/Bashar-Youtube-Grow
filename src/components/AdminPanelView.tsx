import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Tv, 
  Coins, 
  History, 
  Lock, 
  Key, 
  Eye, 
  EyeOff, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  LogOut, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  ExternalLink, 
  Copy, 
  Check, 
  Monitor, 
  Smartphone, 
  Plus, 
  Minus, 
  Sparkles,
  ArrowRight,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { 
  db, 
  verifyAdminMasterPassword, 
  recordAdminLoginLog,
  adminUpdateUserCredits,
  adminUpdateUserStatus,
  adminUpdateUserPassword,
  adminUpdateUserLogo,
  adminDeleteUser,
  adminToggleCampaignStatus,
  adminDeleteCampaign
} from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile, VideoCampaign, AdminLoginLog } from '../types';
import confetti from 'canvas-confetti';

interface AdminPanelViewProps {
  onBackToApp: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onBackToApp }) => {
  const { userProfile } = useAuth();

  // Admin Master Key Gatekeeper State
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('bashar_admin_authorized') === 'true';
  });

  const [enteredAdminEmail, setEnteredAdminEmail] = useState<string>(() => {
    return userProfile?.email || 'basharmotivationbangla@gmail.com';
  });
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [showMasterPassword, setShowMasterPassword] = useState<boolean>(false);
  const [gatekeeperLoading, setGatekeeperLoading] = useState<boolean>(false);
  const [gatekeeperError, setGatekeeperError] = useState<string | null>(null);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'campaigns' | 'security'>('users');

  // Real-time Firestore Collections
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loginLogs, setLoginLogs] = useState<AdminLoginLog[]>([]);
  const [campaignsList, setCampaignsList] = useState<VideoCampaign[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Search & Filter
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Revealed passwords state (UID -> boolean)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // User Edit Modals
  const [selectedUserForCredits, setSelectedUserForCredits] = useState<UserProfile | null>(null);
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState<number>(500);
  const [creditAdjustmentType, setCreditAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [creditReason, setCreditReason] = useState<string>('এডমিন রিওয়ার্ড বোনাস');
  const [savingCredits, setSavingCredits] = useState<boolean>(false);

  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [savingPassword, setSavingPassword] = useState<boolean>(false);

  const [selectedUserForLogo, setSelectedUserForLogo] = useState<UserProfile | null>(null);
  const [newLogoUrlInput, setNewLogoUrlInput] = useState<string>('');
  const [savingLogo, setSavingLogo] = useState<boolean>(false);

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<VideoCampaign | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Listen to all registered users from Firestore
  useEffect(() => {
    if (!isAuthorized) return;
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as UserProfile);
      });
      // Sort users by createdAt descending
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUsersList(list);
      setLoadingData(false);
    }, (error) => {
      console.warn('Notice listening to users collection in Admin:', error);
      setLoadingData(false);
    });

    return () => unsubscribeUsers();
  }, [isAuthorized]);

  // 2. Listen to Admin Login Logs from Firestore
  useEffect(() => {
    if (!isAuthorized) return;
    const logsQuery = query(collection(db, 'adminLoginLogs'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const list: AdminLoginLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AdminLoginLog);
      });
      list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setLoginLogs(list);
    }, (error) => {
      console.warn('Notice listening to adminLoginLogs:', error);
    });

    return () => unsubscribeLogs();
  }, [isAuthorized]);

  // 3. Listen to all video campaigns from Firestore
  useEffect(() => {
    if (!isAuthorized) return;
    const campaignsQuery = query(collection(db, 'videoCampaigns'));
    const unsubscribeCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
      const list: VideoCampaign[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as VideoCampaign);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCampaignsList(list);
    }, (error) => {
      console.warn('Notice listening to videoCampaigns:', error);
    });

    return () => unsubscribeCampaigns();
  }, [isAuthorized]);

  // Handle Master Key Gatekeeper Submission
  const handleGatekeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatekeeperError(null);
    setGatekeeperLoading(true);

    const email = enteredAdminEmail.trim().toLowerCase();
    const key = masterPasswordInput.trim();

    if (!email) {
      setGatekeeperError('অনুগ্রহ করে এডমিন ইমেইল প্রদান করুন।');
      setGatekeeperLoading(false);
      return;
    }
    if (!key) {
      setGatekeeperError('অনুগ্রহ করে শক্তিশালী এডমিন মাস্টার পাসওয়ার্ডটি লিখুন।');
      setGatekeeperLoading(false);
      return;
    }

    try {
      const isValid = await verifyAdminMasterPassword(key);
      await recordAdminLoginLog(email, userProfile?.displayName || 'Super Admin', isValid);

      if (isValid) {
        setIsAuthorized(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('bashar_admin_authorized', 'true');
        }
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        setMasterPasswordInput('');
      } else {
        setGatekeeperError('❌ ভুল এডমিন মাস্টার পাসওয়ার্ড! প্রবেশাধিকার প্রত্যাখ্যাত। এই ব্যর্থ চেষ্টা সিস্টেমে রেকর্ড করা হয়েছে।');
      }
    } catch (err: any) {
      setGatekeeperError(err?.message || 'এডমিন ভেরিফিকেশন ব্যর্থ হয়েছে।');
    } finally {
      setGatekeeperLoading(false);
    }
  };

  const handleAdminLock = () => {
    setIsAuthorized(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bashar_admin_authorized');
    }
    setMasterPasswordInput('');
  };

  const toggleRevealPassword = (uid: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Adjust User Credits
  const handleSaveCredits = async () => {
    if (!selectedUserForCredits) return;
    setSavingCredits(true);
    try {
      const delta = creditAdjustmentType === 'add' ? creditAdjustmentAmount : -creditAdjustmentAmount;
      const targetCredits = Math.max(0, (selectedUserForCredits.credits || 0) + delta);
      await adminUpdateUserCredits(
        selectedUserForCredits.uid,
        targetCredits,
        `${creditReason} (${creditAdjustmentType === 'add' ? '+' : '-'}${creditAdjustmentAmount} ক্রেডিট)`
      );
      showToast(`✅ ${selectedUserForCredits.displayName}-এর ক্রেডিট সফলভাবে আপডেট করা হয়েছে।`);
      setSelectedUserForCredits(null);
    } catch (err: any) {
      showToast(`❌ ক্রেডিট আপডেট ব্যর্থ: ${err?.message}`);
    } finally {
      setSavingCredits(false);
    }
  };

  // Change User Password
  const handleSavePassword = async () => {
    if (!selectedUserForPassword || !newPasswordInput.trim()) return;
    setSavingPassword(true);
    try {
      await adminUpdateUserPassword(selectedUserForPassword.uid, newPasswordInput.trim());
      showToast(`✅ ${selectedUserForPassword.displayName}-এর পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।`);
      setSelectedUserForPassword(null);
      setNewPasswordInput('');
    } catch (err: any) {
      showToast(`❌ পাসওয়ার্ড আপডেট ব্যর্থ: ${err?.message}`);
    } finally {
      setSavingPassword(false);
    }
  };

  // Change User Logo
  const handleSaveLogo = async () => {
    if (!selectedUserForLogo || !newLogoUrlInput.trim()) return;
    setSavingLogo(true);
    try {
      await adminUpdateUserLogo(selectedUserForLogo.uid, newLogoUrlInput.trim());
      showToast(`✅ ${selectedUserForLogo.displayName}-এর লোগো সফলভাবে আপডেট করা হয়েছে।`);
      setSelectedUserForLogo(null);
      setNewLogoUrlInput('');
    } catch (err: any) {
      showToast(`❌ লোগো আপডেট ব্যর্থ: ${err?.message}`);
    } finally {
      setSavingLogo(false);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      await adminUpdateUserStatus(user.uid, nextStatus);
      showToast(`✅ অ্যাকাউন্ট স্ট্যাটাস পরিবর্তিত: ${nextStatus === 'active' ? 'সক্রিয় (Active)' : 'স্থগিত (Suspended)'}`);
    } catch (err: any) {
      showToast(`❌ স্ট্যাটাস পরিবর্তন ব্যর্থ: ${err?.message}`);
    }
  };

  // Delete User
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await adminDeleteUser(userToDelete.uid);
      showToast(`🗑️ ${userToDelete.displayName} অ্যাকাউন্টটি সফলভাবে মুছে ফেলা হয়েছে।`);
      setUserToDelete(null);
    } catch (err: any) {
      showToast(`❌ ডিলিট ব্যর্থ: ${err?.message}`);
    }
  };

  // Toggle Campaign Status
  const handleToggleCampaign = async (camp: VideoCampaign) => {
    const nextStatus = camp.status === 'active' ? 'paused' : 'active';
    try {
      await adminToggleCampaignStatus(camp.id, nextStatus);
      showToast(`✅ ক্যাম্পেইন ${nextStatus === 'active' ? 'চালু' : 'স্থগিত'} করা হয়েছে।`);
    } catch (err: any) {
      showToast(`❌ এরর: ${err?.message}`);
    }
  };

  // Delete Campaign
  const handleConfirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await adminDeleteCampaign(campaignToDelete.id);
      showToast('🗑️ ক্যাম্পেইন মুছে ফেলা হয়েছে।');
      setCampaignToDelete(null);
    } catch (err: any) {
      showToast(`❌ ডিলিট ব্যর্থ: ${err?.message}`);
    }
  };

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const nameMatch = (u.displayName || '').toLowerCase().includes(userSearchTerm.toLowerCase());
    const emailMatch = (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || (u.status || 'active') === statusFilter;
    return (nameMatch || emailMatch) && statusMatch;
  });

  // Aggregate Stats
  const totalCirculatingCredits = usersList.reduce((acc, u) => acc + (Number(u.credits) || 0), 0);
  const totalActiveCampaigns = campaignsList.filter((c) => c.status === 'active').length;
  const totalCompletedCampaignViews = campaignsList.reduce((acc, c) => acc + (Number(c.completedViews) || 0), 0);

  // =========================================================================
  // 🔒 GATEKEEPER: UNLOCK WITH MASTER ADMIN PASSWORD
  // =========================================================================
  if (!isAuthorized) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
        <div className="relative w-full max-w-md bg-slate-900/95 border-2 border-red-500/50 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Shield Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto shadow-xl shadow-red-600/20">
              <Shield className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
                RESTRICTED ACCESS
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                সুপার এডমিন কন্ট্রোল সেন্টার
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                এই প্যানেলে প্রবেশ করতে আপনার গোপন এডমিন মাস্টার পাসওয়ার্ড প্রদান করুন।
              </p>
            </div>
          </div>

          {/* Gatekeeper Form */}
          <form onSubmit={handleGatekeeperSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>এডমিন Gmail:</span>
              </label>
              <input
                type="email"
                value={enteredAdminEmail}
                onChange={(e) => setEnteredAdminEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>শক্তিশালী এডমিন মাস্টার পাসওয়ার্ড:</span>
              </label>
              <div className="relative">
                <input
                  type={showMasterPassword ? 'text' : 'password'}
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                  placeholder="গোপন এডমিন পাসওয়ার্ড লিখুন"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterPassword(!showMasterPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {gatekeeperError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{gatekeeperError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={gatekeeperLoading}
              className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {gatekeeperLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4 text-amber-300" />
                  <span>এডমিন প্যানেলে প্রবেশ করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-800/80">
            <button
              onClick={onBackToApp}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← মূল ওয়েবসাইটে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 🛡️ FULL ADMIN CONTROL PANEL (AUTHORIZED)
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-red-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-slideUp">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Admin Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/80 border border-red-500/30 p-5 sm:p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-white text-lg sm:text-xl">
                  সুপার এডমিন কন্ট্রোল সেন্টার
                </h1>
                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  MASTER ADMIN
                </span>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  VERIFIED SESSION
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                সকল ব্যবহারকারীর অ্যাকাউন্ট ডিটেইলস, পাসওয়ার্ড, লগইন হিস্টোরি ও ভিডিও ক্যাম্পেইন নিয়ন্ত্রণ।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleAdminLock}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="লক করুন"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>লক করুন</span>
            </button>
            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <span>ইউজার ভিউতে যান</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>মোট ব্যবহারকারী</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{usersList.length}</div>
          <div className="text-[10px] text-emerald-400 font-medium">নিবন্ধিত অ্যাকাউন্ট</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>মোট ক্রেডিট সঞ্চিত</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{totalCirculatingCredits.toLocaleString()}</div>
          <div className="text-[10px] text-amber-300 font-medium">ব্যবহারকারীদের ব্যালেন্স</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>সক্রিয় ক্যাম্পেইন</span>
            <Tv className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalActiveCampaigns}</div>
          <div className="text-[10px] text-slate-400 font-medium">মোট সম্পন্ন ভিউ: {totalCompletedCampaignViews}</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>এডমিন লগইন প্রচেষ্টা</span>
            <History className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">{loginLogs.length}</div>
          <div className="text-[10px] text-purple-300 font-medium">রেকর্ডকৃত এক্সেস লগ</div>
        </div>
      </div>

      {/* Main Admin Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ব্যবহারকারী অ্যাকাউন্ট তালিকা ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>এডমিন লগইন হিস্টোরি ({loginLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'campaigns'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>ভিডিও ক্যাম্পেইন নিয়ন্ত্রণ ({campaignsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>সিকিউরিটি ও অ্যান্টি-চিট গার্ড</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ALL USERS DIRECTORY ("যে যে একাউন্ট এর খুলবে সমস্ত ডিটেলস থাকবে") */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search & Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="নাম অথবা Gmail দিয়ে খুঁজুন..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400">স্ট্যাটাস:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
              >
                <option value="all">সকল ব্যবহারকারী ({usersList.length})</option>
                <option value="active">সক্রিয় (Active)</option>
                <option value="suspended">স্থগিত (Suspended)</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black">লোগো / ছবি</th>
                    <th className="py-3.5 px-4 font-black">নাম (Name)</th>
                    <th className="py-3.5 px-4 font-black">Gmail / ইমেইল</th>
                    <th className="py-3.5 px-4 font-black">পাসওয়ার্ড (Password)</th>
                    <th className="py-3.5 px-4 font-black">ক্রেডিট ব্যালেন্স</th>
                    <th className="py-3.5 px-4 font-black">ডিভাইস</th>
                    <th className="py-3.5 px-4 font-black">স্ট্যাটাস</th>
                    <th className="py-3.5 px-4 font-black text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        কোনো ব্যবহারকারী পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isRevealed = revealedPasswords[u.uid] || false;
                      const hasPassword = Boolean(u.password);
                      const isUserSuspended = u.status === 'suspended';

                      return (
                        <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                          {/* লোগো (User Logo / Avatar) */}
                          <td className="py-3 px-4">
                            <div className="relative group/logo">
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt={u.displayName}
                                  className="w-10 h-10 rounded-2xl object-cover ring-1 ring-slate-700 shadow-md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                                  {u.displayName ? u.displayName.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedUserForLogo(u);
                                  setNewLogoUrlInput(u.photoURL || '');
                                }}
                                title="লোগো পরিবর্তন করুন"
                                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>

                          {/* নাম (Name) */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm">{u.displayName || 'নামহীন ইউজার'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">UID: {u.uid.slice(0, 14)}...</div>
                          </td>

                          {/* Gmail */}
                          <td className="py-3 px-4 font-mono text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span>{u.email}</span>
                              <button
                                onClick={() => copyToClipboard(u.email, `email_${u.uid}`)}
                                title="ইমেইল কপি করুন"
                                className="text-slate-500 hover:text-white cursor-pointer"
                              >
                                {copiedKey === `email_${u.uid}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            {u.role === 'admin' && (
                              <span className="text-[9px] bg-red-600/30 text-red-400 border border-red-500/40 px-1.5 py-0.2 rounded font-bold">ADMIN</span>
                            )}
                          </td>

                          {/* পাসওয়ার্ড (Password) - With reveal eye & copy */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-amber-300">
                                {hasPassword ? (isRevealed ? u.password : '••••••••') : '(Google Auth)'}
                              </span>
                              {hasPassword && (
                                <>
                                  <button
                                    onClick={() => toggleRevealPassword(u.uid)}
                                    title={isRevealed ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-950 cursor-pointer transition-colors"
                                  >
                                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(u.password || '', `pw_${u.uid}`)}
                                    title="পাসওয়ার্ড কপি করুন"
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-950 cursor-pointer transition-colors"
                                  >
                                    {copiedKey === `pw_${u.uid}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                          {/* ক্রেডিট */}
                          <td className="py-3 px-4">
                            <span className="font-black font-mono text-amber-400 text-sm">
                              {Number(u.credits || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">পয়েন্ট</span>
                          </td>

                          {/* ডিভাইস */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                              {u.deviceType === 'mobile' ? (
                                <>
                                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                  <span>মোবাইল</span>
                                </>
                              ) : (
                                <>
                                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                                  <span>কম্পিউটার</span>
                                </>
                              )}
                            </span>
                          </td>

                          {/* স্ট্যাটাস */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isUserSuspended 
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {isUserSuspended ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              <span>{isUserSuspended ? 'স্থগিত (Suspended)' : 'সক্রিয় (Active)'}</span>
                            </span>
                          </td>

                          {/* অ্যাকশনস */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Add / Deduct Credits */}
                              <button
                                onClick={() => setSelectedUserForCredits(u)}
                                title="ক্রেডিট যোগ বা কর্তন করুন"
                                className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 cursor-pointer transition-all"
                              >
                                <Coins className="w-3.5 h-3.5" />
                              </button>

                              {/* Change Password */}
                              <button
                                onClick={() => {
                                  setSelectedUserForPassword(u);
                                  setNewPasswordInput(u.password || '');
                                }}
                                title="পাসওয়ার্ড পরিবর্তন করুন"
                                className="p-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 cursor-pointer transition-all"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Suspend / Activate */}
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={isUserSuspended ? 'অ্যাকাউন্ট পুনরায় সক্রিয় করুন' : 'অ্যাকাউন্ট স্থগিত করুন'}
                                className={`p-1.5 rounded-xl border cursor-pointer transition-all ${
                                  isUserSuspended
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                                    : 'bg-rose-500/10 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                                }`}
                              >
                                {isUserSuspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="অ্যাকাউন্ট ডিলিট করুন"
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/30 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 cursor-pointer transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ADMIN LOGIN LOGS ("কে কে লগইন করেছে তার একটা লিস্ট থাকবে") */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-sm font-bold text-white">এডমিন প্যানেল এক্সেস হিস্টোরি ও সিকিউরিটি অডিট</h3>
                <p className="text-xs text-slate-400">কে কখন কোন ডিভাইস থেকে এডমিন প্যানেলে লগইন করার চেষ্টা করেছে তার তালিকা।</p>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
              মোট রেকর্ড: {loginLogs.length} টি
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-black">স্ট্যাটাস</th>
                    <th className="py-3.5 px-4 font-black">এডমিন ইমেইল ও নাম</th>
                    <th className="py-3.5 px-4 font-black">তারিখ ও সময়</th>
                    <th className="py-3.5 px-4 font-black">ডিভাইস টাইপ</th>
                    <th className="py-3.5 px-4 font-black">ব্রাউজার ও সিস্টেম ইনফো</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loginLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 font-sans">
                        এখনও কোনো এডমিন লগইন রেকর্ড তৈরি হয়নি।
                      </td>
                    </tr>
                  ) : (
                    loginLogs.map((log) => {
                      const isSuccess = log.status === 'SUCCESS';
                      const dateObj = new Date(log.timestamp);
                      const timeStr = dateObj.toLocaleString('bn-BD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-sans">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                            }`}>
                              {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              <span>{isSuccess ? 'সফল প্রবেশ (SUCCESS)' : 'ব্যর্থ প্রচেষ্টা (FAILED)'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-xs font-sans">{log.adminName}</div>
                            <div className="text-[11px] text-slate-400">{log.adminEmail}</div>
                          </td>
                          <td className="py-3 px-4 text-amber-300 text-xs">
                            {timeStr}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                              {log.deviceType === 'mobile' ? (
                                <>
                                  <Smartphone className="w-4 h-4 text-amber-400" />
                                  <span>মোবাইল</span>
                                </>
                              ) : (
                                <>
                                  <Monitor className="w-4 h-4 text-blue-400" />
                                  <span>কম্পিউটার</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[10px] text-slate-400 max-w-xs truncate" title={log.userAgent}>
                            {log.userAgent}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VIDEO CAMPAIGNS CONTROL */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Tv className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-white">ব্যবহারকারীদের তৈরি করা YouTube ভিডিও ক্যাম্পেইন</h3>
                <p className="text-xs text-slate-400">যে কোনো অনুপযুক্ত ভিডিও বন্ধ বা সম্পূর্ণ মুছে ফেলার এডমিন ক্ষমতা।</p>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
              মোট ক্যাম্পেইন: {campaignsList.length} টি
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaignsList.map((c) => {
              const isPaused = c.status === 'paused';
              const isCompleted = (Number(c.completedViews) || 0) >= Number(c.targetViews);

              return (
                <div key={c.id} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="relative rounded-2xl overflow-hidden aspect-video bg-black ring-1 ring-slate-800">
                      <img
                        src={`https://img.youtube.com/vi/${c.videoId}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/85 text-white font-mono text-[10px] px-2 py-0.5 rounded-md font-bold">
                        {c.targetSeconds} সে.
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{c.videoTitle}</h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">তৈরি করেছেন: {c.creatorEmail}</p>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">ভিউ প্রোগ্রেস</div>
                        <div className="font-bold text-white font-mono">{c.completedViews} / {c.targetViews}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">স্ট্যাটাস</div>
                        <div className={`font-bold capitalize text-xs ${
                          isCompleted ? 'text-blue-400' : isPaused ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {isCompleted ? 'সম্পন্ন (Completed)' : isPaused ? 'স্থগিত (Paused)' : 'সক্রিয় (Active)'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <a
                      href={`https://www.youtube.com/watch?v=${c.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-red-400" />
                      <span>YouTube</span>
                    </a>

                    <button
                      onClick={() => handleToggleCampaign(c)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isPaused 
                          ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                          : 'bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
                      }`}
                    >
                      {isPaused ? 'চালু করুন' : 'পজ করুন'}
                    </button>

                    <button
                      onClick={() => setCampaignToDelete(c)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & ANTI-CHEAT SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>প্ল্যাটফর্ম সিকিউরিটি ও অ্যান্টি-চিট গার্ড স্ট্যাটাস</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ইউটিউব ভিউ সুরক্ষা ও প্রতারণা রোধে বাস্তবায়িত স্বয়ংক্রিয় গার্ড সিস্টেম।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">Page Visibility API (ট্যাব সুইচ গার্ড)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">সক্রিয়</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ভিডিও দেখার সময় ব্যবহারকারী অন্য ট্যাবে গেলে বা মিনিমাইজ করলে টাইমার স্বয়ংক্রিয়ভাবে থেমে যায় এবং কন্টেন্ট এরিয়ায় <strong>backdrop-filter: blur(20px)</strong> চালু হয়।
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">লকড ওয়াচ মোড (কম্পিউটার ও মোবাইল)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">সক্রিয়</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ভিডিও সেশন চলাকালে কম্পিউটারে কীবোর্ড শর্টকাট (F1-F12, Space, Escape, ইত্যাদি) ও রাইট-ক্লিক ব্লক থাকে। মোবাইলে টাচ ও পুল-টু-রিফ্রেশ সম্পূর্ণ ব্লক থাকে।
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">ভুল পাসওয়ার্ড সুরক্ষা</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">সক্রিয়</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  লগইনের সময় কঠোর পাসওয়ার্ড যাচাই করা হয়। ভুল পাসওয়ার্ড দিলে কোনোভাবেই একাউন্টে প্রবেশ করা যাবে না।
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">এডমিন মাস্টার কি হ্যাশ ভেরিফিকেশন</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">SHA-256 সুরক্ষিত</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  এডমিন মাস্টার পাসওয়ার্ডটি ওয়েবসাইটে বা সোর্স কোডে উন্মুক্ত থাকে না। ক্রিপ্টোগ্রাফিক হ্যাশের মাধ্যমে কঠোর যাচাই শেষে প্রবেশাধিকার দেওয়া হয়।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADJUST CREDITS (ADD / DEDUCT) */}
      {/* ========================================================================= */}
      {selectedUserForCredits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">ক্রেডিট সমন্বয় করুন</h3>
              </div>
              <button
                onClick={() => setSelectedUserForCredits(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">ব্যবহারকারী:</div>
              <div className="text-sm font-bold text-white">{selectedUserForCredits.displayName} ({selectedUserForCredits.email})</div>
              <div className="text-xs text-amber-400 font-mono">বর্তমান ব্যালেন্স: {selectedUserForCredits.credits} ক্রেডিট</div>
            </div>

            <div className="space-y-3">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCreditAdjustmentType('add')}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    creditAdjustmentType === 'add' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  + ক্রেডিট যোগ করুন
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAdjustmentType('deduct')}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    creditAdjustmentType === 'deduct' ? 'bg-rose-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  - ক্রেডিট কেটে নিন
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">ক্রেডিট পরিমাণ:</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={creditAdjustmentAmount}
                  onChange={(e) => setCreditAdjustmentAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300">কারণ / নোট:</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="যেমন: এডমিন স্পেশাল বোনাস"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedUserForCredits(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveCredits}
                disabled={savingCredits}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingCredits ? 'সংরক্ষণ হচ্ছে...' : 'নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE USER PASSWORD */}
      {/* ========================================================================= */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">ব্যবহারকারীর পাসওয়ার্ড পরিবর্তন</h3>
              </div>
              <button onClick={() => setSelectedUserForPassword(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-slate-400">অ্যাকাউন্ট: <strong className="text-white">{selectedUserForPassword.displayName} ({selectedUserForPassword.email})</strong></div>
              <div className="text-slate-400">বর্তমান পাসওয়ার্ড: <span className="font-mono text-amber-300">{selectedUserForPassword.password || '(Not Set)'}</span></div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">নতুন পাসওয়ার্ড:</label>
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড লিখুন"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleSavePassword}
                disabled={savingPassword || !newPasswordInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CHANGE USER LOGO */}
      {/* ========================================================================= */}
      {selectedUserForLogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">ব্যবহারকারীর লোগো / ছবি পরিবর্তন</h3>
              </div>
              <button onClick={() => setSelectedUserForLogo(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={newLogoUrlInput || selectedUserForLogo.photoURL}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-red-500 shadow-md"
              />
              <div className="text-xs">
                <div className="font-bold text-white">{selectedUserForLogo.displayName}</div>
                <div className="text-slate-400">{selectedUserForLogo.email}</div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">নতুন ছবির লিঙ্ক (Image URL):</label>
              <input
                type="url"
                value={newLogoUrlInput}
                onChange={(e) => setNewLogoUrlInput(e.target.value)}
                placeholder="https://example.com/logo.jpg"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedUserForLogo(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveLogo}
                disabled={savingLogo || !newLogoUrlInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingLogo ? 'সংরক্ষণ হচ্ছে...' : 'লোগো আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM DELETE USER */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">আপনি কি নিশ্চিতভাবে এই অ্যাকাউন্টটি ডিলিট করতে চান?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ব্যবহারকারী: <strong className="text-white">{userToDelete.displayName} ({userToDelete.email})</strong>। ডিলিট করার পর এই ডাটা আর পুনরুদ্ধার করা যাবে না।
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-rose-600/30"
              >
                ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIRM DELETE CAMPAIGN */}
      {/* ========================================================================= */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">ক্যাম্পেইনটি সম্পূর্ণ মুছে ফেলতে চান?</h3>
              <p className="text-xs text-slate-400 leading-relaxed truncate">
                {campaignToDelete.videoTitle}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setCampaignToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmDeleteCampaign}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
