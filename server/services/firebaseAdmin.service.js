// Route modules are evaluated before index.js runs dotenv.config(). Loading
// dotenv here ensures Firebase Admin always receives server/.env credentials.
import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

export const verifyFirebaseIdToken = async (idToken) => {
  if (!getApps().length) {
    throw new Error("Firebase Admin is not configured on the server.");
  }
  return getAuth().verifyIdToken(idToken);
};

