import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

const shortcuts = [
  { keys: ["Ctrl", "N"], action: "New Note" },
  { keys: ["Ctrl", "Shift", "N"], action: "New Folder" },
  { keys: ["Ctrl", "Shift", "R"], action: "New Reminder" },
  { keys: ["Ctrl", "S"], action: "Save" },
  { keys: ["Ctrl", "K"], action: "Search" },
  { keys: ["Ctrl", "B"], action: "Toggle Folders Sidebar" },
  { keys: ["Ctrl", "L"], action: "Toggle Notes List" },
  { keys: ["Space"], action: "Start/Pause Timer (Notes)" },
  { keys: ["Ctrl", "Shift", "S"], action: "Save Timer Session" },
  { keys: ["Ctrl", "R"], action: "Reset Timer" },
  { keys: ["P", "H", "E"], action: "Annotation pen/highlighter/eraser" },
  { keys: ["V"], action: "Annotation select tool" },
  { keys: ["Delete"], action: "Delete selected annotation" },
  { keys: ["Ctrl", "L"], action: "Lock selected annotation" },
  { keys: ["Ctrl", "Z"], action: "Undo annotation change" },
  { keys: ["Ctrl", "Y"], action: "Redo annotation change" },
  { keys: ["Esc"], action: "Close Dialogs" },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const KeyboardShortcutsModal = ({ isOpen, onOpenChange }: KeyboardShortcutsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {shortcuts.map((shortcut, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <span className="font-body text-sm text-muted-foreground">
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
