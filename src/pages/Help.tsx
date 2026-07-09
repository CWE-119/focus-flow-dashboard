import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Brush,
  CheckSquare,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Keyboard,
  Link2,
  Network,
  Palette,
  Timer,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const sections = [
  {
    title: "Focus Dashboard",
    icon: Timer,
    items: [
      "Focus timer with active-session tracking.",
      "Live clock, audio visualizer, productivity tips, and session stats.",
      "Contribution grid for daily activity history.",
      "Theme switching for light and dark work sessions.",
    ],
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    items: [
      "Create quick tasks and full tasks with details.",
      "Edit existing tasks without deleting and recreating them.",
      "Mark tasks complete and keep the dashboard focused on current work.",
    ],
  },
  {
    title: "Reminders",
    icon: Bell,
    items: [
      "Create reminders from the dashboard.",
      "Reminder list keeps upcoming work visible.",
      "Keyboard shortcut support for fast reminder capture.",
    ],
  },
  {
    title: "Notes",
    icon: FileText,
    items: [
      "Folder-based notes with Markdown editing and preview.",
      "Autosave status with relative saved time, exact timestamp tooltip, and persisted offline draft queueing.",
      "Conflict detection warns when a note changed in another window before saving.",
      "Version history lets you restore earlier note snapshots.",
      "LaTeX math, syntax-highlighted code blocks, images, video embeds, and paper backgrounds.",
      "Draw annotations directly over the preview with pen, highlighter, shapes, text, select/move, lock, visibility, layers, undo, and redo.",
      "Markdown folder import/export preserves annotation sidecars next to notes.",
      "Pin notes, reopen recent notes, create daily notes, and start from templates.",
    ],
  },
  {
    title: "Diagrams",
    icon: Network,
    items: [
      "Mermaid code fences render as diagrams in preview.",
      "DBML code fences render into a database relationship view.",
      "Diagram blocks stay readable inside normal Markdown notes.",
    ],
  },
  {
    title: "Linking",
    icon: Link2,
    items: [
      "Use [[Page]] to link to another note.",
      "Use [[Folder]] to open a folder.",
      "Use [[Folder/Page]] to open or create a page inside a folder.",
      "Backlinks, outgoing links, missing links, and unlinked mentions are shown from the editor links menu.",
      "Click an unlinked mention to jump to the source note that mentions the current note title.",
    ],
  },
  {
    title: "Graph View",
    icon: Network,
    items: [
      "Obsidian-style graph view maps notes and links.",
      "Search the graph, filter by folder, show or hide orphan notes, and switch to local graph mode.",
      "Scroll to zoom, drag the canvas to pan, and drag nodes to arrange them.",
      "Click a node to pin focus and double click a node to open the source note.",
      "Hover nodes to preview note content.",
      "Ghost nodes show linked pages that do not exist yet.",
    ],
  },
  {
    title: "Import And Export",
    icon: Download,
    items: [
      "Export notes as a Markdown folder for backup or Obsidian-style workflows.",
      "Import Markdown folders and preserve folder structure.",
      "Imported note titles are de-duplicated instead of overwriting existing notes.",
    ],
  },
  {
    title: "Canvas",
    icon: Brush,
    items: [
      "Open the freeform canvas from the notes header.",
      "Sketch, arrange visual ideas, and keep visual planning separate from notes.",
    ],
  },
  {
    title: "Shortcuts",
    icon: Keyboard,
    items: [
      "Use the keyboard shortcuts button on the dashboard to view available shortcuts.",
      "Use Ctrl+K or Cmd+K in Notes to open the command palette and fast note switcher.",
      "Notes panels can be toggled quickly while writing.",
      "The editor includes a block insert menu for headings, tasks, tables, Mermaid, DBML, and callouts.",
      "Annotation tools include single-key tool shortcuts while annotation mode is active.",
    ],
  },
];

const quickActions = [
  { label: "Open Notes", icon: FileText, path: "/notes" },
  { label: "Open Canvas", icon: Palette, path: "/canvas" },
  { label: "Dashboard", icon: Clock, path: "/" },
];

const Help = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-8">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Help
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tighter sm:text-5xl">
              FocusFlow Features
            </h1>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <section className="mb-8 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              A quick map of what the app can do right now: focus sessions, tasks, reminders,
              Markdown notes, diagrams, graph view, folder links, import/export, and canvas work.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map(({ label, icon: Icon, path }) => (
              <Button key={path} variant="outline" size="sm" className="gap-2" onClick={() => navigate(path)}>
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map(({ title, icon: Icon, items }) => (
            <article key={title} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-border bg-muted/35 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <h2 className="text-sm font-medium">Obsidian-Friendly Notes</h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            For the most portable notes, write regular Markdown, use wiki links like [[Folder/Page]],
            and export the vault from the notes header when you want a folder backup.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Help;
