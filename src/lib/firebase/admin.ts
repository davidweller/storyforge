import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;

function getAdminApp(): App {
  if (getApps().length === 0) {
    const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'demo-storyforge';

    // When using the Firebase Emulator Suite, credentials are not required
    if (useEmulator) {
      adminApp = initializeApp({ projectId });
      return adminApp;
    }

    // Production: require full credentials
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (privateKey) {
      privateKey = privateKey.replace(/^["']|["']$/g, '');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Firebase Admin Config Check:', {
        hasProjectId: !!projectId,
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey,
        privateKeyLength: privateKey?.length || 0,
        privateKeyStart: privateKey?.substring(0, 30) || 'N/A',
      });
    }

    if (
      !projectId ||
      !clientEmail ||
      !privateKey ||
      privateKey.includes('YOUR_PRIVATE_KEY') ||
      privateKey.trim().length < 50
    ) {
      throw new Error(
        'Firebase Admin credentials not configured. Please set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in your environment variables.'
      );
    }

    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your FIREBASE_ADMIN_PRIVATE_KEY is correctly formatted.`
      );
    }
  } else {
    adminApp = getApps()[0];
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export { adminApp, adminDb, adminAuth };
