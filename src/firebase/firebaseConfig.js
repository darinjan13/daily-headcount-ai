import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "my-db-a308c.firebaseapp.com",
  databaseURL: "https://my-db-a308c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-db-a308c",
  storageBucket: "my-db-a308c.appspot.com",
  messagingSenderId: "1094014654145",
  appId: "1:1094014654145:web:73c3163d36c30616abe640"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
googleProvider.setCustomParameters({ prompt: "select_account" });

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential.accessToken;
  sessionStorage.setItem("driveAccessToken", accessToken);
  return { user: result.user, accessToken };
};

export const signOutUser = async () => {
  await signOut(auth);
  sessionStorage.removeItem("driveAccessToken");
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export default app;
