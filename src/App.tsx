/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { WatchVideoView } from './components/WatchVideoView';
import { CreateCampaignView } from './components/CreateCampaignView';
import { MyCampaignsView } from './components/MyCampaignsView';
import { AuthModal } from './components/AuthModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { DailyCheckInModal } from './components/DailyCheckInModal';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { ReferralModal } from './components/ReferralModal';
import { ProfileView } from './components/ProfileView';
import { AdminPanelView } from './components/AdminPanelView';
import { GeminiChatbotView } from './components/GeminiChatbotView';
import { Play, Gift, Sparkles, Flame, Check, Users, User, Bot } from 'lucide-react';

function MainApp() {
  const { userProfile, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<'watch' | 'create' | 'dashboard' | 'profile' | 'admin' | 'chat'>('watch');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [dailyCheckInOpen, setDailyCheckInOpen] = useState(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  // Capture referral parameter from URL on visit (?ref=USER_ID)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      if (refParam && refParam.trim().length > 0) {
        sessionStorage.setItem('bashar_ref', refParam.trim());
        localStorage.setItem('bashar_ref', refParam.trim());
      }
    } catch (e) {
      console.warn('Error reading ref param:', e);
    }
  }, []);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isClaimedToday = userProfile?.lastCheckInDate === todayStr;

  // Auto-open daily check-in modal once per day/session when user logs in to boost DAU
  useEffect(() => {
    if (userProfile && !isClaimedToday) {
      const sessionKey = `daily_prompt_${userProfile.uid}_${todayStr}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1');
        const timer = setTimeout(() => {
          setDailyCheckInOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [userProfile?.uid, isClaimedToday, todayStr]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenHowItWorks={() => setHowItWorksOpen(true)}
        onOpenDailyCheckIn={() => setDailyCheckInOpen(true)}
        onOpenRedeemModal={() => setRedeemModalOpen(true)}
        onOpenReferralModal={() => setReferralModalOpen(true)}
      />

      {/* Floating Welcome Notice for guests */}
      {!userProfile ? (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 py-2.5 px-4 text-white text-xs sm:text-sm font-semibold shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <Gift className="w-4 h-4 shrink-0 text-amber-300 animate-bounce" />
              <span className="truncate">
                স্বাগতম! Sign up করে একাউন্ট খুললেই পেয়ে যান ৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস!
              </span>
            </div>
            <button
              onClick={openAuthModal}
              className="shrink-0 bg-white text-slate-900 hover:bg-slate-100 px-4 py-1.5 rounded-full text-xs font-black shadow cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Log in / Sign up</span>
            </button>
          </div>
        </div>
      ) : !isClaimedToday ? (
        /* Daily Check-in Reminder Banner for logged in users */
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 py-2.5 px-4 text-white text-xs sm:text-sm font-semibold shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <Flame className="w-4 h-4 shrink-0 text-amber-200 animate-bounce" />
              <span className="truncate">
                🎁 আপনার আজকের দৈনিক চেক-ইন বোনাস রেডি! প্রতিদিন প্রবেশ করুন আর বাড়তি ক্রেডিট জিতে নিন।
              </span>
            </div>
            <button
              onClick={() => setDailyCheckInOpen(true)}
              className="shrink-0 bg-slate-950 text-amber-300 hover:bg-black px-4 py-1 rounded-full text-xs font-black shadow border border-amber-400/40 cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>বোনাস ক্লেইম করুন</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'watch' && (
          <WatchVideoView 
            onOpenDailyCheckIn={() => setDailyCheckInOpen(true)}
            onOpenRedeemModal={() => setRedeemModalOpen(true)}
            onOpenReferralModal={() => setReferralModalOpen(true)}
            onGoToCreate={() => setCurrentTab('create')}
          />
        )}
        {currentTab === 'create' && (
          <CreateCampaignView
            onCampaignCreated={() => setCurrentTab('dashboard')}
            onGoToWatch={() => setCurrentTab('watch')}
            onOpenRedeemModal={() => setRedeemModalOpen(true)}
            onOpenReferralModal={() => setReferralModalOpen(true)}
          />
        )}
        {currentTab === 'dashboard' && (
          <MyCampaignsView 
            onCreateCampaignClick={() => setCurrentTab('create')}
            onOpenDailyCheckIn={() => setDailyCheckInOpen(true)}
            onOpenRedeemModal={() => setRedeemModalOpen(true)}
            onOpenReferralModal={() => setReferralModalOpen(true)}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileView 
            onGoToWatch={() => setCurrentTab('watch')}
            onGoToCreate={() => setCurrentTab('create')}
            onOpenDailyCheckIn={() => setDailyCheckInOpen(true)}
          />
        )}
        {currentTab === 'admin' && (
          <AdminPanelView onBackToApp={() => setCurrentTab('watch')} />
        )}
        {currentTab === 'chat' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <GeminiChatbotView />
          </div>
        )}
      </main>

      {/* Floating Gemini AI Launcher Button (visible on other tabs) */}
      {currentTab !== 'chat' && (
        <button
          onClick={() => setCurrentTab('chat')}
          title="বশার এআই সহকারী (Gemini 3.8 Flash)"
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 hover:scale-105 active:scale-95 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl shadow-red-600/40 flex items-center gap-2.5 border border-white/20 transition-all cursor-pointer group"
        >
          <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline font-bold text-xs">এআই সহকারী (Gemini)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Clean Footer */}
      <footer className="bg-slate-900/90 border-t border-slate-800 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <Play className="w-3.5 h-3.5 fill-white" />
            </div>
            <span className="font-bold text-white">Bashar Youtube Grow</span>
            <span>• ইউটিউব ভিডিও ভিউ প্ল্যাটফর্ম</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center sm:justify-start">
            <button
              onClick={() => setHowItWorksOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              নিয়মাবলী (Rules)
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentTab('chat')}
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Bot className="w-3 h-3" />
              <span>এআই সহকারী</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentTab('admin')}
              className="text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
            >
              এডমিন কন্ট্রোল সেন্টার
            </button>
            <span>•</span>
            <span className="text-amber-400 font-medium">১ সেকেন্ড ভিডিও ভিউ = ১ ক্রেডিট</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">৫০০ ক্রেডিট ফ্রি ওয়েলকাম বোনাস</span>
          </div>

          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} Bashar Youtube Grow. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal />
      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />
      <DailyCheckInModal
        isOpen={dailyCheckInOpen}
        onClose={() => setDailyCheckInOpen(false)}
      />
      <RedeemCodeModal
        isOpen={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
      />
      <ReferralModal
        isOpen={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
