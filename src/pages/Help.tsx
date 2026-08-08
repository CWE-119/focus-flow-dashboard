import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Brush,
  Camera,
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
      "Focus timer with active-session tracking; the active session stays visible in the header while you move around.",
      "Live clock, session stats, and a contribution grid of your daily activity history.",
      "Audio visualizer with two modes: classic frequency bars and an ASCII-style fire grid that reacts to playing music.",
      "Tasks and Reminders stack in the right column with matching heights; use each panel's expand button to fill the column.",
      "Twelve color themes; cycle them from the footer toggle or with Ctrl/Cmd+Shift+T.",
    ],
  },
  {
    title: "Tasks And Categories",
    icon: CheckSquare,
    items: [
      "Quick-add a task by typing in the inline field, or open the full form for details, due date, priority, and recurrence.",
      "Assign a category to any task; category pills show on each row.",
      "Manage categories (add, rename, recolor, delete) from the category manager in the tasks panel.",
      "Filter today's tasks by category with the chip bar above the list.",
      "Edit or complete tasks in place — no need to delete and recreate.",
    ],
  },
  {
    title: "Reminders",
    icon: Bell,
    items: [
      "Create reminders from the dashboard or with Ctrl/Cmd+Shift+R anywhere on the dashboard.",
      "Upcoming reminders stay listed under the tasks panel.",
      "Reminder popups surface work when it becomes due.",
    ],
  },
  {
    title: "Notes",
    icon: FileText,
    items: [
      "Folder-based notes with Markdown editing and live preview.",
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
    title: "Organizing Notes",
    icon: Network,
    items: [
      "Folders nest freely: every folder can hold subfolders, shown as a collapsible tree.",
      "Drag a note onto any folder to move it; drag top-level folders to reorder them.",
      "Rename folders inline in the sidebar — empty, overlong, and duplicate sibling names are rejected with a message.",
      "Mark notes Important (amber star) and spot anything edited in the last 48 hours via the Recent badge.",
      "Add tags to a note from the editor header; tag chips show in the list and #tag search filters by them.",
    ],
  },
  {
    title: "Highlight Style",
    icon: Brush,
    items: [
      "Toggle the highlighter button in the editor toolbar (or Ctrl/Cmd+Shift+H) for banner-style formatting.",
      "Headings render as full-width colored banners with a trailing arrow.",
      "Bullets become circular chevron badges and ordered lists get numbered pills.",
      "The choice is remembered between sessions.",
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
    icon: Palette,
    items: [
      "Open the freeform canvas from the notes header or with Alt+3.",
      "Sketch, arrange visual ideas, and keep visual planning separate from notes.",
      "Canvas work is standalone and never mixes into the focus dashboard.",
    ],
  },
];

const shortcutGroups = [
  {
    group: "Navigation",
    items: [
      ["Alt + 1", "Dashboard"],
      ["Alt + 2", "Notes"],
      ["Alt + 3", "Canvas"],
      ["Alt + 0", "Help page"],
      ["?", "Shortcuts panel"],
      ["Esc", "Close dialog / collapse panel"],
    ],
  },
  {
    group: "Dashboard",
    items: [
      ["Ctrl + J", "New task"],
      ["Ctrl + Shift + R", "New reminder"],
      ["Ctrl + Shift + T", "Cycle color theme"],
      ["Space", "Start / pause timer"],
      ["Ctrl + R", "Reset timer"],
      ["Ctrl + Shift + S", "Save timer session"],
    ],
  },
  {
    group: "Notes",
    items: [
      ["Ctrl + N", "New note"],
      ["Ctrl + Shift + N", "New folder"],
      ["Ctrl + S", "Save note"],
      ["Ctrl + K", "Command palette"],
      ["Ctrl + B", "Toggle folders sidebar"],
      ["Ctrl + L", "Toggle notes list"],
      ["Ctrl + Shift + E", "Editor / preview"],
      ["Ctrl + Shift + I", "Toggle Important"],
      ["Ctrl + Shift + H", "Toggle highlight style"],
    ],
  },
  {
    group: "Annotations",
    items: [
      ["P / H / E", "Pen / highlighter / eraser"],
      ["L / R / C", "Line / rectangle / circle"],
      ["T / V", "Text / select"],
      ["Delete", "Delete selection"],
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Y", "Redo"],
    ],
  },
];

const quickActions = [
  { label: "Open Notes", icon: FileText, path: "/notes" },
  { label: "Open Canvas", icon: Palette, path: "/canvas" },
  { label: "Screenshot Studio", icon: Camera, path: "/showcase" },
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

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <h2 className="font-display text-2xl font-semibold tracking-tight">Keyboard Shortcuts</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            On macOS use <kbd className="rounded-sm border border-border bg-muted px-1 py-0.5 font-mono text-xs">⌘</kbd> in place of Ctrl.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {shortcutGroups.map(({ group, items }) => (
              <article key={group} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h3 className="mb-2 font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {group}
                </h3>
                <ul className="text-sm">
                  {items.map(([keys, action]) => (
                    <li
                      key={keys}
                      className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-0"
                    >
                      <span className="text-muted-foreground">{action}</span>
                      <kbd className="whitespace-nowrap rounded-sm border border-border bg-muted px-2 py-1 font-mono text-xs">
                        {keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
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
