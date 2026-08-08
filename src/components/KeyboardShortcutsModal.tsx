import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

const shortcutGroups: { group: string; items: { keys: string[]; action: string }[] }[] = [
  {
    group: "Navigation",
    items: [
      { keys: ["Alt", "1"], action: "Go to Dashboard" },
      { keys: ["Alt", "2"], action: "Go to Notes" },
      { keys: ["Alt", "3"], action: "Go to Canvas" },
      { keys: ["Alt", "0"], action: "Open Help page" },
      { keys: ["?"], action: "Show this shortcuts panel" },
      { keys: ["Esc"], action: "Close dialogs / collapse panel" },
    ],
  },
  {
    group: "Dashboard",
    items: [
      { keys: ["Ctrl", "J"], action: "New Task" },
      { keys: ["Ctrl", "Shift", "R"], action: "New Reminder" },
      { keys: ["Ctrl", "Shift", "T"], action: "Cycle color theme" },
      { keys: ["Space"], action: "Start / pause timer" },
      { keys: ["Ctrl", "R"], action: "Reset timer" },
      { keys: ["Ctrl", "Shift", "S"], action: "Save timer session" },
    ],
  },
  {
    group: "Notes",
    items: [
      { keys: ["Ctrl", "N"], action: "New Note" },
      { keys: ["Ctrl", "Shift", "N"], action: "New Folder" },
      { keys: ["Ctrl", "S"], action: "Save note" },
      { keys: ["Ctrl", "K"], action: "Command palette / search" },
      { keys: ["Ctrl", "B"], action: "Toggle folders sidebar" },
      { keys: ["Ctrl", "L"], action: "Toggle notes list" },
      { keys: ["Ctrl", "Shift", "E"], action: "Toggle editor / preview" },
      { keys: ["Ctrl", "Shift", "I"], action: "Toggle Important mark" },
      { keys: ["Ctrl", "Shift", "H"], action: "Toggle highlight (banner) style" },
    ],
  },
  {
    group: "Annotations",
    items: [
      { keys: ["P"], action: "Pen" },
      { keys: ["H"], action: "Highlighter" },
      { keys: ["E"], action: "Eraser" },
      { keys: ["L"], action: "Line" },
      { keys: ["R"], action: "Rectangle" },
      { keys: ["C"], action: "Circle" },
      { keys: ["T"], action: "Text" },
      { keys: ["V"], action: "Select / move" },
      { keys: ["Delete"], action: "Delete selection" },
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Y"], action: "Redo" },
    ],
  },
];


interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const KeyboardShortcutsModal = ({ isOpen, onOpenChange }: KeyboardShortcutsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-4">
          {shortcutGroups.map(({ group, items }) => (
            <div key={group}>
              <h3 className="mb-1 font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {group}
              </h3>
              <div className="space-y-1">
                {items.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 py-1.5 border-b border-border last:border-0"
                  >
                    <span className="font-body text-sm text-foreground/80">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          On macOS, use <kbd className="px-1 py-0.5 text-xs font-mono bg-muted border border-border rounded-sm">⌘</kbd> instead of <kbd className="px-1 py-0.5 text-xs font-mono bg-muted border border-border rounded-sm">Ctrl</kbd>
        </p>
      </DialogContent>
    </Dialog>
  );
};

export const KeyboardShortcutsButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground"
      title="Keyboard Shortcuts"
    >
      <Keyboard className="h-4 w-4 mr-1" />
      <span className="text-xs">Shortcuts</span>
    </Button>
  );
};

export default KeyboardShortcutsModal;
