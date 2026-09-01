import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGlossary } from "@/hooks/use-glossary";
import { Plus, Trash2, BookMarked } from "lucide-react";

interface GlossaryManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlossaryManager = ({ isOpen, onOpenChange }: GlossaryManagerProps) => {
  const { terms, addTerm, updateTerm, removeTerm } = useGlossary();
  const [term, setTerm] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!term.trim()) {
      setError("Enter a word first");
      return;
    }
    if (!addTerm(term, description)) {
      setError("That word is already defined");
      return;
    }
    setTerm("");
    setDescription("");
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-xl">
            <BookMarked className="h-5 w-5" /> Noted words
          </DialogTitle>
          <DialogDescription>
            Defined words are highlighted everywhere — notes, tasks and reminders. Hover to read the meaning.
            Override a single occurrence with <code className="font-mono">{"{{word|meaning here}}"}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setError(null);
            }}
            placeholder="Word or phrase"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does it mean?"
            className="min-h-[70px] resize-none"
          />
          {error && <p className="font-body text-xs text-destructive">{error}</p>}
          <Button onClick={handleAdd} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add word
          </Button>
        </div>

        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {terms.length === 0 && (
            <p className="py-6 text-center font-body text-sm text-muted-foreground">
              No noted words yet
            </p>
          )}
          {terms.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <Input
                  value={entry.term}
                  onChange={(e) => updateTerm(entry.id, { term: e.target.value })}
                  className="h-7 font-body text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTerm(entry.id)}
                  title="Delete word"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={entry.description}
                onChange={(e) => updateTerm(entry.id, { description: e.target.value })}
                className="mt-1 min-h-[52px] resize-none text-xs"
                placeholder="Meaning"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlossaryManager;
