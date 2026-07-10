import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession, Session } from "@/contexts/SessionContext";
import { useReminders } from "@/contexts/RemindersContext";
import { ReminderPopup } from "./ReminderPopup";
import { formatLocalDateKey } from "@/lib/api";

interface DayData {
  level: number;
  date: Date;
  sessions: Session[];
}

const ContributionGrid = () => {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [reminderPopupOpen, setReminderPopupOpen] = useState(false);
  const { sessions } = useSession();
  const { reminders, getRemindersByDate } = useReminders();

  // Generate data for all 12 months in calendar year order
  const today = new Date();
  const currentYear = today.getFullYear();
  
  const sessionsByDate = useMemo(() => new Map(sessions.map((day) => [day.date, day.sessions])), [sessions]);
  const reminderDates = useMemo(() => {
    const keys = new Set<string>();
    reminders.forEach((reminder) => keys.add(formatLocalDateKey(reminder.date)));
    return keys;
  }, [reminders]);

  const getLevelForSessions = (daySessions: Session[]) => {
    const totalMinutes = daySessions.reduce((acc, s) => acc + s.duration, 0);
    if (totalMinutes === 0) return 0;
    if (totalMinutes < 30) return 1;
    if (totalMinutes < 60) return 2;
    if (totalMinutes < 120) return 3;
    return 4;
  };

  const months = useMemo(() => {
    const getMonthData = (monthNum: number) => {
      const actualMonth = new Date(currentYear, monthNum, 1);
      const monthYear = actualMonth.getFullYear();
      const monthName = actualMonth.toLocaleDateString("en-US", { month: "short" });
      const lastDayOfMonth = new Date(monthYear, monthNum + 1, 0).getDate();
      const data: DayData[] = [];

      for (let day = 1; day <= lastDayOfMonth; day++) {
        const date = new Date(monthYear, monthNum, day);
        date.setHours(0, 0, 0, 0);
        const daySessions = sessionsByDate.get(formatLocalDateKey(date)) || [];
        data.push({ level: getLevelForSessions(daySessions), date, sessions: daySessions });
      }

      const weeks: DayData[][] = [];
      for (let i = 0; i < data.length; i += 7) {
        weeks.push(data.slice(i, i + 7));
      }

      return { monthName, weeks, data };
    };

    return Array.from({ length: 12 }, (_, i) => getMonthData(i));
  }, [currentYear, sessionsByDate]);

  const getLevelClass = (level: number) => {
    switch (level) {
      case 0: return "bg-muted";
      case 1: return "bg-contribution-low";
      case 2: return "bg-contribution-medium";
      case 3: return "bg-contribution-high";
      case 4: return "bg-contribution-max";
      default: return "bg-muted";
    }
  };

  const hasReminder = (date: Date): boolean => {
    return reminderDates.has(formatLocalDateKey(date));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getTotalTime = (sessions: { duration: number }[]) => {
    const total = sessions.reduce((acc, s) => acc + s.duration, 0);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <>
      <div className="border border-border rounded-md p-4 md:p-6 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
            Activity
          </span>
          
          {/* Legend */}
          <div className="flex items-center gap-1 md:gap-2">
            <span className="font-body text-[10px] md:text-xs text-muted-foreground">Less</span>
            <div className="flex gap-0.5 md:gap-1">
              {[0, 1, 2, 3, 4].map((level) => (
                <div key={level} className={`w-2 h-2 md:w-3 md:h-3 rounded-sm ${getLevelClass(level)}`} />
              ))}
            </div>
            <span className="font-body text-[10px] md:text-xs text-muted-foreground">More</span>
          </div>
        </div>

        {/* Multiple months grid */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4" style={{ minWidth: 'max-content' }}>
            {months.map((monthData, monthIdx) => (
              <div key={monthIdx} className="flex flex-col gap-1">
                {/* Month label */}
                <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                  {monthData.monthName}
                </span>
                
                {/* 4-column grid - days go left to right */}
                <div className="flex flex-col gap-0.5 md:gap-1">
                  {monthData.weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex gap-0.5 md:gap-1">
                      {week.map((day, dayIdx) => {
                        const dayHasReminder = hasReminder(day.date);
                        return (
                          <div
                            key={dayIdx}
                            className={`w-2 h-2 md:w-3 md:h-3 relative ${getLevelClass(day.level)} transition-all hover:ring-1 hover:ring-foreground cursor-pointer rounded-sm`}
                            title={`${day.date.getDate()} - ${day.level} hour${day.level !== 1 ? "s" : ""}${dayHasReminder ? " • Has reminder" : ""}`}
                            onClick={() => {
                              if (dayHasReminder) {
                                setSelectedDay(day);
                                setReminderPopupOpen(true);
                              } else {
                                setSelectedDay(day);
                              }
                            }}
                          >
                            {dayHasReminder && (
                              <div className="absolute inset-0 bg-destructive rounded-sm animate-pulse opacity-70" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedDay && !reminderPopupOpen} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {selectedDay && formatDate(selectedDay.date)}
            </DialogTitle>
            <DialogDescription>
              {selectedDay?.sessions.length === 0
                ? "No focus sessions recorded"
                : `${selectedDay?.sessions.length} session${selectedDay?.sessions.length !== 1 ? "s" : ""} • ${selectedDay && getTotalTime(selectedDay.sessions)} total`}
            </DialogDescription>
          </DialogHeader>

          {selectedDay && selectedDay.sessions.length > 0 && (
            <div className="space-y-3 mt-4">
              {selectedDay.sessions.map((session, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border border-border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 ${getLevelClass(selectedDay.level)}`} />
                    <span className="font-body text-sm">
                      {session.start || 'N/A'} — {session.end || 'N/A'}
                    </span>
                  </div>
                  <span className="font-display text-sm font-medium">
                    {session.duration}m
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedDay && selectedDay.sessions.length === 0 && (
            <div className="py-8 text-center">
              <p className="font-body text-muted-foreground text-sm">
                Start a focus session to track your progress
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReminderPopup
        isOpen={reminderPopupOpen && !!selectedDay}
        onOpenChange={setReminderPopupOpen}
        reminders={selectedDay ? getRemindersByDate(selectedDay.date) : []}
        selectedDate={selectedDay?.date || null}
      />
    </>
  );
};

export default ContributionGrid;
