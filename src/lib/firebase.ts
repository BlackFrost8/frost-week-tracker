import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';
import { firebaseConfig } from './firebase-config';

/**
 * Config comes from `firebase-config.ts`, with an optional environment
 * override for CI. There is deliberately no in-app "connect your database"
 * form any more — asking someone to paste a project URL and an API key into a
 * dialog before they can log in was the whole complaint.
 *
 * `firestore/lite` rather than the full SDK: this app loads a week on
 * navigation and writes on a 300ms debounce. It has no use for realtime
 * listeners or offline persistence, which is most of the full client's weight.
 */
const env = import.meta.env;

/* `||`, not `??`. An empty string is not nullish, so `??` treated a blank
   environment variable as a deliberate value and kept it — meaning anyone who
   forked this and copied `.env.example` verbatim (every key present, every
   value empty) got six empty strings, silently lost sign-in, and had the app
   quietly fall back to this-device-only with nothing explaining why. An unset
   value and a blank value mean the same thing here: use the committed config. */
const resolved = {
  apiKey: (env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '').trim(),
  messagingSenderId: (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseConfig.messagingSenderId ||
    ''
  ).trim(),
  appId: (env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '').trim(),
};

const configured = resolved.apiKey !== '' && resolved.projectId !== '';

export const app: FirebaseApp | null = configured ? initializeApp(resolved) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

export const isCloudConfigured = configured;
