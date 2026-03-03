import { createContext, useContext, useEffect, useState } from "react";
import { onAuthChange, signInWithGoogle, signOutUser } from "../firebase/firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Restore token from sessionStorage on page refresh
  // This is the key fix — onAuthStateChanged gives us the user
  // but NOT the OAuth token, so we persist it ourselves
  const [accessToken, setAccessToken] = useState(
    () => sessionStorage.getItem("driveAccessToken") || null
  );

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);

      // If user is gone (logged out / session expired)
      // clear the token too
      if (!firebaseUser) {
        setAccessToken(null);
        sessionStorage.removeItem("driveAccessToken");
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const { user, accessToken } = await signInWithGoogle();
      setUser(user);
      setAccessToken(accessToken);
    } catch (error) {
      console.error("Login failed:", error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}