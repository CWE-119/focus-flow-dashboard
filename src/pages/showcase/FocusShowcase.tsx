import { Check, Circle, Clock3, Flag, Play, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ShowcaseShell from "./ShowcaseShell";
import { activityLevels, showcaseMetrics, showcaseTasks } from "./showcase-data";

const levelClasses = [
  "bg-muted",
  "bg-contribution-low",
  "bg-contribution-medium",
  "bg-contribution-high",
  "bg-contribution-max",
];

const FocusShowcase = () => (
  <ShowcaseShell title="Focus at a glance">
    <main className="relative flex h-full flex-col overflow-hidden px-8 py-7 sm:px-12 lg:px-16">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-border/60" />
      <div className="pointer-events-none absolute -right-8 -top-16 h-56 w-56 rounded-full border border-border/50" />

      <header className="relative mb-6 flex shrink-0 items-end justify-between border-b border-border pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Personal productivity, composed
          </div>
          <div className="flex items-end gap-5">
            <h1 className="font-display text-6xl font-bold leading-none tracking-[-0.07em] sm:text-8xl">FOCUS</h1>
            <p className="mb-2 hidden font-accent text-xl italic text-muted-foreground md:block">Make space for meaningful work.</p>
          </div>
        </div>
        <div className="mb-1 flex items-center gap-3">
          <Badge variant="outline" className="rounded-md px-3 py-1.5 font-normal">
            Tuesday · 9:41 AM
          </Badge>
          <Badge className="gap-2 rounded-md px-3 py-1.5 font-normal">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
            </span>
            Deep work active
          </Badge>
        </div>
      </header>

      <section className="relative grid min-h-0 flex-1 grid-cols-12 gap-5">
        <div className="col-span-5 flex min-h-0 flex-col gap-5">
          <article className="flex flex-[1.2] flex-col justify-between border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Session timer</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-contribution-high" /> Flow state
              </span>
            </div>
            <div>
              <div className="font-display text-[4.75rem] font-bold leading-none tracking-[-0.07em] tabular-nums xl:text-[5.35rem]">
                01:42:18
              </div>
              <div className="mt-5 h-1.5 overflow-hidden bg-muted">
                <div className="h-full w-[68%] bg-primary" />
              </div>
              <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Started 08:00</span><span>Goal 02:30</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button className="h-11 flex-1 gap-2"><Play className="h-4 w-4 fill-current" /> Pause session</Button>
              <Button variant="outline" size="icon" className="h-11 w-11"><Clock3 className="h-4 w-4" /></Button>
            </div>
          </article>

          <article className="grid flex-1 grid-cols-[1fr_auto] border border-border bg-card p-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-contribution-high" /> Current rhythm
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Protect the morning.</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Your strongest sessions begin before noon. Keep one clear outcome in view.
              </p>
            </div>
            <div className="flex items-end gap-1 pl-5">
              {[30, 48, 41, 70, 56, 83, 64, 92, 76, 100, 68, 88].map((height, index) => (
                <span
                  key={index}
                  className={index > 7 ? "w-1.5 bg-contribution-high" : "w-1.5 bg-primary/25"}
                  style={{ height: `${height * 0.58}px` }}
                />
              ))}
            </div>
          </article>
        </div>

        <div className="col-span-7 flex min-h-0 flex-col gap-5">
          <article className="min-h-0 flex-1 border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Today’s tasks</span>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Five moves. One launch.</h2>
              </div>
              <Badge variant="outline" className="rounded-md font-normal">4 remaining</Badge>
            </div>
            <div>
              {showcaseTasks.map((task) => (
                <div key={task.title} className="group flex h-[46px] items-center gap-3 border-t border-border first:border-t-0">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${task.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {task.completed ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 opacity-0" />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${task.completed ? "text-muted-foreground line-through" : ""}`}>{task.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.color }} />{task.category}
                  </span>
                  <span className="flex w-16 items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Flag className={`h-3 w-3 ${task.priority === "High" ? "text-contribution-high" : ""}`} />{task.priority}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <div className="grid grid-cols-4 gap-3">
            {showcaseMetrics.map((metric) => (
              <article key={metric.label} className="border border-border bg-card p-4">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</span>
                <div className="mt-1 font-display text-2xl font-bold tracking-tight tabular-nums">{metric.value}</div>
                <span className="text-[10px] text-muted-foreground">{metric.detail}</span>
              </article>
            ))}
          </div>

          <article className="border border-border bg-card px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">16-week momentum</span>
              <span className="text-[10px] text-muted-foreground">Less&nbsp;&nbsp;■ ■ ■ ■&nbsp;&nbsp;More</span>
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(28, minmax(0, 1fr))" }}>
              {activityLevels.map((level, index) => (
                <span key={index} className={`aspect-square rounded-[2px] ${levelClasses[level]}`} />
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  </ShowcaseShell>
);

export default FocusShowcase;
