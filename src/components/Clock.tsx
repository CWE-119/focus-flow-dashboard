import { useState, useEffect } from "react";

const Clock = () => {
  const [time, setTime] = useState(new Date());

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
      <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
        Current Time
      </span>
      <div className="mt-4">
        <div className="font-display text-5xl font-bold tracking-tighter text-foreground tabular-nums">
          {formatTime(time)}
        </div>
        <p className="font-accent text-lg text-muted-foreground mt-1 italic">
          {formatDate(time)}
        </p>
      </div>
    </div>
  );
};

export default Clock;
