// Firebase configuration helper (for Firestore storage).
//
// 1) Create a Firebase project at https://console.firebase.google.com
// 2) Enable Firestore (database)
// 3) In Project Settings, add a Web App and copy the config below.
// 4) Replace the placeholder values in firebaseConfig.
// 5) In Firestore rules, for development you can use:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
//    (This allows any browser to read/write. For production, lock this down with auth.)

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collectionGroup,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Users collection helpers
const usersCol = collection(db, 'users');
const sessionsCol = collection(db, 'sessions');

export const listUsers = async (): Promise<Array<{ id: string }>> => {
  const snap = await getDocs(usersCol);
  return snap.docs.map(d => ({ id: d.data().id }));
};

export const getUserById = async (id: string) => {
  const q = query(usersCol, where('id', '==', id));
  const snap = await getDocs(q);
  return snap.docs[0]?.data();
};

export const createUser = async (id: string, passcode: string) => {
  const existing = await getUserById(id);
  if (existing) return false;
  await addDoc(usersCol, { id, passcode });
  return true;
};

export const deleteUser = async (id: string) => {
  const q = query(usersCol, where('id', '==', id));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  await deleteDoc(doc(db, 'users', snap.docs[0].id));
  return true;
};

export type StoredSession = {
  userId: string;
  sessionDate: string;
  entryTime: string | null;
  exitTime: string | null;
  greenSpeed: string | null;
  practices: any[];
  showAnalysis: boolean;
};

export const listSessions = async (userId: string): Promise<StoredSession[]> => {
  const q = query(sessionsCol, where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as StoredSession);
};

export const saveSession = async (session: StoredSession) => {
  // Use userId + sessionDate as doc id so we can overwrite.
  const id = `${session.userId}__${session.sessionDate}`;
  await setDoc(doc(db, 'sessions', id), session);
};

export const deleteSession = async (userId: string, sessionDate: string) => {
  const id = `${userId}__${sessionDate}`;
  await deleteDoc(doc(db, 'sessions', id));
};
