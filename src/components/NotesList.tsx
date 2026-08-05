import { useMemo, useState, forwardRef, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNotes } from "@/contexts/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Trash2, Pin, PinOff, Search, FolderOpen, Star, Clock, Tag, X } from "lucide-react";
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
  tags?: string[];
  onClick: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleImportant: () => void;
  onDragStart?: (event: React.DragEvent) => void;
  onTagClick?: (tag: string) => void;
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
      tags,
      onClick,
      onDelete,
      onTogglePin,
      onToggleImportant,
      onDragStart,
      onTagClick,
      index,
    },
    ref
  ) => (
    <motion.div
      ref={ref}
      layout
      draggable
      onDragStart={onDragStart as any}
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
          {!!tags?.length && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {tags.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </button>
              ))}
              {tags.length > 4 && (
                <span className="text-[9px] text-muted-foreground/70">+{tags.length - 4}</span>
              )}
            </div>
          )}
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
    toggleNoteImportant,
    getSelectedFolder,
  } = useNotes();


  const folder = getSelectedFolder();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const folderNotes = useMemo(
    () => notes.filter((note) => getNoteFolderId(note) === String(selectedFolderId)),
    [notes, selectedFolderId]
  );

  const folderTags = useMemo(() => {
    const set = new Set<string>();
    folderNotes.forEach((note) => (note.tags || []).forEach((tag) => tag && set.add(tag)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [folderNotes]);

  const filteredNotes = useMemo(() => {
    let list = folderNotes;
    if (activeTag) {
      list = list.filter((n) =>
        (n.tags || []).some((tag) => tag.toLowerCase() === activeTag.toLowerCase())
      );
    }
    const raw = query.trim().toLowerCase();
    if (!raw) return list;

    // "#tag" style queries search tags only
    if (raw.startsWith("#")) {
      const tagQuery = raw.slice(1);
      if (!tagQuery) return list;
      return list.filter((n) => (n.tags || []).some((tag) => tag.toLowerCase().includes(tagQuery)));
    }

    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(raw) ||
        (n.content || "").toLowerCase().includes(raw) ||
        (n.tags || []).some((tag) => tag.toLowerCase().includes(raw))
    );
  }, [folderNotes, query, activeTag]);


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
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes or #tag..."
          className="h-8 text-xs pl-8"
        />
      </div>

      {/* Tag filters */}
      {folderTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {folderTags.slice(0, 12).map((tag) => {
            const active = activeTag?.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(active ? null : tag)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 text-muted-foreground border-transparent hover:border-primary/40"
                )}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            );
          })}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          )}
        </div>
      )}


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
                const updated = new Date((note as any).updatedAt || (note as any).createdAt || 0).getTime();
                const isRecent = Date.now() - updated < 48 * 3600 * 1000;
                return (
                  <NoteRow
                    key={id}
                    title={note.title}
                    snippet={stripMarkdown(note.content || "").slice(0, 80)}
                    updatedAt={(note as any).updatedAt}
                    pinned={Boolean((note as any).pinned)}
                    important={Boolean((note as any).important)}
                    isRecent={isRecent}
                    isSelected={id === String(selectedNoteId)}
                    onClick={() => selectNote(id || null)}
                    onDelete={() => deleteNote(id)}
                    onTogglePin={() => toggleNotePinned(id, !(note as any).pinned)}
                    onToggleImportant={() => toggleNoteImportant(id, !(note as any).important)}
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
