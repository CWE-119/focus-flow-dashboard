import { ArrowRight, Camera, FileText, Focus, Network, Sparkles } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ShowcaseShell from "./ShowcaseShell";

const scenes = [
  {
    path: "/showcase/focus",
    number: "01",
    title: "Focus at a glance",
    description: "A complete productivity dashboard with timer, tasks, rhythm, stats, and activity.",
    icon: Focus,
    accent: "bg-contribution-high",
    preview: (
      <div className="grid h-full grid-cols-5 gap-2 p-4">
        <div className="col-span-2 flex flex-col justify-between border border-border bg-background p-3">
          <span className="text-[8px] uppercase tracking-[0.25em] text-muted-foreground">Session</span>
          <span className="font-display text-2xl font-bold tracking-tighter">01:42:18</span>
          <div className="h-1.5 w-16 bg-primary" />
        </div>
        <div className="col-span-3 space-y-2 border border-border bg-background p-3">
          {["Launch story", "Onboarding flow", "Release notes"].map((label, index) => (
            <div key={label} className="flex items-center gap-2 border-b border-border pb-2 text-[9px] last:border-0">
              <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-contribution-high" : "bg-contribution-medium"}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    path: "/showcase/notes",
    number: "02",
    title: "A thinking workspace",
    description: "A composed notes workspace showing folders, connected writing, backlinks, and calm structure.",
    icon: FileText,
    accent: "bg-contribution-medium",
    preview: (
      <div className="flex h-full p-4">
        <div className="w-16 border border-border bg-muted/50 p-2">
          <div className="mb-3 h-2 w-9 bg-primary/70" />
          {["", "", "", ""].map((_, index) => <div key={index} className="mb-2 h-1.5 bg-muted-foreground/25" />)}
        </div>
        <div className="w-20 border-y border-border p-2">
          {["", "", ""].map((_, index) => <div key={index} className="mb-2 h-8 border-b border-border bg-background" />)}
        </div>
        <div className="flex-1 border border-border bg-background p-4">
          <div className="mb-3 font-display text-sm font-semibold">Launch Playbook</div>
          <div className="mb-2 h-1.5 w-full bg-muted" />
          <div className="mb-2 h-1.5 w-4/5 bg-muted" />
          <div className="mt-4 h-10 border-l-2 border-contribution-high bg-muted/60" />
        </div>
      </div>
    ),
  },
  {
    path: "/showcase/graph",
    number: "03",
    title: "Knowledge in motion",
    description: "The real graph experience, populated with a connected sample vault and ready to explore.",
    icon: Network,
    accent: "bg-contribution-low",
    preview: (
      <div className="relative h-full overflow-hidden p-4">
        <svg viewBox="0 0 300 120" className="h-full w-full" aria-hidden="true">
          <g stroke="currentColor" className="text-border" strokeWidth="1">
            <line x1="150" y1="60" x2="70" y2="25" /><line x1="150" y1="60" x2="235" y2="28" />
            <line x1="150" y1="60" x2="85" y2="96" /><line x1="150" y1="60" x2="226" y2="94" />
            <line x1="70" y1="25" x2="30" y2="68" /><line x1="235" y1="28" x2="270" y2="68" />
          </g>
          <g className="fill-primary">
            <circle cx="150" cy="60" r="10" /><circle cx="70" cy="25" r="6" /><circle cx="235" cy="28" r="7" />
          </g>
          <g className="fill-contribution-medium">
            <circle cx="85" cy="96" r="6" /><circle cx="226" cy="94" r="5" /><circle cx="30" cy="68" r="4" /><circle cx="270" cy="68" r="4" />
          </g>
        </svg>
      </div>
    ),
  },
];

const ShowcaseHub = () => {
  const navigate = useNavigate();

  return (
    <ShowcaseShell title="Screenshot Studio" backPath="/help" backLabel="Help">
      <main className="relative h-full overflow-y-auto px-6 py-8 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute right-8 top-3 font-display text-[13rem] font-bold leading-none tracking-tighter text-foreground/[0.025]">
          FF
        </div>

        <div className="relative mx-auto flex min-h-full max-w-[1320px] flex-col">
          <header className="mb-8 flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <Camera className="h-4 w-4" />
                Screenshot studio
              </div>
              <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.92] tracking-tighter sm:text-7xl">
                Show the work.<br />Keep the feeling.
              </h1>
            </div>
            <div className="max-w-sm pb-1">
              <Badge variant="outline" className="mb-3 gap-2 rounded-md font-normal">
                <Sparkles className="h-3.5 w-3.5" /> 1400 × 900 ready
              </Badge>
              <p className="font-accent text-lg italic leading-7 text-muted-foreground">
                Three deterministic scenes designed to make FocusFlow look as calm and capable as it feels.
              </p>
            </div>
          </header>

          <section className="grid flex-1 gap-5 lg:grid-cols-3">
            {scenes.map(({ path, number, title, description, icon: Icon, accent, preview }) => (
              <article key={path} className="group flex min-h-[380px] flex-col border border-border bg-card transition-transform duration-300 hover:-translate-y-1">
                <div className="relative h-40 overflow-hidden border-b border-border bg-muted/30">
                  <div className={`absolute left-0 top-0 h-1 w-full ${accent}`} />
                  {preview}
                  <span className="absolute right-3 top-3 font-display text-xs font-semibold text-muted-foreground">{number}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center border border-border bg-background">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  <div className="mt-5 flex gap-2">
                    <Button onClick={() => navigate(path)} className="flex-1 gap-2">
                      Open scene <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => navigate(`${path}?capture=1`)} title="Open in clean capture mode">
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <footer className="mt-7 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Choose a scene, select a theme, then enter clean capture mode.</span>
            <span className="hidden sm:inline">Press Esc to restore studio controls.</span>
          </footer>
        </div>
      </main>
    </ShowcaseShell>
  );
};

export default ShowcaseHub;
