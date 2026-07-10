import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Timer from "@/components/Timer";
import Clock from "@/components/Clock";
import TodoList from "@/components/TodoList";
import RemindersList from "@/components/RemindersList";
import ContributionGrid from "@/components/ContributionGrid";
import Stats from "@/components/Stats";
import AudioVisualizer from "@/components/AudioVisualizer";
import ProductivityTips from "@/components/ProductivityTips";
import KeyboardShortcutsModal, { KeyboardShortcutsButton } from "@/components/KeyboardShortcutsModal";
import { ReminderForm } from "@/components/ReminderForm";
import { RemindersProvider } from "@/contexts/RemindersContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ActiveTimerIndicator } from "@/components/ActiveTimerIndicator";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

const IndexContent = () => {
  const navigate = useNavigate();
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onNewReminder: () => setReminderFormOpen(true),
  });

  return (
    <div className="min-h-screen bg-background pt-8 p-4 sm:p-8 md:p-12 lg:p-16">
      {/* Header */}
      <header className="mb-8 md:mb-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 
              className="font-display text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-foreground leading-none cursor-pointer hover:text-muted-foreground transition-colors"
              onClick={() => navigate("/notes")}
              title="Go to Notes"
            >
              FOCUS
            </h1>
            <p className="font-accent text-lg sm:text-xl md:text-2xl text-muted-foreground mt-2 italic">
              Track your productivity
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <ActiveTimerIndicator />
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6">
        {/* Left Column - Timer, Clock & Visualizer */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 lg:space-y-6">
          <Timer />
          <Clock />
          <AudioVisualizer />
        </div>

        {/* Right Column - Todo, Reminders, Stats & Tips */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 lg:space-y-6">
          <TodoList />
          <RemindersList />
          <Stats />
          <ProductivityTips />
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
