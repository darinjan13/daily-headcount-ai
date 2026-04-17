import { useEffect, useState } from "react";
import { FileSpreadsheet, LoaderCircle, Sparkles, X } from "lucide-react";
import { useAnalysisJobs } from "../context/AnalysisJobsContext";

function formatElapsed(ms) {
  const safeMs = Math.max(0, ms || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function BackgroundAnalysisDock() {
  const { runningJobs, abortJob } = useAnalysisJobs();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!runningJobs.length) return null;

  return (
    <div
      className="fixed z-40 group"
      style={{
        right: 24,
        bottom: 88,
      }}
    >
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-xl"
        style={{
          backgroundColor: "var(--color-castleton-green)",
          borderColor: "rgba(255,255,255,0.18)",
          color: "#FFFFFF",
        }}
        aria-label={`Background analysis jobs: ${runningJobs.length}`}
        title={`${runningJobs.length} background analysis job${runningJobs.length !== 1 ? "s" : ""}`}
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center">
          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          <LoaderCircle
            className="absolute -right-1 -bottom-1 h-3.5 w-3.5 animate-spin rounded-full"
            style={{
              backgroundColor: "var(--color-castleton-green)",
              color: "#FFFFFF",
            }}
            aria-hidden="true"
          />
        </span>
        <span
          className="absolute right-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold"
          style={{
            backgroundColor: "var(--color-saffron)",
            color: "#000000",
            border: "1px solid rgba(19, 48, 32, 0.18)",
          }}
        >
          {runningJobs.length}
        </span>
      </button>

      <div
        className="pointer-events-none absolute bottom-16 right-0 w-[min(360px,calc(100vw-24px))] opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
      >
        <div
          className="rounded-3xl border p-4 shadow-2xl"
          style={{
            backgroundColor: "var(--color-surface-elevated)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--color-surface-soft)" }}
            >
              <Sparkles className="h-5 w-5" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold" style={{ margin: 0 }}>
                Background analysis
              </p>
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-light)", margin: 0 }}>
                Hover here anytime to check progress
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {runningJobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border p-3"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--color-surface-soft)" }}
                  >
                    <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold leading-5" style={{ margin: 0 }}>
                      {job.fileName}
                    </p>
                    <p className="truncate text-[10px] font-semibold leading-4" style={{ color: "var(--color-text-light)", margin: 0 }}>
                      {job.sheetName || "Workbook analysis"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold leading-4" style={{ color: "var(--color-text-light)", margin: 0 }}>
                      Running for {formatElapsed(now - (job.createdAt || now))}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--color-text-light)",
                      boxShadow: "none",
                      transform: "none",
                      padding: 0,
                    }}
                    onClick={() => abortJob(job.id)}
                    aria-label={`Cancel ${job.fileName}`}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold" style={{ color: "var(--color-text-light)" }}>
                    <span>{job.label}</span>
                    <span>{job.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface-soft)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${job.percent}%`,
                        background: "linear-gradient(90deg, var(--color-castleton-green), var(--color-saffron))",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
