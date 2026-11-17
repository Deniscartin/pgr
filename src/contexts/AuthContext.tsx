'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import app, { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/lib/types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (email: string, password: string, name: string, role: UserRole, carriers?: string[]) => Promise<void>;
  createUserAsAdmin: (email: string, password: string, name: string, role: UserRole, carriers?: string[]) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile({
            id: user.uid,
            email: user.email!,
            name: userData.name,
            role: userData.role,
            carriers: userData.carriers || (userData.carrier ? [userData.carrier] : undefined),
            qrCode: userData.qrCode,
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date(),
          });
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const createUser = async (email: string, password: string, name: string, role: UserRole, carriers?: string[]) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user profile in Firestore
    const userData: any = {
      name,
      role,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (carriers && carriers.length > 0) {
      userData.carriers = carriers;
    }
    
    await setDoc(doc(db, 'users', user.uid), userData);
  };

  // Crea utenti come admin senza perdere la sessione corrente: l'account viene creato
  // su un'istanza Firebase secondaria, il profilo viene scritto con la sessione dell'admin
  // (le regole Firestore permettono solo agli admin di creare profili).
  const createUserAsAdmin = async (email: string, password: string, name: string, role: UserRole, carriers?: string[]) => {
    const secondaryApp = getApps().find((a) => a.name === 'userCreation') ?? initializeApp(app.options, 'userCreation');
    const secondaryAuth = getAuth(secondaryApp);

    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;
    await signOut(secondaryAuth);

    // Create user profile in Firestore
    const userData: any = {
      name,
      role,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (carriers && carriers.length > 0) {
      userData.carriers = carriers;
    }
    
    await setDoc(doc(db, 'users', newUser.uid), userData);
  };

  const refreshUserProfile = async () => {
    if (currentUser) {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          id: currentUser.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          carriers: userData.carriers || (userData.carrier ? [userData.carrier] : undefined),
          qrCode: userData.qrCode,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        });
      }
    }
  };

  const value = {
    currentUser,
    userProfile,
    login,
    logout,
    createUser,
    createUserAsAdmin,
    refreshUserProfile,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 