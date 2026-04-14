import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const AnalysisJobsContext = createContext(null);

function makeJobId() {
  return `analysis-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AnalysisJobsProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const controllersRef = useRef(new Map());

  const createJob = useCallback((payload) => {
    const id = makeJobId();
    const nextJob = {
      id,
      fileId: payload?.fileId || "",
      fileName: payload?.fileName || "Workbook",
      sheetName: payload?.sheetName || "",
      label: payload?.label || "Preparing analysis",
      percent: payload?.percent ?? 0,
      status: payload?.status || "running",
      createdAt: Date.now(),
      completedAt: null,
      error: "",
      isBackground: false,
      resultPayload: null,
    };

    setJobs((currentJobs) => [nextJob, ...currentJobs].slice(0, 12));
    return id;
  }, []);

  const updateJob = useCallback((jobId, patch) => {
    if (!jobId) return;
    setJobs((currentJobs) => currentJobs.map((job) => (
      job.id === jobId ? { ...job, ...patch } : job
    )));
  }, []);

  const attachJobController = useCallback((jobId, controller) => {
    if (!jobId || !controller) return;
    controllersRef.current.set(jobId, controller);
  }, []);

  const detachJobController = useCallback((jobId) => {
    if (!jobId) return;
    controllersRef.current.delete(jobId);
  }, []);

  const dismissNotification = useCallback((jobId) => {
    if (!jobId) return;
    setNotifications((currentNotifications) => (
      currentNotifications.filter((notification) => notification.jobId !== jobId)
    ));
  }, []);

  const completeJob = useCallback((jobId, resultPayload, options = {}) => {
    if (!jobId) return;
    detachJobController(jobId);
    let completedJob = null;
    const suppressNotification = Boolean(options?.suppressNotification);

    setJobs((currentJobs) => currentJobs.map((job) => {
      if (job.id !== jobId) return job;
      completedJob = {
        ...job,
        status: "completed",
        label: "Ready to open",
        percent: 100,
        completedAt: Date.now(),
        resultPayload,
        error: "",
      };
      return completedJob;
    }));

    if (!suppressNotification) {
      setNotifications((currentNotifications) => {
        const nextNotifications = currentNotifications.filter((notification) => notification.jobId !== jobId);
        return [{
          id: `${jobId}-done`,
          jobId,
          status: "completed",
          title: completedJob?.fileName || "Analysis ready",
          message: completedJob?.sheetName
            ? `${completedJob.sheetName} is ready to open.`
            : "Workbook analysis is ready to open.",
        }, ...nextNotifications].slice(0, 4);
      });
    } else {
      dismissNotification(jobId);
    }
  }, [detachJobController, dismissNotification]);

  const failJob = useCallback((jobId, message) => {
    if (!jobId) return;
    detachJobController(jobId);
    let failedJob = null;

    setJobs((currentJobs) => currentJobs.map((job) => {
      if (job.id !== jobId) return job;
      failedJob = {
        ...job,
        status: "failed",
        label: "Analysis failed",
        error: message || "Unable to analyze workbook.",
        completedAt: Date.now(),
      };
      return failedJob;
    }));

    setNotifications((currentNotifications) => {
      const nextNotifications = currentNotifications.filter((notification) => notification.jobId !== jobId);
      return [{
        id: `${jobId}-failed`,
        jobId,
        status: "failed",
        title: failedJob?.fileName || "Analysis failed",
        message: failedJob?.error || "Unable to analyze workbook.",
      }, ...nextNotifications].slice(0, 4);
    });
  }, [detachJobController]);

  const abortJob = useCallback((jobId) => {
    if (!jobId) return;
    const controller = controllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
    }
    controllersRef.current.delete(jobId);
    dismissNotification(jobId);
    setJobs((currentJobs) => currentJobs.map((job) => (
      job.id === jobId
        ? {
          ...job,
          status: "cancelled",
          label: "Cancelled",
          completedAt: Date.now(),
        }
        : job
    )));
  }, [dismissNotification]);

  const removeJob = useCallback((jobId) => {
    if (!jobId) return;
    abortJob(jobId);
    setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
  }, [abortJob]);

  const markJobBackground = useCallback((jobId) => {
    updateJob(jobId, { isBackground: true });
  }, [updateJob]);

  const getJob = useCallback((jobId) => (
    jobs.find((job) => job.id === jobId) || null
  ), [jobs]);

  const runningJobs = useMemo(() => jobs.filter((job) => job.status === "running"), [jobs]);
  const visibleJobs = useMemo(() => jobs.slice(0, 5), [jobs]);

  const value = useMemo(() => ({
    jobs,
    visibleJobs,
    runningJobs,
    notifications,
    createJob,
    updateJob,
    completeJob,
    failJob,
    abortJob,
    removeJob,
    getJob,
    attachJobController,
    detachJobController,
    dismissNotification,
    markJobBackground,
  }), [
    jobs,
    visibleJobs,
    runningJobs,
    notifications,
    createJob,
    updateJob,
    completeJob,
    failJob,
    abortJob,
    removeJob,
    getJob,
    attachJobController,
    detachJobController,
    dismissNotification,
    markJobBackground,
  ]);

  return (
    <AnalysisJobsContext.Provider value={value}>
      {children}
    </AnalysisJobsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalysisJobs() {
  const context = useContext(AnalysisJobsContext);
  if (!context) throw new Error("useAnalysisJobs must be used inside AnalysisJobsProvider");
  return context;
}
