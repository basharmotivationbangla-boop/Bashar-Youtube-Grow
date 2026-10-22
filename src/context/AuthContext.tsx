import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, ensureUserProfile, getStoredGoogleUser, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  updateUserCredits: (newCredits: number) => void;
  setUserProfileDirect: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getStoredGoogleUser());
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const setupUserListener = (uid: string) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      const userDocRef = doc(db, 'users', uid);
      unsubscribeDoc = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        },
        (error) => {
          console.warn('Notice listening to user profile:', error?.message);
        }
      );
    };

    // If already stored Google user
    const existing = getStoredGoogleUser();
    if (existing?.uid) {
      setUserProfile(existing);
      setupUserListener(existing.uid);
    }

    // Listen to Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);
          setupUserListener(user.uid);
        } catch (err) {
          console.warn('Notice fetching user profile from auth:', err);
        }
      } else {
        const stored = getStoredGoogleUser();
        if (!stored) {
          if (unsubscribeDoc) {
            unsubscribeDoc();
            unsubscribeDoc = null;
          }
          setFirebaseUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    // Custom event listener when user signs in via direct Google profile
    const handleGoogleUserChanged = (e: any) => {
      const profile = e.detail as UserProfile | null;
      if (profile) {
        setUserProfile(profile);
        setupUserListener(profile.uid);
      } else {
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setUserProfile(null);
      }
    };

    window.addEventListener('bashar_user_changed', handleGoogleUserChanged);

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
      window.removeEventListener('bashar_user_changed', handleGoogleUserChanged);
    };
  }, []);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const updateUserCredits = (newCredits: number) => {
    setUserProfile((prev) => (prev ? { ...prev, credits: newCredits } : null));
  };

  const setUserProfileDirect = (profile: UserProfile | null) => {
    setUserProfile(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        updateUserCredits,
        setUserProfileDirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
