export const DURATION_PRESETS: { seconds: number; label: string }[] = [
  { seconds: 30, label: '৩০ সে.' },
  { seconds: 45, label: '৪৫ সে.' },
  { seconds: 60, label: '৬০ সে. (১ মিনিট)' },
  { seconds: 120, label: '১২০ সে. (২ মিনিট)' },
  { seconds: 180, label: '১৮০ সে. (৩ মিনিট)' },
  { seconds: 300, label: '৩০০ সে. (৫ মিনিট)' },
  { seconds: 600, label: '৬০০ সে. (১০ মিনিট)' },
];

export const VIEW_PRESETS = [5, 10, 20, 50, 100, 500, 1000];

export const WELCOME_CREDITS = 500;
export const REFERRAL_REWARD_CREDITS = 1000;

export const DAILY_CHECKIN_REWARDS = [
  { day: 1, credits: 20, label: 'দিন ১' },
  { day: 2, credits: 30, label: 'দিন ২' },
  { day: 3, credits: 40, label: 'দিন ৩' },
  { day: 4, credits: 50, label: 'দিন ৪' },
  { day: 5, credits: 60, label: 'দিন ৫' },
  { day: 6, credits: 80, label: 'দিন ৬' },
  { day: 7, credits: 100, label: 'দিন ৭ (মেগা)' },
];

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  credits: number;
  referredBy?: string;
  lastCheckInDate?: string; // Format YYYY-MM-DD
  checkInStreak?: number;   // 1 to 7
  createdAt: string;
  updatedAt?: string;
}

export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface VideoCampaign {
  id: string;
  userId: string;
  creatorEmail: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  targetSeconds: number; // Freely chosen custom seconds (>=5s)
  costPerView: number;   // 1 credit per second
  targetViews: number;   // Freely chosen custom views (>=1)
  completedViews: number;
  status: CampaignStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ViewRecord {
  id: string;
  userId: string;
  campaignId: string;
  videoId: string;
  secondsWatched: number;
  creditsEarned: number;
  createdAt: string;
}

export type TransactionType = 'bonus' | 'view_reward' | 'campaign_created' | 'campaign_refund' | 'checkin_reward' | 'referral_reward';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  referredUserId: string;
  referredUserName: string;
  rewardCredits: number;
  status: 'pending' | 'claimed';
  createdAt: string;
  claimedAt?: string;
}

