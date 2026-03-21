'use client';

import React, { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  organizationId: string | null;
  role: 'ADMIN' | 'STUDENT' | null;
  semesterId: string | null;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  organizationId: null,
  role: null,
  semesterId: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
