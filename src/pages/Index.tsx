import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Timer from "@/components/Timer";
import Clock from "@/components/Clock";
import TodoList from "@/components/TodoList";
import RemindersList from "@/components/RemindersList";
import ContributionGrid from "@/components/ContributionGrid";
import Stats from "@/components/Stats";
import AudioVisualizer from "@/components/AudioVisualizer";
import KeyboardShortcutsModal, { KeyboardShortcutsButton } from "@/components/KeyboardShortcutsModal";
import { ReminderForm } from "@/components/ReminderForm";
import { RemindersProvider } from "@/contexts/RemindersContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ActiveTimerIndicator } from "@/components/ActiveTimerIndicator";
import { Button } from "@/components/ui/button";
import { HelpCircle, NotebookPen, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

const PANEL_TRANSITION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };

const IndexContent = () => {
  const navigate = useNavigate();
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [expanded, setExpanded] = useState<"tasks" | "reminders" | null>(null);

  useKeyboardShortcuts({
    onNewReminder: () => setReminderFormOpen(true),
  });

  return (
    <div className="min-h-screen bg-background pt-8 p-4 sm:p-8 md:p-12 lg:p-16">
      {/* Header */}
      <header className="mb-8 md:mb-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate("/notes")}
              title="Open Notes"
              aria-label="Open the notes section"
              className="group relative block text-left focus:outline-none"
            >
              {/* Corner brackets */}
              <span className="pointer-events-none absolute -left-3 -top-3 h-4 w-4 border-l-2 border-t-2 border-primary opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 md:-left-4 md:-top-4 md:h-6 md:w-6" />
              <span className="pointer-events-none absolute -bottom-3 -right-3 h-4 w-4 border-b-2 border-r-2 border-primary opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 md:-bottom-4 md:-right-4 md:h-6 md:w-6" />

              <span className="relative block">
                {/* Base layer */}
                <h1 className="relative font-display text-5xl font-bold leading-none tracking-tighter text-foreground transition-colors duration-500 group-hover:text-muted-foreground/50 group-focus-visible:text-muted-foreground/50 sm:text-6xl md:text-8xl lg:text-9xl">
                  {LETTERS.map((letter, i) => (
                    <span
                      key={i}
                      className="inline-block transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-3deg] group-focus-visible:-translate-y-2"
                      style={{ transitionDelay: `${i * 55}ms` }}
                    >
                      {letter}
                    </span>
                  ))}
                </h1>

                {/* Accent layer wiping in over the base */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 font-display text-5xl font-bold leading-none tracking-tighter text-primary [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-[700ms] ease-out group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)] sm:text-6xl md:text-8xl lg:text-9xl"
                >
                  {LETTERS.map((letter, i) => (
                    <span
                      key={i}
                      className="inline-block transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-3deg] group-focus-visible:-translate-y-2"
                      style={{ transitionDelay: `${i * 55}ms` }}
                    >
                      {letter}
                    </span>
                  ))}
                </span>
              </span>

              {/* Sweeping rule */}
              <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-primary transition-transform duration-[600ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" />

              {/* Notes hint chip */}
              <span className="pointer-events-none absolute -top-1 left-full ml-3 hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-body text-[11px] uppercase tracking-[0.2em] text-primary opacity-0 transition-all duration-500 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:flex md:-translate-x-4">
                <NotebookPen className="h-3.5 w-3.5" />
                Notes
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-accent text-lg italic text-muted-foreground sm:text-xl md:text-2xl">
                Track your productivity
              </p>
              <button
                type="button"
                onClick={() => navigate("/notes")}
                className="group/hint inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-primary"
              >
                <span className="h-px w-4 bg-current transition-all duration-300 group-hover/hint:w-7" />
                Open notes
                <ArrowUpRight className="h-3 w-3 transition-transform duration-300 group-hover/hint:translate-x-0.5 group-hover/hint:-translate-y-0.5" />
              </button>
            </div>
          </div>


          <div className="flex items-center gap-2 pt-2">
            <ActiveTimerIndicator />
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 items-stretch">
        {/* Left Column - Timer, Clock & Visualizer */}
        <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <Timer />
          <Clock />
          <div className="flex-1 min-h-[220px] [&>*]:h-full">
            <AudioVisualizer />
          </div>
        </div>

        {/* Right Column - Todo, Reminders & Stats */}
        <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 lg:gap-6 min-h-0">
          <LayoutGroup>
            <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6 flex-1 min-h-0">
              <AnimatePresence initial={false} mode="popLayout">
                {expanded !== "reminders" && (
                  <motion.div
                    key="tasks"
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={PANEL_TRANSITION}
                    className="flex-1 min-h-0"
                  >
                    <TodoList
                      expanded={expanded === "tasks"}
                      onToggleExpand={() => setExpanded(expanded === "tasks" ? null : "tasks")}
                    />
                  </motion.div>
                )}
                {expanded !== "tasks" && (
                  <motion.div
                    key="reminders"
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={PANEL_TRANSITION}
                    className="flex-1 min-h-0"
                  >
                    <RemindersList
                      expanded={expanded === "reminders"}
                      onToggleExpand={() => setExpanded(expanded === "reminders" ? null : "reminders")}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>

          <AnimatePresence initial={false}>
            {expanded === null && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={PANEL_TRANSITION}
                className="overflow-hidden shrink-0"
              >
                <Stats />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Contribution Grid - Full Width */}
      <div className="mt-5 sm:mt-6 lg:mt-8">
        <ContributionGrid />
      </div>

      {/* Footer */}
      <footer className="mt-8 sm:mt-12 lg:mt-16 pt-6 sm:pt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="font-body text-xs sm:text-sm text-muted-foreground">
            Built with intention. Stay focused.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/help")} title="Help">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <KeyboardShortcutsButton onClick={() => setShortcutsOpen(true)} />
          </div>
        </div>
      </footer>

      <KeyboardShortcutsModal isOpen={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <ReminderForm isOpen={reminderFormOpen} onOpenChange={setReminderFormOpen} />
    </div>
  );
};

const Index = () => {
  return (
    <RemindersProvider>
      <IndexContent />
    </RemindersProvider>
  );
};

export default Index;
