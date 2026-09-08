import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deadlinesAPI, formatLocalDateKey, type Deadline } from "@/lib/api";

export type { Deadline, DeadlineSource } from "@/lib/api";

const STORAGE_KEY = "focusflow:deadlines";

export const deadlineDate = (value: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999` : value);

const readStore = (): Deadline[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" &&
      typeof item.title === "string" && Number.isFinite(deadlineDate(item.end).getTime())) : [];
  } catch { return []; }
};

function useDeadlineState() {
  const [deadlines, setDeadlines] = useState<Deadline[]>(readStore);
  const [selectedDate, selectDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const refreshId = useRef(0);

  const persist = useCallback((next: Deadline[]) => {
    setDeadlines(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { return; }
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    setIsLoading(true);
    const response = await deadlinesAPI.getAll();
    if (requestId !== refreshId.current) return false;
    setIsLoading(false);
    if (!response.success || !response.data) {
      setError("Could not load end dates. Showing the last saved list; check that the backend is running.");
      return false;
    }
    persist(response.data);
    setError(null);
    return true;
  }, [persist]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { setNow(Date.now()); void refresh(); };
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) void refresh(); };
    const timer = setInterval(() => setNow(Date.now()), 60000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const addDeadline = useCallback(async (deadline: { title: string; end: string; context?: string }) => {
    const response = await deadlinesAPI.create({ ...deadline, source: "manual" });
    if (!response.success) throw new Error(response.error || "Could not save end date.");
    await refresh();
  }, [refresh]);

  const removeDeadline = useCallback(async (id: string) => {
    const response = await deadlinesAPI.delete(id);
    if (!response.success) throw new Error(response.error || "Could not remove end date.");
    await refresh();
  }, [refresh]);

  const sorted = useMemo(() => [...deadlines].sort((first, second) => deadlineDate(first.end).getTime() - deadlineDate(second.end).getTime()), [deadlines]);
  const upcoming = useMemo(() => sorted.filter((deadline) => deadlineDate(deadline.end).getTime() >= now), [sorted, now]);
  const byDateKey = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    sorted.forEach((deadline) => {
      const key = formatLocalDateKey(deadlineDate(deadline.end));
      map.set(key, [...(map.get(key) ?? []), deadline]);
    });
    return map;
  }, [sorted]);

  return { deadlines: sorted, upcoming, byDateKey, addDeadline, removeDeadline, refresh, error, isLoading, selectedDate, selectDate };
}

const DeadlinesContext = createContext<ReturnType<typeof useDeadlineState> | null>(null);

export function DeadlinesProvider({ children }: { children: ReactNode }) {
  return createElement(DeadlinesContext.Provider, { value: useDeadlineState() }, children);
}

export function useDeadlines() {
  const context = useContext(DeadlinesContext);
  if (!context) throw new Error("useDeadlines requires DeadlinesProvider");
  return context;
}

export const formatDeadlineRange = (deadline: Deadline) => {
  const end = deadlineDate(deadline.end);
  const time = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline.end)) return `${day} · All day`;
  if (deadline.start) {
    const start = new Date(deadline.start);
    const startDay = formatLocalDateKey(start) === formatLocalDateKey(end) ? day : start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startDay} ${time(start)}–${formatLocalDateKey(start) === formatLocalDateKey(end) ? "" : `${day} `}${time(end)}`;
  }
  return `${day} · ${time(end)}`;
};

export const formatRelativeDue = (value: string) => {
  const minutes = Math.ceil((deadlineDate(value).getTime() - Date.now()) / 60000);
  if (minutes < 0) return "past due";
  if (minutes < 60) return minutes === 0 ? "now" : `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days}d`;
};
