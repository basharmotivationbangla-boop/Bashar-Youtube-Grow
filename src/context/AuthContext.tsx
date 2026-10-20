import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, ensureUserProfile, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  updateUserCredits: (newCredits: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);

          // Listen real-time to credit changes
          const userDocRef = doc(db, 'users', user.uid);
          unsubscribeDoc = onSnapshot(
            userDocRef,
            (docSnap) => {
              if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
              }
            },
            (error) => {
              handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
            }
          );
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setFirebaseUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const updateUserCredits = (newCredits: number) => {
    setUserProfile((prev) => (prev ? { ...prev, credits: newCredits } : null));
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
