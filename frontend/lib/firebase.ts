import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Botrow Firebase Project — botrow-6b6c9
const firebaseConfig = {
  apiKey: "AIzaSyBZ_TDrFSc55XK9bjsxUHk-2TCyKMH6qTU",
  authDomain: "botrow-6b6c9.firebaseapp.com",
  projectId: "botrow-6b6c9",
  storageBucket: "botrow-6b6c9.firebasestorage.app",
  messagingSenderId: "267484332843",
  appId: "1:267484332843:web:769b75194698b5e67dbb6e",
  measurementId: "G-PSKP5H6PZT",
};

// Prevent duplicate Firebase app initialization during Next.js hot reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics only runs in the browser — never during SSR/Node.js build
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);

export default app;
