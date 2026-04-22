import { BellRing, CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAnalysisJobs } from "../context/AnalysisJobsContext";

function formatElapsed(ms) {
  const safeMs = Math.max(0, ms || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function BackgroundAnalysisToasts({ onOpenJob }) {
  const { notifications, dismissNotification, getJob, runningJobs } = useAnalysisJobs();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!notifications.length) return null;

  return (
    <div
      className="fixed z-[140] flex flex-col gap-3"
      style={{
        right: 18,
        bottom: runningJobs.length ? 92 : 18,
        width: "min(360px, calc(100vw - 24px))",
      }}
    >
      {notifications.map((notification) => {
        const job = getJob(notification.jobId);
        const canOpen = notification.status === "completed" && Boolean(job?.resultPayload);
        return (
          <div
            key={notification.id}
            className="rounded-2xl border p-4 shadow-xl"
            style={{
              backgroundColor: "var(--color-surface-elevated)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--color-surface-soft)" }}
              >
                {notification.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                ) : notification.status === "failed" ? (
                  <TriangleAlert className="h-5 w-5" style={{ color: "var(--color-saffron)" }} aria-hidden="true" />
                ) : (
                  <BellRing className="h-5 w-5" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold" style={{ margin: 0 }}>
                  {notification.title}
                </p>
                <p className="mt-1 text-xs font-semibold" style={{ color: "var(--color-text-light)", margin: 0 }}>
                  {notification.message}
                </p>
                {job?.createdAt && (
                  <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--color-text-light)", margin: 0 }}>
                    {job.status === "running"
                      ? `Running for ${formatElapsed(now - job.createdAt)}`
                      : `Finished in ${formatElapsed((job.completedAt || now) - job.createdAt)}`}
                  </p>
                )}
                {job?.status === "running" && (
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
                )}
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
                aria-label="Dismiss notification"
                onClick={() => dismissNotification(notification.jobId)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {canOpen && (
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-xs font-extrabold"
                  style={{
                    backgroundColor: "var(--color-castleton-green)",
                    color: "#FFFFFF",
                    border: "none",
                  }}
                  onClick={() => onOpenJob?.(notification.jobId)}
                >
                  Open
                </button>
              )}
              {!canOpen && job?.status === "running" && (
                <span className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--color-text-light)" }}>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Working in background
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
