import { useCallback, useEffect, useRef, useState } from "react";
import { studyRequest } from "@/lib/study-api";

export function useStudyData<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const invalidate = useCallback(() => { requestId.current++; }, []);
  const reload = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const result = await studyRequest<T>(endpoint);
      if (current === requestId.current) { setData(result); setError(""); }
    } catch (failure) { if (current === requestId.current) setError(failure instanceof Error ? failure.message : "Could not load study data."); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [endpoint]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    void reload();
    const update = () => void reload();
    window.addEventListener("focusflow:study-changed", update);
    window.addEventListener("focus", update);
    return () => { invalidate(); window.removeEventListener("focusflow:study-changed", update); window.removeEventListener("focus", update); };
  }, [reload, invalidate]);
  return { data, error, loading, reload };
}
