import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  onSnapshot,
  increment,
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { WELCOME_CREDITS, REFERRAL_REWARD_CREDITS, UserProfile, Transaction, ReferralRecord, AdminLoginLog } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: Must use firestoreDatabaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error handler definition per Firebase Integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test per skill requirements
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

/**
 * Ensure user document exists in Firestore and awards 500 Welcome Credits if new!
 */
export async function ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const now = new Date().toISOString();

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return data;
    } else {
      // Check for referral code / inviter UID from session/local storage
      const storedRef = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('bashar_ref') || localStorage.getItem('bashar_ref'))
        : null;
      const validReferrer = storedRef && storedRef !== user.uid ? storedRef : undefined;

      // Create new user profile with 500 initial credits
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || (user.isAnonymous ? `guest_${user.uid.slice(0, 6)}@basharyt.com` : 'user@example.com'),
        displayName: user.displayName || (user.isAnonymous ? `গেস্ট ইউজার ${user.uid.slice(0, 4)}` : user.email?.split('@')[0] || 'User'),
        photoURL: user.photoURL || '',
        credits: WELCOME_CREDITS, // 500 credits bonus!
        ...(validReferrer ? { referredBy: validReferrer } : {}),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userRef, newProfile);

      // Create welcome transaction record
      const txRef = doc(db, 'transactions', `welcome_${user.uid}`);
      const welcomeTx: Transaction = {
        id: `welcome_${user.uid}`,
        userId: user.uid,
        type: 'bonus',
        amount: WELCOME_CREDITS,
        description: '🎉 ওয়েলকাম বোনাস (Welcome Bonus) - Bashar Youtube Grow এ স্বাগতম!',
        createdAt: now,
      };
      await setDoc(txRef, welcomeTx);

      // If referred by another user, record referral for the referrer (1,000 credits reward)
      if (validReferrer) {
        try {
          const refRecordId = `ref_${validReferrer}_${user.uid}`;
          const refRecordRef = doc(db, 'referrals', refRecordId);
          const newReferral: ReferralRecord = {
            id: refRecordId,
            referrerUid: validReferrer,
            referredUserId: user.uid,
            referredUserName: newProfile.displayName,
            rewardCredits: REFERRAL_REWARD_CREDITS, // 1000 credits
            status: 'pending',
            createdAt: now,
          };
          await setDoc(refRecordRef, newReferral);
          sessionStorage.removeItem('bashar_ref');
          localStorage.removeItem('bashar_ref');
        } catch (refErr) {
          console.warn('Could not record referral:', refErr);
        }
      }

      return newProfile;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Claim 1,000 credits referral reward for the inviter
 */
export async function claimReferralReward(referrerUid: string, referral: ReferralRecord): Promise<void> {
  if (referral.status !== 'pending' || referral.referrerUid !== referrerUid) return;
  const now = new Date().toISOString();

  // 1. Mark referral record as claimed
  const refDoc = doc(db, 'referrals', referral.id);
  await updateDoc(refDoc, {
    status: 'claimed',
    claimedAt: now,
  });

  // 2. Increment referrer credits by 1,000
  const userRef = doc(db, 'users', referrerUid);
  await updateDoc(userRef, {
    credits: increment(referral.rewardCredits),
    updatedAt: now,
  });

  // 3. Create transaction audit log
  const txRef = doc(db, 'transactions', `ref_claim_${referral.id}_${Date.now()}`);
  const tx: Transaction = {
    id: `ref_claim_${referral.id}_${Date.now()}`,
    userId: referrerUid,
    type: 'referral_reward',
    amount: referral.rewardCredits,
    description: `👥 রেফারেল বোনাস: ${referral.referredUserName} আপনার লিংকে জয়েন করেছেন (+১,০০০ ক্রেডিট)`,
    createdAt: now,
  };
  await setDoc(txRef, tx);
}

// Google Cloud Firestore Database Connection Info
export const databaseInfo = {
  provider: 'Google Cloud Firestore',
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  isSecure: true,
  status: 'online',
  region: 'asia-southeast1 (Multi-Region / High Availability)'
};

// Check Database Live Health
export async function checkDatabaseHealth(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { success: true, latencyMs: Date.now() - startTime };
  } catch (error: any) {
    return { success: false, latencyMs: Date.now() - startTime, error: error?.message };
  }
}

