import { useCallback, useEffect, useMemo, useState } from "react";
import { glossaryAPI, type GlossaryTerm } from "@/lib/api";

export type { GlossaryTerm } from "@/lib/api";

const STORAGE_KEY = "focusflow:glossary";
const EVENT = "focusflow:glossary-changed";

const readStoredTerms = (): GlossaryTerm[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readStore = (): GlossaryTerm[] => readStoredTerms() ?? [];

/** Global cache so the highlighter can read terms without every node subscribing. */
let cache: GlossaryTerm[] | null = null;
export const getGlossaryTerms = (): GlossaryTerm[] => {
  if (!cache) cache = readStore();
  return cache;
};

export const useGlossary = () => {
  const [terms, setTerms] = useState<GlossaryTerm[]>(() => getGlossaryTerms());

  const persistLocal = useCallback((next: GlossaryTerm[]) => {
    cache = next;
    setTerms(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  useEffect(() => {
    const sync = () => {
      cache = readStore();
      setTerms(cache);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);

    const refreshFromBackend = async () => {
      const response = await glossaryAPI.getAll();
      if (!response.success || !response.data) return;

      const stored = readStoredTerms();
      if (response.data.length === 0 && stored && stored.length > 0) {
        await Promise.allSettled(stored.map((entry) => glossaryAPI.create(entry.term, entry.description, entry.id)));
        const migrated = await glossaryAPI.getAll();
        if (migrated.success && migrated.data) {
          persistLocal(migrated.data);
        }
        return;
      }

      if (response.data.length > 0 || stored) {
        persistLocal(response.data);
      }
    };

    void refreshFromBackend();

    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [persistLocal]);

  const addTerm = useCallback(
    (term: string, description: string) => {
      const trimmed = term.trim();
      if (!trimmed) return false;
      const existing = readStore();
      if (existing.some((t) => t.term.toLowerCase() === trimmed.toLowerCase())) return false;
      const nextTerm = {
        id: `glossary-${Date.now()}`,
        term: trimmed,
        description: description.trim(),
        createdAt: new Date().toISOString(),
      };
      persistLocal([
        ...existing,
        nextTerm,
      ]);
      void glossaryAPI.create(nextTerm.term, nextTerm.description, nextTerm.id);
      return true;
    },
    [persistLocal]
  );

  const updateTerm = useCallback(
    (id: string, updates: Partial<Pick<GlossaryTerm, "term" | "description">>) => {
      persistLocal(readStore().map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
      void glossaryAPI.update(id, updates);
    },
    [persistLocal]
  );

  const removeTerm = useCallback((id: string) => {
    persistLocal(readStore().filter((entry) => entry.id !== id));
    void glossaryAPI.delete(id);
  }, [persistLocal]);

  const sorted = useMemo(
    () => [...terms].sort((a, b) => a.term.localeCompare(b.term)),
    [terms]
  );

  return { terms: sorted, addTerm, updateTerm, removeTerm };
};
