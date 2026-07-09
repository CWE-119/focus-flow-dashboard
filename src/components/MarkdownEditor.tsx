import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Video,
  Eye,
  EyeOff,
  Edit,
  Check,
  Grid3X3,
  Download,
  PenTool,
  Pen,
  Highlighter,
  Eraser,
  Minus,
  Square,
  Circle,
  Type,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Link2,
  PlusCircle,
  FolderOpen,
  Search,
  AlertCircle,
  History,
  Focus,
  Wand2,
  Table,
  CheckSquare,
  GitBranch,
  Database,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDebounceWithStatus } from "@/hooks/use-debounce";
import { PaperBackground, PatternPreview, paperPatterns, type PaperPattern, getPatternStyle } from "@/components/ui/paper-background";
import NoteTimer from "@/components/NoteTimer";
import { LatexTemplates } from "@/components/editor/LatexTemplates";
import { CodeBlock, InlineCode } from "@/components/editor/CodeBlock";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { AnnotationOverlay } from "@/components/editor/AnnotationOverlay";
import { useAnnotations, AnnotationTool } from "@/components/editor/useAnnotations";
import { toast } from "sonner";
import {
  getFolderId,
  getBacklinks,
  getNoteFolderId,
  getNoteId,
  getUnlinkedMentions,
  normalizeNoteTitle,
  renderableMarkdownWithWikiLinks,
  resolveWikiLinks,
  resolveWikiTarget,
  type LinkableFolder,
  type LinkableNote,
  type ResolvedWikiLink,
} from "@/lib/note-links";

interface MarkdownEditorProps {
  content: string;
  title: string;
  noteId: string;
  allNotes?: LinkableNote[];
  folders?: LinkableFolder[];
  onOpenNote?: (noteId: string, folderId?: string) => void;
  onOpenFolder?: (folderId: string) => void;
  onCreateLinkedNote?: (title: string, folderId?: string) => Promise<string | null>;
  onTogglePinned?: (pinned: boolean) => Promise<void>;
  getIndexedReferences?: (noteId: string) => Promise<ApiIndexedReferences | null>;
  getNoteVersions?: (noteId: string) => Promise<NoteVersion[]>;
  onRestoreVersion?: (noteId: string, versionId: string) => Promise<void>;
  onContentChange: (content: string) => void | boolean | Promise<void | boolean>;
  onTitleChange: (title: string) => void;
}

interface NoteVersion {
  id: string | number;
  title: string;
  content: string;
  revision?: number;
  savedAt?: string;
}

interface IndexedReferences {
  backlinks: LinkableNote[];
  outgoingLinks: ResolvedWikiLink[];
  missingLinks: ResolvedWikiLink[];
  unlinkedMentions: Array<{ note: LinkableNote; count: number; excerpt: string }>;
}

interface ApiIndexedReferences {
  backlinks: LinkableNote[];
  outgoingLinks: Array<{ target: string; type: "note"; note: LinkableNote }>;
  missingLinks: Array<{ target: string; type: "missing" }>;
  unlinkedMentions: Array<{ note: LinkableNote; count: number; excerpt: string }>;
}

