'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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

  // Funzione per creare utenti come admin senza perdere la sessione corrente
  const createUserAsAdmin = async (email: string, password: string, name: string, role: UserRole, carriers?: string[]) => {
    // Salva l'utente attualmente autenticato
    const currentAuthUser = auth.currentUser;
    
    // Crea il nuovo utente
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

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

    // Fai logout del nuovo utente e riautentica l'admin
    await signOut(auth);
    
    if (currentAuthUser && userProfile) {
      // Re-autentica l'admin - qui dovrai passare la password dell'admin
      // Per ora facciamo un reload della pagina per ripristinare la sessione dell'admin
      window.location.reload();
    }
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