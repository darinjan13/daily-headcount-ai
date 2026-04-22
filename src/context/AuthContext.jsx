import { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthChange, signInWithGoogle, signOutUser } from "../firebase/firebaseConfig";
import { db } from "../firebase/firebaseConfig";

const AuthContext = createContext(null);
const BOOTSTRAP_ADMIN_EMAILS = ["darinjan13@gmail.com"];

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}

async function resolveAdminStatus(firebaseUser) {
  const email = normalizeEmail(firebaseUser?.email);
  if (!email) return false;

  const adminDocRef = doc(db, "admins", email);

  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    try {
      await setDoc(adminDocRef, {
        email,
        role: "admin",
        active: true,
        bootstrapped: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.warn("[auth] Failed to seed bootstrap admin doc:", error.message);
    }
  }

  try {
    const adminSnap = await getDoc(adminDocRef);
    if (!adminSnap.exists()) return false;
    const data = adminSnap.data();
    return data.active !== false && data.role === "admin";
  } catch (error) {
    console.warn("[auth] Failed to load admin status from Firestore:", error.message);
    return BOOTSTRAP_ADMIN_EMAILS.includes(email);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Restore token from sessionStorage on page refresh
  // This is the key fix — onAuthStateChanged gives us the user
  // but NOT the OAuth token, so we persist it ourselves
  const [accessToken, setAccessToken] = useState(
    () => sessionStorage.getItem("driveAccessToken") || null
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const loginInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);

      // If user is gone (logged out / session expired)
      // clear the token too
      if (!firebaseUser) {
        setAccessToken(null);
        sessionStorage.removeItem("driveAccessToken");
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const storedToken = sessionStorage.getItem("driveAccessToken");
      if (!storedToken) {
        if (loginInProgressRef.current) return;
        console.warn("[auth] Missing Drive access token. Forcing re-login.");
        await signOutUser();
        setUser(null);
        setAccessToken(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(await resolveAdminStatus(firebaseUser));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      loginInProgressRef.current = true;
      setLoading(true);
      const { user, accessToken } = await signInWithGoogle();
      setUser(user);
      setAccessToken(accessToken);
      setIsAdmin(await resolveAdminStatus(user));
      loginInProgressRef.current = false;
      setLoading(false);
    } catch (error) {
      loginInProgressRef.current = false;
      setLoading(false);
      console.error("Login failed:", error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
      setAccessToken(null);
      setIsAdmin(false);
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
