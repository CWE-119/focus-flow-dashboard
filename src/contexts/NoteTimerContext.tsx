import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from "react";
import { useSession } from "@/contexts/SessionContext";
import { historyAPI } from "@/lib/api";
import { toast } from "sonner";

interface NoteTimerStateContextType {
  time: number;
  isRunning: boolean;
  noteTitle: string | null;
}

interface NoteTimerActionsContextType {
  startTimer: (title?: string) => void;
  pauseTimer: () => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  saveSession: () => Promise<void>;
}

type NoteTimerContextType = NoteTimerStateContextType & NoteTimerActionsContextType;

const NoteTimerStateContext = createContext<NoteTimerStateContextType | undefined>(undefined);
const NoteTimerActionsContext = createContext<NoteTimerActionsContextType | undefined>(undefined);

export const NoteTimerProvider = ({ children }: { children: ReactNode }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [noteTitle, setNoteTitle] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(time);
  const noteTitleRef = useRef(noteTitle);
  const { addSession, fetchSessions } = useSession();

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    noteTitleRef.current = noteTitle;
  }, [noteTitle]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const startTimer = useCallback((title?: string) => {
    if (title) setNoteTitle(title);
    setIsRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTime(0);
  }, []);

  const saveSession = useCallback(async () => {
    const elapsedSeconds = timeRef.current;
    const activeNoteTitle = noteTitleRef.current;

    if (elapsedSeconds > 0) {
      try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - elapsedSeconds * 1000);
        
        const startTime = startDate.toTimeString().slice(0, 5);
        const endTime = endDate.toTimeString().slice(0, 5);
        const durationMinutes = Math.round(elapsedSeconds / 60);

        const description = activeNoteTitle
          ? `Reading/memorizing: "${activeNoteTitle}" for ${durationMinutes} minutes`
          : `Note study session: ${durationMinutes} minutes`;

        const result = await historyAPI.create('note_session', description, {
          duration: durationMinutes,
          startTime,
          endTime,
          noteTitle: activeNoteTitle,
        });
        
        if (result.success) {
          addSession(elapsedSeconds, startTime, endTime);
          await fetchSessions();
          toast.success(`Session saved: ${durationMinutes > 0 ? durationMinutes + "m" : elapsedSeconds + "s"}`);
        } else {
          toast.error(result.error || 'Failed to save session');
        }
      } catch (error) {
        toast.error('Error saving session');
        console.error(error);
      }
      setIsRunning(false);
      setTime(0);
      setNoteTitle(null);
    }
  }, [addSession, fetchSessions]);

  const stateValue = useMemo(() => ({
    time,
    isRunning,
    noteTitle,
  }), [time, isRunning, noteTitle]);

  const actionsValue = useMemo(() => ({
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    saveSession,
  }), [startTimer, pauseTimer, toggleTimer, resetTimer, saveSession]);

  return (
    <NoteTimerStateContext.Provider value={stateValue}>
      <NoteTimerActionsContext.Provider value={actionsValue}>
        {children}
      </NoteTimerActionsContext.Provider>
    </NoteTimerStateContext.Provider>
  );
};

export const useNoteTimerState = () => {
  const context = useContext(NoteTimerStateContext);
  if (!context) {
    throw new Error("useNoteTimerState must be used within a NoteTimerProvider");
  }
  return context;
};

export const useNoteTimerActions = () => {
  const context = useContext(NoteTimerActionsContext);
  if (!context) {
    throw new Error("useNoteTimerActions must be used within a NoteTimerProvider");
  }
  return context;
};

export const useNoteTimer = () => {
  const state = useNoteTimerState();
  const actions = useNoteTimerActions();
  const context = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  if (!context) {
    throw new Error("useNoteTimer must be used within a NoteTimerProvider");
  }
  return context;
};