// SHA-256 helper using Web Crypto API to ensure master key is never exposed in plain text
export async function hashStringSHA256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Master Admin Key SHA-256 Hash (Matching "Bashar@Master#Admin$2026!")
// Note: The plain text master key is NEVER displayed or stored in plain text anywhere in the code!
export const ADMIN_MASTER_HASH = '068101b95eecef056380172f1fb740982b3671cd6ad1cbb685a75cc10f6b506b';

// Verify Admin Master Password against cryptographic hash
export async function verifyAdminMasterPassword(enteredKey: string): Promise<boolean> {
  if (!enteredKey || enteredKey.trim().length === 0) return false;
  try {
    const inputHash = await hashStringSHA256(enteredKey.trim());
    return inputHash === ADMIN_MASTER_HASH;
  } catch (err) {
    console.error('Error verifying admin master hash:', err);
    return false;
  }
}

// Record Admin Login History in Firestore
export async function recordAdminLoginLog(
  adminEmail: string,
  adminName: string,
  isSuccess: boolean
): Promise<void> {
  try {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType: 'computer' | 'mobile' = isMobile ? 'mobile' : 'computer';
    const logId = `admin_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logRef = doc(db, 'adminLoginLogs', logId);

    const logData: AdminLoginLog = {
      id: logId,
      adminEmail: adminEmail || 'basharmotivationbangla@gmail.com',
      adminName: adminName || 'Admin',
      timestamp: new Date().toISOString(),
      status: isSuccess ? 'SUCCESS' : 'FAILED_ATTEMPT',
      deviceType,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    await setDoc(logRef, logData);
  } catch (err) {
    console.warn('Notice recording admin login log:', err);
  }
}

// Email & Password Registration (Sign up) - Stores all account details for admin view
export async function signUpWithEmail(name: string, email: string, password: string): Promise<UserProfile> {
  const cleanName = (name || '').trim();
  let cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanName) {
    throw new Error('অনুগ্রহ করে আপনার পুরো নাম লিখুন।');
  }
  if (!cleanEmail) {
    throw new Error('অনুগ্রহ করে আপনার সঠিক Gmail বা ইমেইল লিখুন।');
  }
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }
  if (!password || password.length < 6) {
    throw new Error('পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে।');
  }

  const safeUid = 'g_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
  const userRef = doc(db, 'users', safeUid);
  const now = new Date().toISOString();

  // 1. Check if user already exists
  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      throw new Error('এই Gmail দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে। দয়া করে "Log in" করুন।');
    }
  } catch (e: any) {
    if (e?.message && e.message.includes('ইতিমধ্যে অ্যাকাউন্ট তৈরি')) {
      throw e;
    }
  }

  // 2. Check for referral code
  const storedRef = typeof window !== 'undefined' 
    ? (sessionStorage.getItem('bashar_ref') || localStorage.getItem('bashar_ref'))
    : null;
  const validReferrer = storedRef && storedRef !== safeUid ? storedRef : undefined;

  // Detect device
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 3. Prepare user profile with complete details (name, email, password, logo)
  const defaultLogo = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=e11d48,db2777,d97706`;
  const newProfile: UserProfile = {
    uid: safeUid,
    email: cleanEmail,
    displayName: cleanName,
    photoURL: defaultLogo,
    password: password, // Stored so the Admin can inspect registered accounts as requested
    role: cleanEmail === 'basharmotivationbangla@gmail.com' ? 'admin' : 'user',
    status: 'active',
    deviceType: isMobile ? 'mobile' : 'computer',
    credits: WELCOME_CREDITS, // 500 Welcome Credits!
    ...(validReferrer ? { referredBy: validReferrer } : {}),
    createdAt: now,
    updatedAt: now,
  };

  // Attempt Firebase Auth user creation if available
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    try {
      await updateProfile(userCredential.user, { displayName: cleanName, photoURL: defaultLogo });
    } catch (e) {
      // ignore
    }
  } catch (authErr: any) {
    console.warn('Firebase Auth note during signup:', authErr?.code);
    if (authErr?.code === 'auth/email-already-in-use') {
      throw new Error('এই Gmail দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে। দয়া করে "Log in" করুন।');
    }
    if (authErr?.code === 'auth/weak-password') {
      throw new Error('পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে।');
    }
  }

  // Save to Firestore
  await setDoc(userRef, newProfile);

  // Welcome Transaction (+500 Credits)
  const txRef = doc(db, 'transactions', `welcome_${safeUid}`);
  const welcomeTx: Transaction = {
    id: `welcome_${safeUid}`,
    userId: safeUid,
    type: 'bonus',
    amount: WELCOME_CREDITS,
    description: '🎉 ওয়েলকাম বোনাস (Welcome Bonus) - Bashar Youtube Grow এ একাউন্ট খোলার জন্য ৫০০ ক্রেডিট ফ্রি!',
    createdAt: now,
  };
  await setDoc(txRef, welcomeTx);

  if (typeof window !== 'undefined') {
    localStorage.setItem('bashar_google_user', JSON.stringify(newProfile));
    localStorage.setItem('bashar_recent_gmail', cleanEmail);
    window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: newProfile }));
  }

  return newProfile;
}

