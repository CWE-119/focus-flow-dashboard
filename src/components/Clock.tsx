import { useState, useEffect } from "react";
import { CalendarDays, GraduationCap, CalendarClock } from "lucide-react";
import { useDeadlines, formatDeadlineRange, formatRelativeDue } from "@/hooks/use-deadlines";
import { cn } from "@/lib/utils";

const Clock = () => {
  const [time, setTime] = useState(new Date());
  const { upcoming } = useDeadlines();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="border border-border rounded-md p-6 bg-card">
      <div className="flex items-start justify-between gap-3">
        <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
          Current Time
        </span>
        <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
          {upcoming.length} upcoming
        </span>
      </div>
      <div className="mt-4">
        <div className="font-display text-5xl font-bold tracking-tighter text-foreground tabular-nums">
          {formatTime(time)}
        </div>
        <p className="font-accent text-lg text-muted-foreground mt-1 italic">
          {formatDate(time)}
        </p>
      </div>

      {/* End dates pulled from Google Calendar + Canvas — fixed height, scrollable */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
            End dates
          </span>
        </div>

        <div className="h-[132px] overflow-y-auto pr-1">
          {upcoming.length === 0 ? (
            <p className="py-6 text-center font-body text-xs text-muted-foreground">
              Nothing due — enjoy it
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((item) => {
                const overdue = new Date(item.end).getTime() < Date.now();
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 rounded-sm px-1 py-1 transition-colors hover:bg-muted/60"
                  >
                    {item.source === "canvas" ? (
                      <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-xs text-foreground" title={item.title}>
                        {item.title}
                      </p>
                      <p className="font-body text-[10px] text-muted-foreground">
                        {formatDeadlineRange(item)}
                        {item.context ? ` · ${item.context}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-body text-[10px] tabular-nums",
                        overdue ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {formatRelativeDue(item.end)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Clock;
