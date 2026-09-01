import { useCallback, useEffect, useMemo, useState } from "react";
import { formatLocalDateKey } from "@/lib/api";

export type DeadlineSource = "google" | "canvas" | "manual";

export interface Deadline {
  id: string;
  title: string;
  /** Course / calendar name */
  context?: string;
  source: DeadlineSource;
  /** ISO string — when the item is due / ends */
  end: string;
  /** ISO string — optional start time */
  start?: string;
  url?: string;
}

const STORAGE_KEY = "focusflow:deadlines";

const addDays = (days: number, hour = 23, minute = 59) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/**
 * Mock feed standing in for the Google Calendar + Canvas LMS APIs.
 * Replace `loadDeadlines` with real fetches once the integrations are wired.
 */
const MOCK_DEADLINES: Deadline[] = [
  { id: "gc-1", title: "Team standup", context: "Work calendar", source: "google", start: addDays(0, 9, 30), end: addDays(0, 10, 0) },
  { id: "cv-1", title: "Linear Algebra — Problem Set 6", context: "MATH 221", source: "canvas", end: addDays(1) },
  { id: "gc-2", title: "Dentist appointment", context: "Personal", source: "google", start: addDays(2, 15, 0), end: addDays(2, 16, 0) },
  { id: "cv-2", title: "Data Structures — Quiz 4", context: "CS 310", source: "canvas", end: addDays(3, 22, 0) },
  { id: "cv-3", title: "Essay: Modernism in Print", context: "ENG 204", source: "canvas", end: addDays(5) },
  { id: "gc-3", title: "Study group", context: "Work calendar", source: "google", start: addDays(6, 18, 0), end: addDays(6, 20, 0) },
  { id: "cv-4", title: "Final project proposal", context: "CS 310", source: "canvas", end: addDays(9) },
];

const readStore = (): Deadline[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MOCK_DEADLINES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : MOCK_DEADLINES;
  } catch {
    return MOCK_DEADLINES;
  }
};

const EVENT = "focusflow:deadlines-changed";

export const useDeadlines = () => {
  const [deadlines, setDeadlines] = useState<Deadline[]>(() => readStore());

  useEffect(() => {
    const sync = () => setDeadlines(readStore());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: Deadline[]) => {
    setDeadlines(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const addDeadline = useCallback(
    (deadline: Omit<Deadline, "id" | "source"> & { source?: DeadlineSource }) => {
      persist([
        ...readStore(),
        { ...deadline, source: deadline.source ?? "manual", id: `m-${Date.now()}` },
      ]);
    },
    [persist]
  );

  const removeDeadline = useCallback((id: string) => {
    persist(readStore().filter((d) => d.id !== id));
  }, [persist]);

  const sorted = useMemo(
    () => [...deadlines].sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime()),
    [deadlines]
  );

  const upcoming = useMemo(() => {
    const now = Date.now();
    return sorted.filter((d) => new Date(d.end).getTime() >= now - 60 * 60 * 1000);
  }, [sorted]);

  /** date key -> deadlines on that day, for the activity grid */
  const byDateKey = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    sorted.forEach((d) => {
      const key = formatLocalDateKey(new Date(d.end));
      map.set(key, [...(map.get(key) ?? []), d]);
    });
    return map;
  }, [sorted]);

  return { deadlines: sorted, upcoming, byDateKey, addDeadline, removeDeadline };
};

export const formatDeadlineRange = (deadline: Deadline) => {
  const end = new Date(deadline.end);
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (deadline.start) {
    const start = new Date(deadline.start);
    return `${day} · ${time(start)}–${time(end)}`;
  }
  return `${day} · ${time(end)}`;
};

export const formatRelativeDue = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < -60) return "past due";
  if (mins < 60) return mins <= 0 ? "now" : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days}d`;
};