const ANNOTATION_TOOLS: { id: AnnotationTool; icon: typeof Pen; label: string; shortcut: string }[] = [
  { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlighter', shortcut: 'H' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'C' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'pan', icon: Hand, label: 'Select', shortcut: 'V' },
];

const ANNOTATION_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const indexedNoteLink = (target: string, note: LinkableNote): ResolvedWikiLink => ({
  raw: target,
  target,
  normalizedTarget: normalizeNoteTitle(target),
  type: "note",
  note,
  createTitle: target,
});

const indexedMissingLink = (target: string): ResolvedWikiLink => ({
  raw: target,
  target,
  normalizedTarget: normalizeNoteTitle(target),
  type: "missing",
  createTitle: target,
});

const MarkdownEditor = ({
  content,
  title,
  noteId,
  allNotes = [],
  folders = [],
  onOpenNote,
  onOpenFolder,
  onCreateLinkedNote,
  onTogglePinned,
  getIndexedReferences,
  getNoteVersions,
  onRestoreVersion,
  onContentChange,
  onTitleChange
}: MarkdownEditorProps) => {
  const [isPreview, setIsPreview] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [indexedReferences, setIndexedReferences] = useState<IndexedReferences | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [localContent, setLocalContent] = useState(content || "");
  const [paperPattern, setPaperPattern] = useState<PaperPattern>(() => {
    const saved = localStorage.getItem("editor-paper-pattern");
    return (saved as PaperPattern) || "none";
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentToBackendRef = useRef<string>(content || "");
  const currentNoteIdRef = useRef(noteId);
  const trashHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [trashHolding, setTrashHolding] = useState(false);
  const currentNote = useMemo<LinkableNote>(() => ({
    ...(allNotes.find((note) => getNoteId(note) === noteId) || { id: noteId, _id: noteId, title }),
    title,
    content: localContent,
  }), [allNotes, noteId, title, localContent]);
  const fallbackBacklinks = useMemo(() => getBacklinks(allNotes, currentNote, folders), [allNotes, currentNote, folders]);
  const fallbackOutgoingLinks = useMemo(() => resolveWikiLinks(allNotes, folders, localContent), [allNotes, folders, localContent]);
  const fallbackBrokenLinks = useMemo(() => fallbackOutgoingLinks.filter((link) => link.type === "missing"), [fallbackOutgoingLinks]);
  const fallbackUnlinkedMentions = useMemo(
    () => getUnlinkedMentions(allNotes, currentNote, folders),
    [allNotes, currentNote, folders]
  );
  const backlinks = indexedReferences?.backlinks || fallbackBacklinks;
  const outgoingLinks = indexedReferences?.outgoingLinks || fallbackOutgoingLinks;
  const brokenLinks = indexedReferences?.missingLinks || fallbackBrokenLinks;
  const unlinkedMentions = indexedReferences?.unlinkedMentions || fallbackUnlinkedMentions;
  const referenceCount = backlinks.length + unlinkedMentions.length + brokenLinks.length;
  const renderedContent = useMemo(() => renderableMarkdownWithWikiLinks(localContent), [localContent]);

  // Annotation state
  const ann = useAnnotations(noteId);

  // Memoize the save callback to prevent unnecessary debounce re-triggers
  const handleSave = useCallback(async (debouncedContent: string) => {
    if (debouncedContent !== lastSentToBackendRef.current) {
      const result = await onContentChange(debouncedContent);
      if (result === false) return false;
      lastSentToBackendRef.current = debouncedContent;
    }
    return true;
  }, [onContentChange]);

  // Debounce content changes with status tracking
  const saveStatus = useDebounceWithStatus(
    localContent, 
    500, 
    handleSave,
    content || "",
    `focusflow:note-draft:${noteId}`
  );

  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  // When switching to a different note, reset localContent
  useEffect(() => {
    if (noteId !== currentNoteIdRef.current) {
      currentNoteIdRef.current = noteId;
      setLocalContent(content || "");
      lastSentToBackendRef.current = content || "";
    }
  }, [noteId, content]);

  useEffect(() => {
    localStorage.setItem("editor-paper-pattern", paperPattern);
  }, [paperPattern]);

  useEffect(() => {
    let cancelled = false;
    setIndexedReferences(null);
    if (!getIndexedReferences || !noteId) return;
    getIndexedReferences(noteId).then((references) => {
      if (!cancelled && references) {
        setIndexedReferences({
          backlinks: references.backlinks,
          outgoingLinks: references.outgoingLinks.map((link) => indexedNoteLink(link.target, link.note)),
          missingLinks: references.missingLinks.map((link) => indexedMissingLink(link.target)),
          unlinkedMentions: references.unlinkedMentions,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getIndexedReferences, noteId, localContent]);

  // Annotation keyboard shortcuts (only when annotation mode is active)
  useEffect(() => {
    if (!annotationMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      const keyMap: Record<string, AnnotationTool> = {
        p: 'pen', h: 'highlighter', e: 'eraser', l: 'line',
        r: 'rect', c: 'circle', t: 'text', v: 'pan',
      };
      if (!ctrl && keyMap[k]) {
        e.preventDefault();
        ann.setTool(keyMap[k]);
        return;
      }

      if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); ann.undo(); }
      if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); ann.redo(); }
      if (ctrl && k === 'l' && ann.selectedAnnotationId) {
        e.preventDefault();
        ann.toggleSelectedLocked();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ann.selectedAnnotationId && !ann.selectedAnnotation?.locked && !ann.annotationsLocked) {
          e.preventDefault();
          ann.deleteAnnotation(ann.selectedAnnotationId);
          ann.setSelectedAnnotationId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [annotationMode, ann]);

  const insertMarkdown = useCallback((before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newContent = 
      localContent.substring(0, start) + 
      before + textToInsert + after + 
      localContent.substring(end);
    
    setLocalContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [localContent]);

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown("**", "**", "bold"), title: "Bold" },
    { icon: Italic, action: () => insertMarkdown("*", "*", "italic"), title: "Italic" },
    { icon: Strikethrough, action: () => insertMarkdown("~~", "~~", "strikethrough"), title: "Strikethrough" },
    { type: "divider" },
    { icon: Heading1, action: () => insertMarkdown("# ", "", "Heading 1"), title: "Heading 1" },
    { icon: Heading2, action: () => insertMarkdown("## ", "", "Heading 2"), title: "Heading 2" },
    { icon: Heading3, action: () => insertMarkdown("### ", "", "Heading 3"), title: "Heading 3" },
    { type: "divider" },
    { icon: List, action: () => insertMarkdown("- ", "", "list item"), title: "Bullet List" },
    { icon: ListOrdered, action: () => insertMarkdown("1. ", "", "list item"), title: "Numbered List" },
    { icon: Quote, action: () => insertMarkdown("> ", "", "quote"), title: "Quote" },
    { icon: Code, action: () => insertMarkdown("```\n", "\n```", "code"), title: "Code Block" },
    { type: "divider" },
    { icon: Link, action: () => insertMarkdown("[", "](url)", "link text"), title: "Link" },
    { icon: Image, action: () => insertMarkdown("![alt](", ")", "image-url"), title: "Image" },
    { icon: Video, action: () => insertMarkdown('<video src="', '" controls></video>', "video-url"), title: "Video" },
  ];

  const handleLatexInsert = useCallback((template: string, isBlock?: boolean) => {
    if (isBlock) {
      insertMarkdown("$$\n", "\n$$", template);
    } else {
      insertMarkdown("$", "$", template);
    }
  }, [insertMarkdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([`# ${title}\n\n${localContent}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [title, localContent]);

  const insertLineTemplate = useCallback((template: string) => {
    const textarea = textareaRef.current;
    const prefix = localContent && !localContent.endsWith("\n") ? "\n" : "";
    if (!textarea) {
      setLocalContent((prev) => `${prev}${prefix}${template}`);
      return;
    }
    const start = textarea.selectionStart;
    const next = `${localContent.slice(0, start)}${prefix}${template}${localContent.slice(start)}`;
    setLocalContent(next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length + template.length, start + prefix.length + template.length);
    }, 0);
  }, [localContent]);

  const slashActions = [
    { icon: Heading1, label: "Heading", template: "# Heading\n" },
    { icon: CheckSquare, label: "Tasks", template: "- [ ] Task\n- [ ] Task\n" },
    { icon: Table, label: "Table", template: "| Column | Value |\n| --- | --- |\n| Item | Detail |\n" },
    { icon: GitBranch, label: "Mermaid", template: "```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n" },
    { icon: Database, label: "DBML", template: "```dbml\nTable users {\n  id integer [primary key]\n  name varchar\n}\n```\n" },
    { icon: Quote, label: "Callout", template: "> [!note]\n> Write the note here.\n" },
  ];

  const openVersions = useCallback(async () => {
    if (!getNoteVersions) return;
    setVersionsOpen(true);
    setVersionsLoading(true);
    try {
      setVersions(await getNoteVersions(noteId));
    } catch (error) {
      toast.error("Could not load note history");
    } finally {
      setVersionsLoading(false);
    }
  }, [getNoteVersions, noteId]);

  const handleTitleSubmit = useCallback(() => {
    const trimmedTitle = editableTitle.trim();
    if (trimmedTitle && trimmedTitle !== title) {
      if (titleChangeTimeoutRef.current) {
        clearTimeout(titleChangeTimeoutRef.current);
      }
      titleChangeTimeoutRef.current = setTimeout(() => {
        onTitleChange(trimmedTitle);
      }, 100);
    }
    setIsEditingTitle(false);
  }, [editableTitle, title, onTitleChange]);

  const openWikiTarget = useCallback(async (target: string) => {
    const resolved = resolveWikiTarget(allNotes, folders, target);
    if (resolved.type === "note" && resolved.note) {
      const id = getNoteId(resolved.note);
      if (id) onOpenNote?.(id, getNoteFolderId(resolved.note));
      return;
    }

    if (resolved.type === "folder" && resolved.folder) {
      const id = getFolderId(resolved.folder);
      if (id) onOpenFolder?.(id);
      return;
    }

    if (!onCreateLinkedNote) {
      toast.info(`No note named "${target}"`);
      return;
    }

    const createdId = await onCreateLinkedNote(resolved.createTitle, resolved.createFolderId);
    if (createdId) {
      toast.success(`Created "${resolved.createTitle}"`);
    } else {
      toast.error("Select a folder before creating linked notes");
    }
  }, [allNotes, folders, onCreateLinkedNote, onOpenFolder, onOpenNote]);

  const toggleAnnotationMode = useCallback(() => {
    if (!isPreview) {
      // Switch to preview first when enabling annotation mode
      setIsPreview(true);
    }
    setAnnotationMode(prev => !prev);
  }, [isPreview]);

  const selectedAnnotationLocked = Boolean(ann.selectedAnnotation?.locked || ann.annotationsLocked);
  const selectedAnnotationHidden = ann.selectedAnnotation?.visible === false;
  const visibleAnnotationCount = ann.annotations.filter((item) => item.visible !== false).length;

  return (
    <div className={cn("flex flex-col h-full", focusMode && "fixed inset-0 z-50 bg-background p-6 pt-10")}>
      {/* Timer and Title Row */}
      <div className="mb-4 flex items-center gap-4">
        <NoteTimer noteTitle={title} />
        <div className="h-6 w-px bg-border" />
        {isEditingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editableTitle}
              onChange={(e) => setEditableTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              className="text-2xl font-display font-bold border-none p-0 h-auto focus-visible:ring-0"
              autoFocus
            />
            <Button size="icon" variant="ghost" onClick={handleTitleSubmit}>
              <Check className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <h2 
            className="text-2xl font-display font-bold cursor-pointer hover:text-muted-foreground transition-colors"
            onClick={() => setIsEditingTitle(true)}
          >
            {title}
          </h2>
        )}
        
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            {onTogglePinned && (
              <Button
                variant={currentNote.pinned ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                title={currentNote.pinned ? "Unpin note" : "Pin note"}
                onClick={() => onTogglePinned(!currentNote.pinned)}
              >
                {currentNote.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" title="Links">
                  <Link2 className="w-4 h-4" />
                  {referenceCount}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3" align="end">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Backlinks</p>
                      <span className="text-xs text-muted-foreground">{backlinks.length}</span>
                    </div>
                    <div className="space-y-1">
                      {backlinks.length ? backlinks.map((note) => {
                        const id = getNoteId(note);
                        return (
                          <Button
                            key={id}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start truncate"
                            onClick={() => id && onOpenNote?.(id, getNoteFolderId(note))}
                          >
                            {note.title}
                          </Button>
                        );
                      }) : (
                        <p className="px-2 py-1 text-xs text-muted-foreground">No backlinks yet</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Unlinked Mentions</p>
                      <span className="text-xs text-muted-foreground">{unlinkedMentions.length}</span>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                      {unlinkedMentions.length ? unlinkedMentions.map((mention) => {
                        const id = getNoteId(mention.note);
                        return (
                          <Button
                            key={id}
                            variant="ghost"
                            size="sm"
                            className="h-auto w-full justify-start gap-2 whitespace-normal px-2 py-2 text-left"
                            onClick={() => id && onOpenNote?.(id, getNoteFolderId(mention.note))}
                          >
                            <Search className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{mention.note.title}</span>
                              <span className="line-clamp-2 text-xs text-muted-foreground">{mention.excerpt}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">{mention.count}</span>
                          </Button>
                        );
                      }) : (
                        <p className="px-2 py-1 text-xs text-muted-foreground">No unlinked mentions</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Outgoing Links</p>
                      <span className="text-xs text-muted-foreground">{outgoingLinks.length}</span>
                    </div>
                    <div className="space-y-1">
                      {outgoingLinks.length ? outgoingLinks.map((link) => {
                        const id = link.note ? getNoteId(link.note) : "";
                        const folderId = link.folder ? getFolderId(link.folder) : "";
                        return (
                          <Button
                            key={`${link.normalizedTarget}-${link.alias || ""}`}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-2 truncate"
                            onClick={() => {
                              if (link.note && id) {
                                onOpenNote?.(id, getNoteFolderId(link.note));
                                return;
                              }
                              if (link.folder && folderId) {
                                onOpenFolder?.(folderId);
                                return;
                              }
                              openWikiTarget(link.target);
                            }}
                          >
                            {link.type === "folder" && <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                            {link.type === "missing" && <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="truncate">{link.alias || link.target}</span>
                          </Button>
                        );
                      }) : (
                        <p className="px-2 py-1 text-xs text-muted-foreground">No outgoing links</p>
                      )}
                    </div>
                  </div>

                  {brokenLinks.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Missing Links</p>
                        <span className="text-xs text-muted-foreground">{brokenLinks.length}</span>
                      </div>
                      <div className="space-y-1">
                        {brokenLinks.map((link) => (
                          <Button
                            key={`missing-${link.normalizedTarget}-${link.alias || ""}`}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-2 truncate text-muted-foreground"
                            onClick={() => openWikiTarget(link.target)}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="truncate">{link.alias || link.target}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {getNoteVersions && (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Version history" onClick={openVersions}>
                <History className="h-4 w-4" />
              </Button>
            )}
            <Button variant={focusMode ? "default" : "ghost"} size="icon" className="h-8 w-8" title="Focus mode" onClick={() => setFocusMode(prev => !prev)}>
              <Focus className="h-4 w-4" />
            </Button>
            <SaveIndicator state={saveStatus} />
          </div>
        </div>
      </div>

      {/* Toolbar Row 1 — Markdown formatting */}
      <div className="flex items-center gap-1 p-2 border border-border rounded-t-lg bg-muted/50 flex-wrap">
        {toolbarButtons.map((btn, i) => (
          btn.type === "divider" ? (
            <div key={i} className="w-px h-6 bg-border mx-1" />
          ) : (
            <Button
              key={i}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={btn.action}
              title={btn.title}
              disabled={isPreview}
            >
              {btn.icon && <btn.icon className="w-4 h-4" />}
            </Button>
          )
        ))}
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <LatexTemplates onInsert={handleLatexInsert} disabled={isPreview} />

        <div className="w-px h-6 bg-border mx-1" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Insert block"
              disabled={isPreview}
            >
              <Wand2 className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="grid gap-1">
              {slashActions.map(({ icon: Icon, label, template }) => (
                <Button
                  key={label}
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => insertLineTemplate(template)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Annotation Mode Toggle */}
        <Button
          variant={annotationMode ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={toggleAnnotationMode}
          title="Annotate (draw on preview)"
        >
          <PenTool className="w-4 h-4" />
        </Button>

        <div className="flex-1" />

        {/* Download Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Download as Markdown"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
        </Button>

        {/* Paper Pattern Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Paper background"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Paper Background</p>
              <div className="grid grid-cols-5 gap-2">
                {paperPatterns.map((pattern) => (
                  <PatternPreview
                    key={pattern}
                    pattern={pattern}
                    isSelected={paperPattern === pattern}
                    onClick={() => setPaperPattern(pattern)}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <Button
          variant={isPreview ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            if (annotationMode && isPreview) {
              // Don't allow switching to edit mode while annotating
              toast.info("Disable annotation mode first");
              return;
            }
            setIsPreview(!isPreview);
          }}
          className="gap-2"
        >
          {isPreview ? <Edit className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isPreview ? "Edit" : "Preview"}
        </Button>
      </div>

      {/* Toolbar Row 2 — Annotation tools (shown when annotation mode is active) */}
      {annotationMode && (
        <div className="flex items-center gap-1 p-2 border border-t-0 border-border bg-muted/30 flex-wrap">
          <div className="mr-2 flex min-w-[170px] items-center gap-2 rounded border border-border bg-background px-2 py-1">
            <span className={cn(
              "h-2 w-2 rounded-full",
              ann.annotationsLocked ? "bg-muted-foreground" : ann.tool === "eraser" ? "bg-destructive" : ann.tool === "pan" ? "bg-primary" : "bg-green-500"
            )} />
            <span className="text-xs font-medium">
              {ann.annotationsLocked ? "Locked" : ANNOTATION_TOOLS.find((tool) => tool.id === ann.tool)?.label || "Annotating"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {visibleAnnotationCount}/{ann.annotations.length}
            </span>
          </div>

          {/* Tools */}
          {ANNOTATION_TOOLS.map(({ id, icon: Icon, label, shortcut }) => (
            <Button
              key={id}
              variant={ann.tool === id ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => ann.setTool(id)}
              title={`${label} (${shortcut})`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant={ann.annotationsVisible ? "ghost" : "default"}
            size="icon"
            className="h-8 w-8"
            onClick={() => ann.setAnnotationsVisible(!ann.annotationsVisible)}
            title={ann.annotationsVisible ? "Hide annotations" : "Show annotations"}
          >
            {ann.annotationsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant={ann.annotationsLocked ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => ann.setAnnotationsLocked(!ann.annotationsLocked)}
            title={ann.annotationsLocked ? "Unlock annotation layer" : "Lock annotation layer"}
          >
            {ann.annotationsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </Button>
          <Button
            variant={selectedAnnotationLocked ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={ann.toggleSelectedLocked}
            disabled={!ann.selectedAnnotationId || ann.annotationsLocked}
            title={selectedAnnotationLocked ? "Unlock selected" : "Lock selected"}
          >
            {selectedAnnotationLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </Button>
          <Button
            variant={selectedAnnotationHidden ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={ann.toggleSelectedVisible}
            disabled={!ann.selectedAnnotationId}
            title={selectedAnnotationHidden ? "Show selected" : "Hide selected"}
          >
            {selectedAnnotationHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={ann.bringSelectedForward}
            disabled={!ann.selectedAnnotationId || ann.annotationsLocked}
            title="Bring selected forward"
          >
            <Layers className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rotate-180"
            onClick={ann.sendSelectedBackward}
            disabled={!ann.selectedAnnotationId || ann.annotationsLocked}
            title="Send selected backward"
          >
            <Layers className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Color palette */}
          <div className="flex items-center gap-0.5">
            {ANNOTATION_COLORS.map(c => (
              <button
                key={c}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                  ann.color === c ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                )}
                style={{ backgroundColor: c }}
                onClick={() => ann.setColor(c)}
              />
            ))}
            <Input
              type="color"
              value={ann.color}
              onChange={e => ann.setColor(e.target.value)}
              className="w-7 h-7 p-0 border-0 cursor-pointer"
            />
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Brush size */}
          <div className="flex items-center gap-1.5 min-w-[100px]">
            <span className="text-xs text-muted-foreground">Size:</span>
            <Slider
              value={[ann.brushSize]}
              onValueChange={([v]) => ann.setBrushSize(v)}
              min={1}
              max={20}
              step={1}
              className="w-16"
            />
            <span className="text-xs font-mono w-4 text-center">{ann.brushSize}</span>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Undo/Redo/Clear */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={ann.undo} disabled={!ann.canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={ann.redo} disabled={!ann.canRedo} title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-colors ${trashHolding ? 'text-destructive bg-destructive/20' : ann.selectedAnnotationId ? 'text-destructive hover:text-destructive' : 'text-muted-foreground'}`}
            title={ann.selectedAnnotationId ? "Delete selected (hold 5s to clear all)" : "Hold 5s to clear all annotations"}
            onMouseDown={() => {
              setTrashHolding(true);
              trashHoldTimerRef.current = setTimeout(() => {
                ann.clearAll();
                ann.setSelectedAnnotationId(null);
                setTrashHolding(false);
                toast.info('All annotations cleared');
              }, 5000);
            }}
            onMouseUp={() => {
              if (trashHoldTimerRef.current) {
                clearTimeout(trashHoldTimerRef.current);
                trashHoldTimerRef.current = null;
              }
              if (trashHolding) {
                setTrashHolding(false);
                if (ann.selectedAnnotationId) {
                  if (selectedAnnotationLocked) {
                    toast.info('Unlock the selected annotation first');
                  } else {
                    ann.deleteAnnotation(ann.selectedAnnotationId);
                    ann.setSelectedAnnotationId(null);
                  }
                }
              }
            }}
            onMouseLeave={() => {
              if (trashHoldTimerRef.current) {
                clearTimeout(trashHoldTimerRef.current);
                trashHoldTimerRef.current = null;
              }
              setTrashHolding(false);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Editor / Preview */}
      <div className={cn(
        "flex-1 border border-t-0 border-border rounded-b-lg overflow-hidden",
      )}>
        {isPreview ? (
          <div className="h-full overflow-auto relative" style={getPatternStyle(paperPattern)}>
            <div className="w-full h-full">
              <div ref={contentRef} className="p-4 prose prose-sm max-w-none dark:prose-invert min-h-full relative">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match && !className;
                      return isInline ? (
                        <InlineCode>{children}</InlineCode>
                      ) : (
                        <CodeBlock language={match?.[1]}>
                          {String(children).replace(/\n$/, "")}
                        </CodeBlock>
                      );
                    },
                    img: ({ src, alt }) => (
                      <img 
                        src={src} 
                        alt={alt} 
                        className="max-w-full h-auto rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target={href?.startsWith("wikilink:") ? undefined : "_blank"}
                        rel={href?.startsWith("wikilink:") ? undefined : "noopener noreferrer"}
                        className={cn(
                          "text-primary hover:underline",
                          href?.startsWith("wikilink:") &&
                            resolveWikiTarget(allNotes, folders, decodeURIComponent(href.replace(/^wikilink:/, ""))).type === "missing" &&
                            "decoration-dashed text-muted-foreground"
                        )}
                        onClick={(event) => {
                          if (!href?.startsWith("wikilink:")) return;
                          event.preventDefault();
                          openWikiTarget(decodeURIComponent(href.replace(/^wikilink:/, "")));
                        }}
                      >
                        {children}
                      </a>
                    ),
                    video: (props) => (
                      <video {...props} className="max-w-full rounded-lg" controls />
                    ),
                  }}
                >
                  {renderedContent || "*Start writing...*"}
                </ReactMarkdown>
              </div>
            </div>

            {/* Annotation overlay — transparent canvas on top of rendered markdown */}
            <AnnotationOverlay
              annotations={ann.annotations}
              onAddAnnotation={ann.addAnnotation}
              onUpdateAnnotation={ann.updateAnnotation}
              onDeleteAnnotation={ann.deleteAnnotation}
              tool={ann.tool}
              color={ann.color}
              brushSize={ann.brushSize}
              active={annotationMode}
              visible={ann.annotationsVisible}
              locked={ann.annotationsLocked}
              contentRef={contentRef}
              selectedId={ann.selectedAnnotationId}
              onSelectionChange={ann.setSelectedAnnotationId}
              onCanvasSizeChange={ann.updateCanvas}
            />
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            placeholder="Start writing in Markdown..."
            className="h-full resize-none border-none rounded-none focus-visible:ring-0 font-mono text-sm"
          />
        )}
      </div>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {versionsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading versions...</p>
            ) : versions.length ? versions.map((version) => (
              <div key={version.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{version.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Revision {version.revision || "unknown"} {version.savedAt ? `- ${new Date(version.savedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await onRestoreVersion?.(noteId, String(version.id));
                      setVersionsOpen(false);
                    }}
                  >
                    Restore
                  </Button>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{version.content || "Empty note"}</p>
              </div>
            )) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No previous versions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarkdownEditor;
