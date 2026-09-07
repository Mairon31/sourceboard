import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  type Auth,
} from "firebase/auth";

export interface FirebasePublicConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

let authInstance: Auth | null = null;

function getFirebaseAuth(config: FirebasePublicConfig): Auth {
  if (authInstance) return authInstance;
  const app = getApps().length ? getApp() : initializeApp(config);
  authInstance = getAuth(app);
  return authInstance;
}

export async function startGoogleSignIn(config: FirebasePublicConfig): Promise<void> {
  const auth = getFirebaseAuth(config);
  await signInWithRedirect(auth, new GoogleAuthProvider());
}

export async function completeGoogleSignIn(
  config: FirebasePublicConfig,
): Promise<{ idToken: string } | null> {
  const auth = getFirebaseAuth(config);
  const result = await getRedirectResult(auth);
  return result ? { idToken: await result.user.getIdToken() } : null;
}

export async function signOutFirebase(): Promise<void> {
  if (authInstance) await signOut(authInstance);
}

export function getGoogleAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "This email already uses another sign-in method. Sign in with email and password first.";
  }
  if (code === "auth/unauthorized-domain") {
    return "This site is not authorized in Firebase. Add srcboard.me to Firebase Authentication authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication.";
  }
  if (code === "auth/network-request-failed") {
    return "Firebase could not be reached. Check your connection and try again.";
  }
  return "Google sign-in could not be completed. Try again.";
}
