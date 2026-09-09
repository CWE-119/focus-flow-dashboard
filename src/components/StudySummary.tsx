import { useEffect, useState } from "react";
import { useStudyData } from "@/hooks/use-study-data";
import { appHref, type StudySummary as Summary } from "@/lib/study-api";
import { formatLocalDateKey } from "@/lib/api";

export function StudySummary() {
  const { data, error } = useStudyData<Summary>('/study/summary');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const today = formatLocalDateKey(new Date(now));
  const due = data?.cards.filter((card) => Date.parse(card.dueAt) <= now).length || 0;
  const steps = data?.steps.filter((step) => step.date <= today) || [];
  return <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-card p-4" aria-label="Study schedule"><div><h2 className="text-sm font-semibold">Study schedule</h2><p className="text-xs text-muted-foreground">{due} recall cards due · {steps.length} study blocks due · {steps.reduce((total, step) => total + step.minutes, 0)} planned minutes</p>{error && <p className="text-xs text-destructive">Study data unavailable. Start the backend and retry.</p>}</div><div className="flex gap-4 text-sm"><a className="text-primary underline" href={appHref('/study?tab=recall')}>Review cards</a><a className="text-primary underline" href={appHref('/study')}>Workspaces</a><a className="text-primary underline" href={appHref('/study?tab=backups')}>Backups & sync</a></div></section>;
}
