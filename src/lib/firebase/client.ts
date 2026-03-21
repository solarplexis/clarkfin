"use client";

import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { getPublicFirebaseConfig } from "@/src/lib/env";

export function getFirebaseClientApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getPublicFirebaseConfig());
}

export function getClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function getClientDb() {
  return getFirestore(getFirebaseClientApp());
}
