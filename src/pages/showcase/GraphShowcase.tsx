import { CircleDot, Network, Sparkles } from "lucide-react";
import GraphView from "@/components/GraphView";
import { Badge } from "@/components/ui/badge";
import ShowcaseShell from "./ShowcaseShell";
import { showcaseFolders, showcaseNotes } from "./showcase-data";

const GraphShowcase = () => (
  <ShowcaseShell title="Knowledge in motion">
    <main className="relative flex h-full flex-col overflow-hidden px-8 py-7 sm:px-12">
      <header className="mb-5 flex shrink-0 items-end justify-between border-b border-border pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <Network className="h-3.5 w-3.5" /> Connected knowledge
          </div>
          <h1 className="font-display text-5xl font-bold leading-none tracking-tighter sm:text-6xl">Ideas become a system.</h1>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline" className="gap-2 rounded-md px-3 py-1.5 font-normal">
            <CircleDot className="h-3.5 w-3.5 text-contribution-high" /> 16 nodes · living vault
          </Badge>
          <Badge className="gap-2 rounded-md px-3 py-1.5 font-normal">
            <Sparkles className="h-3.5 w-3.5" /> Whole-vault graph
          </Badge>
        </div>
      </header>

      <section className="relative min-h-0 flex-1 overflow-hidden border border-border bg-card shadow-sm">
        <GraphView
          selectedNoteId="launch-playbook"
          notes={showcaseNotes}
          folders={showcaseFolders}
        />
        <div className="pointer-events-none absolute bottom-4 right-4 max-w-xs border border-border bg-background/90 px-4 py-3 text-xs shadow-lg backdrop-blur">
          <div className="font-display text-sm font-semibold">Launch Playbook</div>
          <p className="mt-1 leading-5 text-muted-foreground">
            Connected to the North Star, campaign systems, deep work, and the daily review.
          </p>
        </div>
      </section>
    </main>
  </ShowcaseShell>
);

export default GraphShowcase;
