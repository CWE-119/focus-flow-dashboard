import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'queued' | 'error';

export interface SaveState {
  status: SaveStatus;
  savedAt: Date | null;
  error: string | null;
  queuedAt: Date | null;
}

export function useDebounce<T>(value: T, delay: number, callback: (value: T) => void) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      callback(value);
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, callback]);
}

export function useDebounceWithStatus<T>(
  value: T, 
  delay: number, 
  callback: (value: T) => void | boolean | Promise<void | boolean>,
  initialValue: T,
  queueKey?: string
): SaveState {
  const [state, setState] = useState<SaveState>({ status: 'idle', savedAt: null, error: null, queuedAt: null });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangedRef = useRef(false);
  const pendingValueRef = useRef<T>(value);

  const persistQueue = useCallback((nextValue: T) => {
    if (!queueKey) return;
    localStorage.setItem(queueKey, JSON.stringify({ value: nextValue, queuedAt: new Date().toISOString() }));
  }, [queueKey]);

  const clearQueue = useCallback(() => {
    if (!queueKey) return;
    localStorage.removeItem(queueKey);
  }, [queueKey]);

  const saveValue = useCallback(async (nextValue: T) => {
    pendingValueRef.current = nextValue;
    if (!navigator.onLine) {
      persistQueue(nextValue);
      setState((prev) => ({ ...prev, status: 'queued', queuedAt: new Date(), error: 'Offline. Changes will retry when connection returns.' }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'saving', error: null }));
    try {
      const result = await callback(nextValue);
      if (result === false) throw new Error('Save failed');
      clearQueue();
      setState({ status: 'saved', savedAt: new Date(), queuedAt: null, error: null });
      savedTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, status: 'idle' }));
      }, 3000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: navigator.onLine ? 'error' : 'queued',
        queuedAt: navigator.onLine ? prev.queuedAt : new Date(),
        error: error instanceof Error ? error.message : 'Save failed',
      }));
      if (!navigator.onLine) persistQueue(nextValue);
    }
  }, [callback, clearQueue, persistQueue]);

  useEffect(() => {
    // Check if value has changed from initial
    if (value !== initialValue) {
      hasChangedRef.current = true;
    }

    // Only show saving status if value has actually changed
    if (!hasChangedRef.current) return;

    if (!navigator.onLine) persistQueue(value);
    setState((prev) => ({ ...prev, status: navigator.onLine ? 'saving' : 'queued', queuedAt: navigator.onLine ? prev.queuedAt : new Date(), error: navigator.onLine ? null : 'Offline. Changes will retry when connection returns.' }));

    // Clear previous timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }

    // Set debounce timeout
    timeoutRef.current = setTimeout(() => {
      saveValue(value);
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, initialValue, persistQueue, saveValue]);

  useEffect(() => {
    if (!queueKey) return;
    try {
      const queued = localStorage.getItem(queueKey);
      if (!queued) return;
      const parsed = JSON.parse(queued) as { value: T; queuedAt?: string };
      pendingValueRef.current = parsed.value;
      setState((prev) => ({
        ...prev,
        status: navigator.onLine ? 'saving' : 'queued',
        queuedAt: parsed.queuedAt ? new Date(parsed.queuedAt) : new Date(),
        error: navigator.onLine ? null : 'Offline. Changes will retry when connection returns.',
      }));
      if (navigator.onLine) saveValue(parsed.value);
    } catch {
      clearQueue();
    }
  }, [queueKey, clearQueue, saveValue]);

  useEffect(() => {
    const retry = () => {
      if (state.status === 'queued' || state.status === 'error') {
        saveValue(pendingValueRef.current);
      }
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [state.status, saveValue]);

  // Cleanup saved timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  return state;
}