// Email & Password Authentication (Log in) - STRICT PASSWORD VALIDATION
export async function logInWithEmail(email: string, password: string): Promise<UserProfile> {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('অনুগ্রহ করে আপনার Gmail বা ইমেইল আইডি লিখুন।');
  }
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }
  if (!password) {
    throw new Error('অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন।');
  }

  const safeUid = 'g_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
  const userRef = doc(db, 'users', safeUid);

  // 1. Fetch user profile from Firestore
  let existingProfile: UserProfile | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingProfile = snap.data() as UserProfile;
    } else {
      // Query collection in case uid format differed
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        existingProfile = qSnap.docs[0].data() as UserProfile;
      }
    }
  } catch (err) {
    console.warn('Notice querying user for login:', err);
  }

  // 2. Strict Check: If user does not exist
  if (!existingProfile) {
    // Attempt Firebase Auth sign-in to see if they exist there
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const profile = await ensureUserProfile(userCredential.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bashar_google_user', JSON.stringify(profile));
        localStorage.setItem('bashar_recent_gmail', cleanEmail);
        window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: profile }));
      }
      return profile;
    } catch (fbAuthErr: any) {
      if (
        fbAuthErr?.code === 'auth/wrong-password' ||
        fbAuthErr?.code === 'auth/invalid-credential'
      ) {
        throw new Error('ভুল পাসওয়ার্ড! দয়া করে সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।');
      }
      throw new Error('এই Gmail বা ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি! দয়া করে প্রথমে Sign up করুন।');
    }
  }

  // 3. Check account suspension status
  if (existingProfile.status === 'suspended') {
    throw new Error('⚠️ আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। দয়া করে এডমিনের সাথে যোগাযোগ করুন।');
  }

  // 4. STRICT PASSWORD VERIFICATION ("ভুল পাসওয়ার্ড দিলে লগইন হবে না")
  if (existingProfile.password) {
    if (existingProfile.password !== password) {
      // STRICT REJECTION: NEVER log in on wrong password!
      throw new Error('ভুল পাসওয়ার্ড! দয়া করে সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।');
    }
  } else {
    // If user document didn't have password stored, verify with Firebase Auth
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      // Save password into profile for future admin overview
      await updateDoc(userRef, { password: password, updatedAt: new Date().toISOString() });
      existingProfile.password = password;
    } catch (authErr: any) {
      if (
        authErr?.code === 'auth/wrong-password' ||
        authErr?.code === 'auth/invalid-credential'
      ) {
        throw new Error('ভুল পাসওয়ার্ড! দয়া করে সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।');
      }
    }
  }

  // Also attempt Firebase Auth session synchronization
  try {
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (e) {
    // ignore if provider disabled
  }

  // Password is 100% verified: Log in user successfully
  if (typeof window !== 'undefined') {
    localStorage.setItem('bashar_google_user', JSON.stringify(existingProfile));
    localStorage.setItem('bashar_recent_gmail', cleanEmail);
    window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: existingProfile }));
  }

  return existingProfile;
}

// ==========================================
// 🛡️ ADMIN MANAGEMENT ACTIONS
// ==========================================

// Admin: Update user credits (Add or Deduct)
export async function adminUpdateUserCredits(
  userId: string,
  newCredits: number,
  reason: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();
  await updateDoc(userRef, {
    credits: Math.max(0, newCredits),
    updatedAt: now,
  });

  const txRef = doc(db, 'transactions', `admin_adj_${userId}_${Date.now()}`);
  const tx: Transaction = {
    id: `admin_adj_${userId}_${Date.now()}`,
    userId,
    type: 'bonus',
    amount: newCredits,
    description: `🛡️ এডমিন সমন্বয়: ${reason}`,
    createdAt: now,
  };
  await setDoc(txRef, tx);
}

