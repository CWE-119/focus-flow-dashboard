import { useMemo, useState, forwardRef, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNotes } from "@/contexts/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Trash2, Pin, PinOff, Search, FolderOpen, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNoteFolderId, getNoteId } from "@/lib/note-links";

interface NoteRowProps {
  title: string;
  snippet: string;
  updatedAt?: string | Date;
  pinned?: boolean;
  important?: boolean;
  isRecent?: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleImportant: () => void;
  index: number;
}


const formatUpdated = (value?: string | Date) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day && d.getDate() === new Date().getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const stripMarkdown = (content: string) =>
  content
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();

const NoteRow = forwardRef<HTMLDivElement, NoteRowProps>(
  (
    {
      title,
      snippet,
      updatedAt,
      pinned,
      important,
      isRecent,
      isSelected,
      onClick,
      onDelete,
      onTogglePin,
      onToggleImportant,
      index,
    },
    ref
  ) => (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.15) }}
      className={cn(
        "group relative px-3 py-2 rounded-md cursor-pointer transition-colors border border-transparent",
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "hover:bg-muted/60",
        important && !isSelected && "bg-amber-500/5"
      )}
      onClick={onClick}
    >
      {important && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-amber-500" />
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {pinned && <Pin className="w-3 h-3 flex-shrink-0 text-primary fill-primary" />}
            {important && <Star className="w-3 h-3 flex-shrink-0 text-amber-500 fill-amber-500" />}
            <span className="text-sm font-body font-medium truncate">{title || "Untitled"}</span>
          </div>
          {snippet && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{snippet}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {formatUpdated(updatedAt)}
            </span>
            {isRecent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-primary">
                <Clock className="w-2.5 h-2.5" /> Recent
              </span>
            )}
            {important && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Important
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", important && "text-amber-500 hover:text-amber-500")}
            title={important ? "Unmark important" : "Mark important"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleImportant();
            }}
          >
            <Star className={cn("w-3 h-3", important && "fill-amber-500")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={pinned ? "Unpin" : "Pin"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
          >
            {pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
);

NoteRow.displayName = "NoteRow";

const NotesList = () => {
  const {
    selectedFolderId,
    selectedNoteId,
    notes,
    createNote,
    deleteNote,
    selectNote,
    toggleNotePinned,
    getSelectedFolder,
  } = useNotes();

  const folder = getSelectedFolder();
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const filteredNotes = useMemo(() => {
    const inFolder = notes.filter(
      (note) => getNoteFolderId(note) === String(selectedFolderId)
    );
    const q = query.trim().toLowerCase();
    if (!q) return inFolder;
    return inFolder.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.content || "").toLowerCase().includes(q)
    );
  }, [notes, selectedFolderId, query]);

  const handleCreateNote = async () => {
    if (selectedFolderId) await createNote("Untitled", "");
  };

  if (!selectedFolderId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm px-4 text-center gap-2">
        <FolderOpen className="w-8 h-8 opacity-40" />
        <p>Select a folder to view notes</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-lg truncate">
            {folder?.name || "Notes"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateNote}
          title="New Note"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="h-8 text-xs pl-8"
        />
      </div>

      {/* Notes List */}
      <div
        ref={listRef}
        className="sidebar-scroll flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1"
      >
        <AnimatePresence mode="popLayout">
          {filteredNotes.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground text-sm text-center py-8 flex flex-col items-center gap-2"
            >
              <FileText className="w-6 h-6 opacity-40" />
              <span>{query ? "No matches" : "No notes yet"}</span>
              {!query && (
                <Button variant="outline" size="sm" onClick={handleCreateNote} className="mt-1 gap-1">
                  <Plus className="w-3 h-3" /> New note
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-1">
              {filteredNotes.map((note, index) => {
                const id = getNoteId(note);
                return (
                  <NoteRow
                    key={id}
                    title={note.title}
                    snippet={stripMarkdown(note.content || "").slice(0, 80)}
                    updatedAt={(note as any).updatedAt}
                    pinned={Boolean((note as any).pinned)}
                    isSelected={id === String(selectedNoteId)}
                    onClick={() => selectNote(id || null)}
                    onDelete={() => deleteNote(id)}
                    onTogglePin={() => toggleNotePinned(id, !(note as any).pinned)}
                    index={index}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotesList;
