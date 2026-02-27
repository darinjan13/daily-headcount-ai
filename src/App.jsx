import { useEffect, useMemo, useState } from "react";
import ExcelUploader from "./components/ExcelUploader";
import Dashboard from "./components/Dashboard";
import lifewoodIconText from "./assets/branding/lifewood-icon-text.png";

function App() {
  const [data, setData] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection] = useState("summary");

  // Scroll progress tracking
  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? (scrollTop / max) * 100 : 0;
      setScrollProgress(pct);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // (Nav highlight observer removed; keeping simple static nav)

  const navItems = useMemo(() => {
    if (!data || !blueprint) return [
      { id: "summary", label: "About" },
    ];
    return [
      { id: "summary", label: "Summary" },
      { id: "builder", label: "Custom Builder" },
      { id: "data-table", label: "Data Table" },
      { id: "analytics", label: "Analytics" },
    ];
  }, [data, blueprint]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-slate-800" id="top">
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Top glass bar */}
      <div className="sticky top-0 z-50 glass-panel backdrop-blur-xl border-b border-[rgba(4,98,65,0.08)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 flex items-center justify-center overflow-hidden">
              <img
                src={lifewoodIconText}
                alt="Lifewood Data Technology"
                className="h-6 w-auto object-contain"
              />
            </div>
          </div>

          <div className="hidden md:block h-10 w-px bg-[rgba(4,98,65,0.12)]" />

          <div className="w-full sm:flex-1">
            <ExcelUploader
              compact
              onDataReady={(extracted, bp) => {
                setData(extracted);
                setBlueprint(bp);
                requestAnimationFrame(() => scrollTo("summary"));
              }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col lg:flex-row gap-10">
        <main className="flex-1">
          {data && blueprint ? (
            <Dashboard data={data} blueprint={blueprint} />
          ) : (
            <div className="glassy-box p-10 text-center w-full min-h-[60vh] flex flex-col items-center justify-center animate-fade-slide shimmer-border" id="summary">
              <div className="text-6xl mb-4">📂</div>
              <h2 className="text-2xl font-extrabold text-[var(--color-primary)] mb-2">
                Upload an Excel file to get started
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Bring your workforce or operations data and we will craft an interactive dashboard with AI. Use the upload control above to choose your file—charts, pivots, and insights will appear here instantly.
              </p>
            </div>
          )}
        </main>

        {/* Right rail navigation */}
        {data && blueprint && (
          <aside className="w-64 hidden lg:block">
            <div className="glass-panel rounded-2xl px-4 py-5 sticky top-24">
              <div className="text-xs font-bold tracking-[0.18em] text-[var(--color-primary)] uppercase mb-3">Navigate</div>
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="relative text-left px-4 py-2 rounded-xl border border-transparent transition-all duration-200 bg-white/70 hover:bg-[rgba(4,98,65,0.08)] text-slate-600 animate-float"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;

