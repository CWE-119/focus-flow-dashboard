import { useCallback, useEffect, useState } from "react";

export interface Category {
  id: string;
  name: string;
  color: string; // hex
}

const CATEGORIES_KEY = "focus.taskCategories.v1";
const TASK_MAP_KEY = "focus.taskCategoryMap.v1";

export const CATEGORY_COLORS = [
  "#5ca8e0",
  "#9b7ed9",
  "#d96aa3",
  "#e09746",
  "#6bcf7f",
  "#e0c85c",
  "#5cd0d0",
  "#e07171",
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-work", name: "Work", color: "#5ca8e0" },
  { id: "cat-personal", name: "Personal", color: "#9b7ed9" },
  { id: "cat-study", name: "Study", color: "#e09746" },
];

const readCategories = (): Category[] => {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;
    return parsed;
  } catch {
    return DEFAULT_CATEGORIES;
  }
};

const readTaskMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(TASK_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// Simple pub-sub so multiple hook instances stay in sync
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const useCategories = () => {
  const [categories, setCategoriesState] = useState<Category[]>(() => readCategories());
  const [taskMap, setTaskMapState] = useState<Record<string, string>>(() => readTaskMap());

  useEffect(() => {
    const listener = () => {
      setCategoriesState(readCategories());
      setTaskMapState(readTaskMap());
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const persistCategories = useCallback((next: Category[]) => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    setCategoriesState(next);
    notify();
  }, []);

  const persistTaskMap = useCallback((next: Record<string, string>) => {
    localStorage.setItem(TASK_MAP_KEY, JSON.stringify(next));
    setTaskMapState(next);
    notify();
  }, []);

  const createCategory = useCallback(
    (name: string, color: string) => {
      const cat: Category = {
        id: `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        color,
      };
      persistCategories([...readCategories(), cat]);
      return cat;
    },
    [persistCategories]
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Omit<Category, "id">>) => {
      const next = readCategories().map((c) => (c.id === id ? { ...c, ...updates } : c));
      persistCategories(next);
    },
    [persistCategories]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      persistCategories(readCategories().filter((c) => c.id !== id));
      // Unassign from any tasks
      const map = { ...readTaskMap() };
      Object.keys(map).forEach((k) => {
        if (map[k] === id) delete map[k];
      });
      persistTaskMap(map);
    },
    [persistCategories, persistTaskMap]
  );

  const setTaskCategory = useCallback(
    (taskId: string, categoryId: string | null) => {
      const map = { ...readTaskMap() };
      if (categoryId) map[taskId] = categoryId;
      else delete map[taskId];
      persistTaskMap(map);
    },
    [persistTaskMap]
  );

  const getTaskCategory = useCallback(
    (taskId: string): Category | undefined => {
      const catId = taskMap[taskId];
      if (!catId) return undefined;
      return categories.find((c) => c.id === catId);
    },
    [categories, taskMap]
  );

  return {
    categories,
    taskMap,
    createCategory,
    updateCategory,
    deleteCategory,
    setTaskCategory,
    getTaskCategory,
  };
};