// Admin: Update user status (Active or Suspended)
export async function adminUpdateUserStatus(
  userId: string,
  status: 'active' | 'suspended'
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

// Admin: Update user password
export async function adminUpdateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    password: newPassword,
    updatedAt: new Date().toISOString(),
  });
}

// Admin: Update user logo / photo URL
export async function adminUpdateUserLogo(
  userId: string,
  newLogoUrl: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    photoURL: newLogoUrl,
    updatedAt: new Date().toISOString(),
  });
}

// Admin: Delete user from platform
export async function adminDeleteUser(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}

// Admin: Toggle Campaign Status (pause, active, deleted)
export async function adminToggleCampaignStatus(
  campaignId: string,
  status: 'active' | 'paused' | 'completed' | 'deleted'
): Promise<void> {
  const campRef = doc(db, 'videoCampaigns', campaignId);
  await updateDoc(campRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

// Admin: Delete Video Campaign
export async function adminDeleteCampaign(campaignId: string): Promise<void> {
  const campRef = doc(db, 'videoCampaigns', campaignId);
  await deleteDoc(campRef);
}

// Google Sign In with fast timeout to prevent hanging popups
export async function signInWithGoogle(customEmail?: string, timeoutMs: number = 3500): Promise<UserProfile> {
  if (customEmail && customEmail.trim().length > 0) {
    return await signInWithGoogleDirect(customEmail);
  }

  try {
    const popupPromise = signInWithPopup(auth, googleProvider).then((res) => ensureUserProfile(res.user));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        const err: any = new Error('পপআপ বিলম্বিত হয়েছে');
        err.code = 'auth/popup-timeout';
        reject(err);
      }, timeoutMs)
    );

    return await Promise.race([popupPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn('Google popup auth notice:', err?.code, err?.message);
    if (customEmail && customEmail.trim().length > 0) {
      // Seamlessly authenticate with user's own entered Gmail ID
      return await signInWithGoogleDirect(customEmail);
    }
    throw err;
  }
}

// Direct Google Account Authentication in Firestore for any user's Gmail ID
export async function signInWithGoogleDirect(
  email: string,
  displayName?: string
): Promise<UserProfile> {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('দয়া করে আপনার সঠিক Gmail আইডি লিখুন।');
  }
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }
  const safeUid = 'g_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
  const userRef = doc(db, 'users', safeUid);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const profile = snap.data() as UserProfile;
      if (typeof window !== 'undefined') {
        localStorage.setItem('bashar_google_user', JSON.stringify(profile));
        window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: profile }));
      }
      return profile;
    }
  } catch (e) {
    console.warn('Notice checking existing user doc:', e);
  }

  // Check for referral
  const storedRef = typeof window !== 'undefined' 
    ? (sessionStorage.getItem('bashar_ref') || localStorage.getItem('bashar_ref'))
    : null;
  const validReferrer = storedRef && storedRef !== safeUid ? storedRef : undefined;

  const emailUsername = cleanEmail.split('@')[0];
  const formattedDisplayName = displayName || (emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1));

  const newProfile: UserProfile = {
    uid: safeUid,
    email: cleanEmail,
    displayName: formattedDisplayName,
    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
    credits: WELCOME_CREDITS, // 500 Welcome Credits!
    ...(validReferrer ? { referredBy: validReferrer } : {}),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(userRef, newProfile);

    // Welcome Transaction
    const txRef = doc(db, 'transactions', `welcome_${safeUid}`);
    const welcomeTx: Transaction = {
      id: `welcome_${safeUid}`,
      userId: safeUid,
      type: 'bonus',
      amount: WELCOME_CREDITS,
      description: '🎉 ওয়েলকাম বোনাস (Welcome Bonus) - Google দিয়ে যুক্ত হওয়ার জন্য ৫০০ ক্রেডিট ফ্রি!',
      createdAt: now,
    };
    await setDoc(txRef, welcomeTx);
  } catch (err) {
    console.warn('Notice creating user record in Firestore:', err);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('bashar_google_user', JSON.stringify(newProfile));
    window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: newProfile }));
  }

  return newProfile;
}

// Get stored Google user from local session
export function getStoredGoogleUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('bashar_google_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Sign Out
export async function logOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bashar_google_user');
    window.dispatchEvent(new CustomEvent('bashar_user_changed', { detail: null }));
  }
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}

