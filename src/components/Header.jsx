import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";

export default function Header({ currentPage }) {
  const { user } = useAuth();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div
        className="scroll-progress-bar"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />
      <header className="header">
        <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto">
          {/* Left: Logo */}
          <div className="flex items-center gap-4">
            {currentPage && (
              <>
                <div className="w-px h-8 bg-gray-200" />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-light)" }}>
                  {currentPage}
                </span>
              </>
            )}
          </div>

          {/* Right: User Info */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold" style={{ color: "var(--color-dark-serpent)" }}>
                  {user.displayName}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-light)" }}>
                  {user.email}
                </div>
              </div>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-12 h-12 rounded-full border-2"
                  style={{ borderColor: "var(--color-saffron)" }}
                />
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}

