import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Camera, 
  Upload, 
  Check, 
  Save, 
  Sparkles, 
  Coins, 
  Flame, 
  ShieldCheck, 
  Copy, 
  LogOut, 
  Calendar, 
  Mail, 
  Tv, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Zap,
  Image as ImageIcon
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logOut } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import confetti from 'canvas-confetti';

interface ProfileViewProps {
  onGoToWatch: () => void;
  onGoToCreate: () => void;
  onOpenDailyCheckIn?: () => void;
}

// Curated selection of professional creator avatars & logos
const PRESET_LOGOS = [
  { id: 'creator-red', name: 'YouTube Creator', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80' },
  { id: 'tech-cyan', name: 'Tech Cyber', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&auto=format&fit=crop&q=80' },
  { id: 'motivation-fire', name: 'Motivation Pro', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=200&auto=format&fit=crop&q=80' },
  { id: 'gaming-neon', name: 'Gaming Neon', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80' },
  { id: 'studio-gold', name: 'Golden Studio', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80' },
  { id: 'gradient-sphere', name: 'Digital Art', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=200&auto=format&fit=crop&q=80' },
  { id: 'avatar-minimal', name: 'Minimalist Clean', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: 'avatar-creator', name: 'Vlogger Icon', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' }
];

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  onGoToWatch, 
  onGoToCreate,
  onOpenDailyCheckIn 
}) => {
  const { userProfile, setUserProfileDirect, openAuthModal } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [customUrlInput, setCustomUrlInput] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  
  const [userCampaignCount, setUserCampaignCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state if userProfile loads
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhotoURL(userProfile.photoURL || '');
    }
  }, [userProfile]);

  // Load user's campaign statistics
  useEffect(() => {
    if (!userProfile) return;
    const fetchStats = async () => {
      try {
        const q = query(collection(db, 'videoCampaigns'), where('userId', '==', userProfile.uid));
        const snap = await getDocs(q);
        setUserCampaignCount(snap.size);
      } catch (e) {
        console.warn('Notice loading profile stats:', e);
      }
    };
    fetchStats();
  }, [userProfile]);

  if (!userProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-5 animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-amber-400 shadow-xl">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white">প্রোফাইল দেখতে প্রথমে লগইন করুন</h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          আপনার প্রোফাইল পেজে প্রবেশ করে নিজের নাম এবং চ্যানেলের লোগো সেট করতে Log in বা Sign up করুন।
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-extrabold text-sm shadow-xl shadow-red-600/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          Log in / Sign up করুন
        </button>
      </div>
    );
  }

  // Handle local image file upload & compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('অনুগ্রহ করে একটি সঠিক ছবি (JPG, PNG, WebP) নির্বাচন করুন।');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট হতে পারবে।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize and optimize to max 256x256 square avatar
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 200, 200);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoURL(compressedDataUrl);
          setSuccessMessage('লোগো প্রিভিউ প্রস্তুত! নিচে "সংরক্ষণ করুন" বাটনে ক্লিক করুন।');
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Set custom image URL
  const handleApplyCustomUrl = () => {
    const clean = customUrlInput.trim();
    if (!clean) {
      setErrorMessage('একটি সঠিক ছবির লিংক দিন।');
      return;
    }
    setPhotoURL(clean);
    setCustomUrlInput('');
    setSuccessMessage('ছবির লিংক যুক্ত করা হয়েছে! নিচে সংরক্ষণ করুন।');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save changes to Firestore and local state
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMessage('অনুগ্রহ করে একটি সঠিক নাম প্রদান করুন।');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const nowIso = new Date().toISOString();
    const userRef = doc(db, 'users', userProfile.uid);

    try {
      await updateDoc(userRef, {
        displayName: cleanName,
        photoURL: photoURL.trim(),
        updatedAt: nowIso
      });

      const updatedProfile: UserProfile = {
        ...userProfile,
        displayName: cleanName,
        photoURL: photoURL.trim(),
        updatedAt: nowIso
      };

      setUserProfileDirect(updatedProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bashar_google_user', JSON.stringify(updatedProfile));
        window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: updatedProfile }));
      }

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setSuccessMessage('🎉 আপনার নাম এবং লোগো সফলভাবে আপডেট করা হয়েছে!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error updating profile in Firestore:', err);
      setErrorMessage('প্রোফাইল আপডেট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUid = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(userProfile.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      
      {/* 1. Profile Header Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-l from-red-600/20 via-rose-600/15 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-80 h-40 bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Decorative Banner */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 relative p-6 flex items-start justify-between">
          <span className="px-3.5 py-1 bg-black/30 backdrop-blur-md text-white/95 rounded-full text-xs font-bold border border-white/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Bashar YouTube Grow অফিসিয়াল প্রোফাইল</span>
          </span>

          <button
            onClick={() => logOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-rose-200 hover:text-white text-xs font-bold backdrop-blur-md transition-all cursor-pointer active:scale-95"
            title="লগআউট করুন"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>

        {/* User Identity Row */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:-mt-20">
            {/* Avatar / Logo Display */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-950 p-1.5 shadow-2xl ring-4 ring-slate-900 overflow-hidden relative">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName || 'User Logo'}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white font-black text-3xl uppercase shadow-inner">
                    {(displayName || userProfile.email || 'U').charAt(0)}
                  </div>
                )}

                {/* Quick overlay change trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-1.5 rounded-2xl bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer text-[10px] font-bold gap-1"
                >
                  <Camera className="w-5 h-5 text-amber-300" />
                  <span>লোগো পরিবর্তন</span>
                </button>
              </div>

              {/* Online / Active Badge */}
              <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-slate-900 flex items-center justify-center shadow-lg" title="অ্যাকাউন্ট সক্রিয়">
                <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
              </div>
            </div>

            {/* Name, Email, and Status */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {displayName || 'ইউজার প্রোফাইল'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>যাচাইকৃত ক্রিয়েটর</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{userProfile.email}</span>
              </p>
            </div>

            {/* Quick Balance Display */}
            <div className="shrink-0 flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-md">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">বর্তমান ব্যালেন্স</span>
                <span className="text-base sm:text-lg font-black text-amber-300 font-mono">
                  {userProfile.credits.toLocaleString()} ক্রেডিট
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">মোট ক্রেডিট</span>
              <span className="text-sm sm:text-base font-extrabold text-white font-mono">{userProfile.credits}</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">দৈনিক স্ট্রিক</span>
              <span className="text-sm sm:text-base font-extrabold text-amber-400 font-mono flex items-center gap-1">
                <Flame className="w-4 h-4 fill-amber-400" />
                <span>{userProfile.checkInStreak || 1} দিন</span>
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">আমার ভিডিও ক্যাম্পেইন</span>
              <span className="text-sm sm:text-base font-extrabold text-white font-mono">{userCampaignCount} টি</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block">যোগদানের তারিখ</span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('bn-BD') : 'নতুন সদস্য'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3 shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-semibold flex items-center gap-3 shadow-lg animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Profile Edit Section: নাম ও লোগো পরিবর্তন */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: নাম পরিবর্তন ও ইমেজ সেভ */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-red-600/15 text-red-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-white">নাম ও প্রোফাইল তথ্য পরিবর্তন</h2>
              <p className="text-xs text-slate-400">আপনার প্রদর্শিত নাম ও লোগো আপডেট করে সংরক্ষণ করুন</p>
            </div>
          </div>

          <form onSubmit={handleSaveChanges} className="space-y-5">
            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>আপনার প্রদর্শিত নাম (Name):</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="যেমন: Bashar Motivation Bangla"
                required
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
              />
              <span className="text-[11px] text-slate-400 block">
                এই নামটি আপনার সব ভিডিও এবং অ্যাকাউন্টে প্রদর্শিত হবে।
              </span>
            </div>

            {/* Email (Readonly) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>রেজিস্ট্রেশনকৃত Gmail / ইমেইল:</span>
              </label>
              <input
                type="email"
                value={userProfile.email}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-400 font-mono cursor-not-allowed select-all"
              />
            </div>

            {/* Current Logo URL Input (optional direct link) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>লোগো বা ছবির ওয়েব লিংক (Image URL):</span>
                </span>
                <span className="text-[11px] text-slate-400">ঐচ্ছিক</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition-colors cursor-pointer shrink-0"
                >
                  প্রয়োগ
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm sm:text-base shadow-xl shadow-red-600/30 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 text-amber-200" />
                  <span>পরিবর্তনগুলো সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Form: লোগো আপলোড ও প্রিসেট গ্যালারি */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* File Upload Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Camera className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm sm:text-base text-white">ডিভাইস থেকে লোগো আপলোড</h3>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-red-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-950/60 hover:bg-slate-950 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-600/15 text-red-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                লোগো বা ছবি আপলোড করতে ক্লিক করুন
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                JPG, PNG, WebP (সর্বোচ্চ ৫ MB)
              </p>
            </div>
          </div>

          {/* Curated Presets Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm sm:text-base text-white">প্রফেশনাল ক্রিয়েটর লোগো বেছে নিন</h3>
              </div>
              <span className="text-[10px] text-slate-400">১-ক্লিক</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {PRESET_LOGOS.map((preset) => {
                const isSelected = photoURL === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setPhotoURL(preset.url);
                      setSuccessMessage(`"${preset.name}" লোগো নির্বাচন করা হয়েছে! নিচে সংরক্ষণ করুন।`);
                      setTimeout(() => setSuccessMessage(null), 3000);
                    }}
                    className={`relative rounded-2xl p-1 overflow-hidden transition-all group cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-red-500 scale-105 shadow-lg shadow-red-600/30'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={preset.name}
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full aspect-square object-cover rounded-xl"
                    />
                    {isSelected && (
                      <div className="absolute inset-1 rounded-xl bg-red-600/40 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* UID & Account Security */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">ইউনিক অ্যাকাউন্ট আইডি (UID):</span>
              <button
                type="button"
                onClick={handleCopyUid}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedUid ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 truncate border border-slate-800">
              {userProfile.uid}
            </div>
          </div>

        </div>

      </div>

      {/* 3. Bottom Quick Navigation Bar */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <h4 className="font-extrabold text-white text-sm sm:text-base">ভিডিও ক্যাম্পেইন তৈরি করতে চান?</h4>
          <p className="text-xs text-slate-400">আপনার ক্রেডিট দিয়ে নিজের YouTube ভিডিও সরাসরি অন্য দর্শকদের কাছে পৌঁছান</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGoToWatch}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            ভিডিও দেখুন
          </button>
          <button
            onClick={onGoToCreate}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>ক্যাম্পেইন তৈরি করুন</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
