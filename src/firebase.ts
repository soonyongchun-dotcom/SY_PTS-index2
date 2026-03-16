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

import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  enableIndexedDbPersistence,
  FirestoreDataConverter,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCAoRE0tu8asTVOiKOJvkswBvjR6e2DCm4",
  authDomain: "sy-puttingtraining.firebaseapp.com",
  projectId: "sy-puttingtraining",
  storageBucket: "sy-puttingtraining.firebasestorage.app",
  messagingSenderId: "381426792057",
  appId: "1:381426792057:web:39a4d494d163a09d3c46a8",
  measurementId: "G-PGCCC5DMTZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make sure we have an authenticated user (anonymous) so Firestore security rules can apply.
// This is required because rules now require request.auth != null.
const auth = getAuth(app);
signInAnonymously(auth).catch(() => {
  // ignore - app can continue even if anonymous sign-in fails
});

// Enable offline persistence when possible (reduces errors when network is unstable).
// If persistence cannot be enabled, we ignore the error and continue.
enableIndexedDbPersistence(db).catch(() => {
  // ignore - persistence is optional
});

export interface StoredSession {
  userId: string;
  sessionDate: string;
  entryTime: string | null;
  exitTime: string | null;
  greenSpeed: string | null;
  practices: any[];
  showAnalysis: boolean;
}

export interface StoredUser {
  id: string;
  passcode: string;
}

const usersCollection = () => collection(db, "users");
const userSessionsCollection = (userId: string) => collection(db, "users", userId, "sessions");

const sessionDocId = (sessionDate: string) =>
  sessionDate.replace(/[\\/\\\\#\?\s]/g, "_");

const storedSessionConverter: FirestoreDataConverter<StoredSession> = {
  toFirestore(session: StoredSession) {
    return {
      ...session,
    };
  },
  fromFirestore(snapshot) {
    const data = snapshot.data();
    return {
      userId: data.userId,
      sessionDate: data.sessionDate,
      entryTime: data.entryTime ?? null,
      exitTime: data.exitTime ?? null,
      greenSpeed: data.greenSpeed ?? null,
      practices: Array.isArray(data.practices) ? data.practices : [],
      showAnalysis: !!data.showAnalysis,
    };
  },
};

/**
 * Create a new user. Returns true if created successfully, false if already exists.
 */
export async function createUser(id: string, passcode: string): Promise<boolean> {
  try {
    const userDoc = doc(usersCollection(), id);
    const snapshot = await getDoc(userDoc);
    if (snapshot.exists()) {
      return false;
    }
    await setDoc(userDoc, { id, passcode });
    return true;
  } catch (e) {
    console.error("Firestore createUser failed", e);
    throw new Error("사용자 등록 중 오류가 발생했습니다. 콘솔을 확인하세요.");
  }
}

/**
 * Delete a user and their sessions.
 */
export async function deleteUser(id: string): Promise<boolean> {
  const userDoc = doc(usersCollection(), id);
  const snapshot = await getDoc(userDoc);
  if (!snapshot.exists()) {
    return false;
  }

  // delete user sessions (best-effort)
  const sessionsSnap = await getDocs(userSessionsCollection(id));
  await Promise.all(
    sessionsSnap.docs.map(s => deleteDoc(doc(userSessionsCollection(id), s.id)))
  );

  await deleteDoc(userDoc);
  return true;
}

/**
 * Get a user by id.
 */
export async function getUserById(id: string): Promise<StoredUser | null> {
  try {
    const userDoc = doc(usersCollection(), id);
    const snapshot = await getDoc(userDoc);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return { id: data.id, passcode: data.passcode };
  } catch (e) {
    console.warn("Firestore getUserById failed", e);
    return null;
  }
}

/**
 * List all users.
 */
export async function listUsers(): Promise<StoredUser[]> {
  try {
    const snapshot = await getDocs(usersCollection());
    return snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return { id: data.id, passcode: data.passcode };
    });
  } catch (e) {
    console.warn("Firestore listUsers failed", e);
    return [];
  }
}

/**
 * Save or update a session entry.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  const docRef = doc(userSessionsCollection(session.userId), sessionDocId(session.sessionDate)).withConverter(
    storedSessionConverter
  );
  await setDoc(docRef, session);
}

/**
 * List all sessions for a user.
 */
export async function listSessions(userId: string): Promise<StoredSession[]> {
  try {
    const sessionsRef = userSessionsCollection(userId).withConverter(storedSessionConverter);
    const snapshot = await getDocs(sessionsRef);
    return snapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.warn("Firestore listSessions failed", e);
    return [];
  }
}

/**
 * Delete a specific session for a user.
 */
export async function deleteSession(userId: string, sessionDate: string): Promise<void> {
  const docRef = doc(userSessionsCollection(userId), sessionDocId(sessionDate));
  await deleteDoc(docRef);
}

export { db };

