import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

export const googleAuthProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  googleAuthProvider.addScope(scope);
}

// Strictly in-memory OAuth access token cache (never localStorage or sessionStorage)
let cachedDriveAccessToken: string | null = null;

export function clearCachedDriveToken(): void {
  cachedDriveAccessToken = null;
}

export function getCachedDriveToken(): string | null {
  return cachedDriveAccessToken;
}

export async function signInWithGoogleAndCacheDriveToken(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedDriveAccessToken = credential?.accessToken ?? null;
  return { user: result.user, accessToken: cachedDriveAccessToken };
}

export async function requestDriveAccessToken(): Promise<string> {
  if (cachedDriveAccessToken) {
    return cachedDriveAccessToken;
  }
  const { accessToken } = await signInWithGoogleAndCacheDriveToken();
  if (!accessToken) {
    throw new Error('لم يتم الحصول على صلاحية الوصول إلى Google Drive. يرجى المحاولة مرة أخرى.');
  }
  return accessToken;
}
