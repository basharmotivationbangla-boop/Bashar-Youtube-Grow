import React from 'react';
import { X, Gift, Play, Coins, CheckCircle, Clock, ShieldCheck, Users, Sparkles } from 'lucide-react';
import { WELCOME_CREDITS, REFERRAL_REWARD_CREDITS } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Bashar Youtube Grow নিয়মাবলী</h3>
              <p className="text-xs text-white/80">ভিডিও ভিউ, ক্যাম্পেইন ও পয়েন্ট সিস্টেমের নিয়ম</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-black/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-7 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
          {/* Rule 1: 500 Welcome Bonus */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
            <Gift className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">১. ৫০০ ক্রেডিট ফ্রি সাইন আপ বোনাস</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                নতুন অ্যাকাউন্ট সাইন আপ বা লগইন করার সাথে সাথেই সরাসরি <strong>{WELCOME_CREDITS} ক্রেডিট</strong> সম্পূর্ণ বিনামূল্যে ওয়েলকাম বোনাস হিসেবে পেয়ে যাবেন।
              </p>
            </div>
          </div>

          {/* Rule 2: Firebase Firestore & Authentication */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-300">২. Firebase Firestore & Auth ডেটাবেস</h4>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  রিয়েল-টাইম
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                আপনার সমস্ত পয়েন্ট, ভিডিও প্রচার এবং দেখার রেকর্ড সরাসরি Google Firebase Firestore ডেটাবেসে তাৎক্ষণিকভাবে সিঙ্ক ও সংরক্ষিত থাকে।
              </p>
            </div>
          </div>

          {/* Rule 3: Video Views */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 shadow-sm">
            <Play className="w-6 h-6 text-red-400 shrink-0 mt-0.5 fill-red-400" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-300">৩. ভিডিও ভিউ রেট (১ সেকেন্ড = ১ ক্রেডিট)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                যত সেকেন্ড ভিডিও দেখবেন সরাসরি ঠিক তত ক্রেডিট অ্যাকাউন্টে জমা হবে। যেমন: ৩০ সেকেন্ড দেখলে ৩০ ক্রেডিট, ৬০ সেকেন্ডে ৬০ ক্রেডিট, ৩০০ সেকেন্ডে ৩০০ ক্রেডিট ইত্যাদি।
              </p>
            </div>
          </div>

          {/* Rule 4: Daily Check-in Bonus */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 shadow-sm">
            <Sparkles className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-purple-300">৪. দৈনিক চেক-ইন বোনাস (Daily Check-in)</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                প্রতিদিন অ্যাপে লগইন করলেই পাচ্ছেন ফ্রি বোনাস পয়েন্ট! ১ম দিনে ২০ ক্রেডিট থেকে শুরু করে ৭ম দিনে পাবেন মেগা ১০০ ক্রেডিট বোনাস।
              </p>
            </div>
          </div>

          {/* Rule 5: YouTube History Sync & Fast Videos */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 shadow-sm">
            <Clock className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-sky-300">৫. YouTube History সিঙ্ক ও দ্রুত ভিডিও লোড</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                আমাদের প্লেয়ারে ভিডিও দেখার পর সরাসরি আপনার Google YouTube History-তে ভিউ যুক্ত হতে পারে। আরও নিশ্চিত করতে সরাসরি প্লেয়ারের পাশে থাকা <strong>"YouTube History সিঙ্ক"</strong> বাটনে ক্লিক করে সরাসরি YouTube-এ দেখতে পারবেন। অটো-নেক্সট অপশন চালু রাখলে পলকের মধ্যে পরবর্তী ভিডিও চলে আসবে।
              </p>
            </div>
          </div>

          {/* Rule 6: Exact View Target Guarantee */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-cyan-300">৬. নিখুঁত ভিউ কন্ট্রোল (১০ দিলে ঠিক ১০ বারই)</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                আপনি যে কয়টি ভিউ (যেমন ১০ ভিউ) নির্ধারণ করবেন, সিস্টেমে ঠিক ততবারই ভিউ প্রদান করা হবে। ১০ ভিউ দিলে নির্ধারিত ১০ বার সম্পন্ন হওয়ামাত্র ক্যাম্পেইন স্বয়ংক্রিয়ভাবে সমাপ্ত হবে—এর বেশি এক বারও হবে না।
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer shadow-md"
          >
            বুঝেছি, শুরু করুন
          </button>
        </div>
      </div>
    </div>
  );
};
