import { useCallback, useEffect, useMemo, useState } from "react";

export interface GlossaryTerm {
  id: string;
  term: string;
  description: string;
  createdAt: string;
}

const STORAGE_KEY = "focusflow:glossary";
const EVENT = "focusflow:glossary-changed";

const readStore = (): GlossaryTerm[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Global cache so the highlighter can read terms without every node subscribing. */
let cache: GlossaryTerm[] | null = null;
export const getGlossaryTerms = (): GlossaryTerm[] => {
  if (!cache) cache = readStore();
  return cache;
};

export const useGlossary = () => {
  const [terms, setTerms] = useState<GlossaryTerm[]>(() => getGlossaryTerms());

  useEffect(() => {
    const sync = () => {
      cache = readStore();
      setTerms(cache);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: GlossaryTerm[]) => {
    cache = next;
    setTerms(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const addTerm = useCallback(
    (term: string, description: string) => {
      const trimmed = term.trim();
      if (!trimmed) return false;
      const existing = readStore();
      if (existing.some((t) => t.term.toLowerCase() === trimmed.toLowerCase())) return false;
      persist([
        ...existing,
        { id: `g-${Date.now()}`, term: trimmed, description: description.trim(), createdAt: new Date().toISOString() },
      ]);
      return true;
    },
    [persist]
  );

  const updateTerm = useCallback(
    (id: string, updates: Partial<Pick<GlossaryTerm, "term" | "description">>) => {
      persist(readStore().map((t) => (t.id === id ? { ...t, ...updates } : t)));
    },
    [persist]
  );

  const removeTerm = useCallback((id: string) => {
    persist(readStore().filter((t) => t.id !== id));
  }, [persist]);

  const sorted = useMemo(
    () => [...terms].sort((a, b) => a.term.localeCompare(b.term)),
    [terms]
  );

  return { terms: sorted, addTerm, updateTerm, removeTerm };
};
