'use client';

import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  organizationId: string | null;
  role: 'ADMIN' | 'STUDENT' | null;
  semesterId: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    organizationId: null,
    role: null,
    semesterId: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth!, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db!, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setState({
            user: firebaseUser,
            loading: false,
            organizationId: data.organizationId ?? null,
            role: data.role ?? null,
            semesterId: data.semesterId ?? null,
          });
        } else {
          setState({
            user: firebaseUser,
            loading: false,
            organizationId: null,
            role: null,
            semesterId: null,
          });
        }
      } else {
        setState({
          user: null,
          loading: false,
          organizationId: null,
          role: null,
          semesterId: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    return signInWithEmailAndPassword(auth!, email, password);
  }

  async function signOut() {
    return firebaseSignOut(auth!);
  }

  return { ...state, signIn, signOut };
}
