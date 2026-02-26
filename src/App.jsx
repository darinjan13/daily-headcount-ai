import { useEffect, useMemo, useState } from "react";
import ExcelUploader from "./components/ExcelUploader";
import Dashboard from "./components/Dashboard";
import lifewoodIcon from "./assets/branding/lifewood-icon.png";

function App() {
  const [data, setData] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("top");

  // Scroll progress + active section tracking
  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? (scrollTop / max) * 100 : 0;
      setScrollProgress(pct);

      const anchors = ["top", "summary", "kpis", "builder", "custom", "data-table", "analytics", "chatbot"];
      const found = anchors.find((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= 120 && rect.bottom >= 120;
      });
      if (found) setActiveSection(found);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = useMemo(() => {
    if (!data || !blueprint) return [
      { id: "top", label: "Upload" },
      { id: "summary", label: "About" },
    ];
    return [
      { id: "top", label: "Upload" },
      { id: "summary", label: "Summary" },
      { id: "kpis", label: "Highlights" },
      { id: "builder", label: "Custom Builder" },
      { id: "custom", label: "Custom Outputs" },
      { id: "data-table", label: "Data Table" },
      { id: "analytics", label: "Analytics" },
      { id: "chatbot", label: "AI Chat" },
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
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden">
              <img src={lifewoodIcon} alt="Lifewood" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <div className="text-[var(--color-primary)] font-extrabold text-lg leading-tight">Daily Headcount Monitor</div>
              <div className="text-slate-500 text-sm">Lifewood Data Technology</div>
            </div>
          </div>

          <div className="hidden md:block h-10 w-px bg-[rgba(4,98,65,0.12)]" />

          <div className="flex-1">
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

      <div className="max-w-screen-2xl mx-auto px-6 py-10 flex gap-10">
        <main className="flex-1">
          {data && blueprint ? (
            <Dashboard data={data} blueprint={blueprint} />
          ) : (
            <div className="card-elevated p-10 text-center" id="summary">
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
        <aside className="w-64 hidden lg:block">
          <div className="glass-panel rounded-2xl px-4 py-5 sticky top-24">
            <div className="text-xs font-bold tracking-[0.18em] text-[var(--color-primary)] uppercase mb-3">Navigate</div>
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`text-left px-3 py-2 rounded-xl border transition-all duration-150 ${
                    activeSection === item.id
                      ? "border-[var(--color-primary)] bg-[rgba(4,98,65,0.08)] text-[var(--color-primary)]"
                      : "border-transparent bg-white/70 hover:bg-[rgba(4,98,65,0.06)] text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;