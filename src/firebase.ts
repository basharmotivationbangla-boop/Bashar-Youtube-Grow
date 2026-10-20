import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  increment,
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { WELCOME_CREDITS, REFERRAL_REWARD_CREDITS, UserProfile, Transaction, ReferralRecord } from './types';

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
        email: user.email || 'user@example.com',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
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

// Google Sign In
export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  return await ensureUserProfile(result.user);
}

// Email Sign Up
export async function signUpWithEmail(email: string, pass: string, displayName: string): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return await ensureUserProfile(cred.user);
}

// Email Sign In
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return await ensureUserProfile(cred.user);
}

// Sign Out
export async function logOut(): Promise<void> {
  await signOut(auth);
}
