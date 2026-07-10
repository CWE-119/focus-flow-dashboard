import { useSession } from "@/contexts/SessionContext";
import { useNoteTimer } from "@/contexts/NoteTimerContext";
import { useMemo } from "react";
import { BookOpen, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDateKey } from "@/lib/api";

const ActiveNoteSession = () => {
  const { time, isRunning, noteTitle } = useNoteTimer();
  
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

  return (
    <div className={cn(
      "border border-border rounded-md p-4 bg-card",
      isRunning && "border-primary/30 bg-primary/5"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
          Active Session
        </span>
        {isRunning ? (
          <Play className="w-3 h-3 text-primary animate-pulse ml-auto" />
        ) : (
          <Pause className="w-3 h-3 text-muted-foreground ml-auto" />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {formatTime()}
        </span>
        {isRunning && (
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>
      {noteTitle && (
        <p className="font-body text-xs text-muted-foreground mt-1 truncate" title={noteTitle}>
          {noteTitle}
        </p>
      )}
    </div>
  );
};

const Stats = () => {
  const { sessions } = useSession();

  const stats = useMemo(() => {
    const sessionsByDate = new Map(sessions.map((day) => [day.date, day.sessions]));
    const today = formatLocalDateKey();
    const todaySessions = sessionsByDate.get(today) || [];
    const totalMinutesToday = todaySessions.reduce((acc, s) => acc + s.duration, 0);

    // Calculate weekly stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = formatLocalDateKey(weekStart);
    
    let weekCount = 0;
    let weekMinutes = 0;
    sessions.forEach((day) => {
      if (day.date >= weekKey) {
        weekCount += day.sessions.length;
        weekMinutes += day.sessions.reduce((acc, s) => acc + s.duration, 0);
      }
    });

    // Calculate streak
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const dateKey = formatLocalDateKey(checkDate);
      const daySessions = sessionsByDate.get(dateKey);
      if (daySessions && daySessions.length > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate average focus time
    const allSessions = sessions.flatMap((d) => d.sessions);
    const avgMinutes = allSessions.length > 0
      ? Math.round(allSessions.reduce((acc, s) => acc + s.duration, 0) / allSessions.length)
      : 0;
    const avgH = Math.floor(avgMinutes / 60);
    const avgM = avgMinutes % 60;

    const hours = Math.floor(totalMinutesToday / 60);
    const mins = totalMinutesToday % 60;

    return [
      { 
        label: "Today", 
        value: `${hours}h ${mins}m`, 
        sublabel: "focused" 
      },
      { 
        label: "Sessions", 
        value: weekCount.toString(), 
        sublabel: "this week" 
      },
      { 
        label: "Streak", 
        value: streak.toString(), 
        sublabel: streak === 1 ? "day" : "days" 
      },
      { 
        label: "Average", 
        value: avgH > 0 ? `${avgH}h ${avgM}m` : `${avgM}m`, 
        sublabel: "per session" 
      },
    ];
  }, [sessions]);

  return (
    <div className="space-y-4">
      <ActiveNoteSession />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border p-4 bg-card">
            <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </span>
            <div className="mt-2">
              <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                {stat.value}
              </span>
              <p className="font-body text-xs text-muted-foreground mt-1">
                {stat.sublabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Stats;
