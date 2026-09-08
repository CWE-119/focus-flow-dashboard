import { useNoteTimer } from "@/contexts/NoteTimerContext";
import { useNavigate } from "@/lib/router";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveTimerIndicatorProps {
  className?: string;
  compact?: boolean;
}

export const ActiveTimerIndicator = ({ className, compact = false }: ActiveTimerIndicatorProps) => {
  const { time, isRunning, noteTitle } = useNoteTimer();
  const navigate = useNavigate();

  if (!isRunning && time === 0) return null;

  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (compact) {
    return (
      <button
        onClick={() => navigate("/notes")}
        className={cn(
          "relative flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors",
          "bg-primary/10 border border-primary/20 hover:bg-primary/20",
          className
        )}
        title={noteTitle ? `Working on: ${noteTitle}` : "Active session"}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="font-mono text-xs font-medium text-primary tabular-nums">
          {formatTime()}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/notes")}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
        "bg-primary/10 border border-primary/20 hover:bg-primary/20",
        className
      )}
      title={noteTitle ? `Working on: ${noteTitle}` : "Active session"}
    >
      <BookOpen className="w-4 h-4 text-primary" />
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="font-mono text-sm font-medium text-primary tabular-nums">
          {formatTime()}
        </span>
      </div>
      {noteTitle && (
        <span className="text-xs text-primary/70 max-w-[120px] truncate hidden sm:block">
          {noteTitle}
        </span>
      )}
    </button>
  );
};

export default ActiveTimerIndicator;
