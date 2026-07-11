import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NotesProvider, useNotes } from "@/contexts/NotesContext";
import { useNoteTimerActions } from "@/contexts/NoteTimerContext";
import FoldersSidebar from "@/components/FoldersSidebar";
import NotesList from "@/components/NotesList";
import MarkdownEditor from "@/components/MarkdownEditor";
import GraphView from "@/components/GraphView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Plus, FolderClosed, List, PenTool, Network, Download, Upload, HelpCircle, Search, CalendarDays, LayoutTemplate, Pin, Clock, MoreHorizontal } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ActiveTimerIndicator } from "@/components/ActiveTimerIndicator";
import { exportMarkdownVault, readMarkdownImportFiles, uniqueImportTitle } from "@/lib/markdown-vault";
import { getApiBaseUrl } from "@/lib/api";
import { getNoteFolderId, getNoteId } from "@/lib/note-links";
import { toast } from "sonner";

const noteTemplates = [
  {
    name: "Meeting Notes",
    content: "## Agenda\n- \n\n## Notes\n\n## Decisions\n- \n\n## Follow-ups\n- [ ] ",
  },
  {
    name: "Project Brief",
    content: "## Goal\n\n## Context\n\n## Plan\n\n## Risks\n\n## Next Actions\n- [ ] ",
  },
  {
    name: "Daily Review",
    content: "## Wins\n- \n\n## Focus\n- \n\n## Notes\n\n## Tomorrow\n- [ ] ",
  },
];

const NotesContent = () => {
  const navigate = useNavigate();
  const {
    folders,
    allNotes,
    recentNotes,
    getSelectedNote,
    getIndexedReferences,
    getNoteVersions,
    restoreNoteVersion,
    updateNote,
    toggleNotePinned,
    selectedNoteId,
    selectedFolderId,
    createNote,
    createNoteInFolder,
    selectFolder,
    selectNote,
    refreshNotes
  } = useNotes();
  const { toggleTimer, resetTimer, saveSession } = useNoteTimerActions();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false);
  const [isNotesListCollapsed, setIsNotesListCollapsed] = useState(false);
  const [isGraphView, setIsGraphView] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  
  const selectedNote = getSelectedNote();
  const commandNotes = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    const source = q
      ? allNotes.filter((note) => note.title.toLowerCase().includes(q) || (note.content || "").toLowerCase().includes(q))
      : allNotes;
    return source.slice(0, 25);
  }, [allNotes, commandQuery]);

  const handleCreateNote = async () => {
    if (selectedFolderId) {
      const note = await createNote("Untitled", "");
      if (note) {
        selectNote(String(note._id || note.id || ""));
      }
    }
  };

  const openNote = useCallback((noteId: string, folderId?: string) => {
    if (folderId && folderId !== selectedFolderId) {
      selectFolder(folderId);
    }
    selectNote(noteId);
    setIsGraphView(false);
    setCommandOpen(false);
  }, [selectFolder, selectNote, selectedFolderId]);

  const toggleFolders = useCallback(() => setIsFoldersCollapsed(prev => !prev), []);
  const toggleNotesList = useCallback(() => setIsNotesListCollapsed(prev => !prev), []);
  const handleGraphNoteSelect = useCallback((noteId: string, folderId?: string) => {
    openNote(noteId, folderId);
  }, [openNote]);
  const handleOpenFolder = useCallback((folderId: string) => {
    selectFolder(folderId);
    setIsGraphView(false);
  }, [selectFolder]);
  const handleCreateLinkedNote = useCallback(async (title: string, folderId?: string) => {
    const note = folderId
      ? await createNoteInFolder(folderId, title, "")
      : await createNote(title, "");
    if (note) {
      const noteId = String(note._id || note.id || "");
      if (folderId && folderId !== selectedFolderId) {
        selectFolder(folderId);
      }
      selectNote(noteId);
      return noteId;
    }
    return null;
  }, [createNote, createNoteInFolder, selectFolder, selectNote, selectedFolderId]);

  const createNoteFromTemplate = useCallback(async (templateName: string, content: string) => {
    const note = await createNote(templateName, content);
    if (note) {
      openNote(getNoteId(note), getNoteFolderId(note));
      toast.success(`Created ${templateName}`);
    }
  }, [createNote, openNote]);

  const createDailyNote = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const title = `Daily ${today}`;
    const existing = allNotes.find((note) => note.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      openNote(getNoteId(existing), getNoteFolderId(existing));
      return;
    }
    await createNoteFromTemplate(title, `# ${title}\n\n## Focus\n- \n\n## Notes\n\n## Tasks\n- [ ] `);
  }, [allNotes, createNoteFromTemplate, openNote]);
  const handleExportVault = useCallback(async () => {
    try {
      const result = await exportMarkdownVault(allNotes as any, folders as any);
      toast.success(`Exported ${result.count} notes`);
    } catch (error) {
      console.error("Markdown export failed:", error);
      toast.error("Export cancelled or failed");
    }
  }, [allNotes, folders]);
  const getOrCreateImportFolder = useCallback(async (name: string) => {
    const existing = folders.find((folder) => folder.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing._id || existing.id || "";

    const response = await fetch(`${getApiBaseUrl()}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: "#547792" }),
    });
    if (!response.ok) throw new Error(`Failed to create folder ${name}`);
    const folder = await response.json();
    return folder._id || folder.id || "";
  }, [folders]);
  const handleImportVault = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const imports = await readMarkdownImportFiles(files);
      if (!imports.length) {
        toast.info("No Markdown files found");
        return;
      }

      const folderIds = new Map<string, string>();
      const existingNotes = [...allNotes];
      for (const item of imports) {
        if (!folderIds.has(item.folderName)) {
          folderIds.set(item.folderName, await getOrCreateImportFolder(item.folderName));
        }
        const folderId = folderIds.get(item.folderName)!;
        const title = uniqueImportTitle(item.title, existingNotes);
        const note = await createNoteInFolder(folderId, title, item.content);
        if (note) {
          existingNotes.push(note);
          if (item.annotations?.annotations?.length) {
            const noteId = getNoteId(note);
            await fetch(`${getApiBaseUrl()}/annotations/${noteId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...item.annotations,
                noteId,
              }),
            });
          }
        }
      }

      await refreshNotes();
      toast.success(`Imported ${imports.length} Markdown files`);
    } catch (error) {
      console.error("Markdown import failed:", error);
      toast.error("Import failed");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [allNotes, createNoteInFolder, getOrCreateImportFolder, refreshNotes]);

  useKeyboardShortcuts({
    onToggleFolders: toggleFolders,
    onToggleNotesList: toggleNotesList,
    onTimerToggle: toggleTimer,
    onTimerReset: resetTimer,
    onTimerSave: saveSession,
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Calculate panel widths based on collapse states
  const getFoldersWidth = () => isFoldersCollapsed ? "0px" : "200px";
  const getNotesListWidth = () => {
    if (!selectedFolderId || isNotesListCollapsed) return "0px";
    return "240px";
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden pt-8">
      {/* Header */}
      <header className="border-b border-border p-4 flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          title="Back to Focus"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Folders Toggle */}
        <Button
          variant={isFoldersCollapsed ? "outline" : "ghost"}
          size="icon"
          onClick={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
          title={isFoldersCollapsed ? "Show folders" : "Hide folders"}
        >
          <FolderClosed className="w-5 h-5" />
        </Button>
        
        {/* Notes List Toggle - only show when folder is selected */}
        {selectedFolderId && (
          <Button
            variant={isNotesListCollapsed ? "outline" : "ghost"}
            size="icon"
            onClick={() => setIsNotesListCollapsed(!isNotesListCollapsed)}
            title={isNotesListCollapsed ? "Show notes list" : "Hide notes list"}
          >
            <List className="w-5 h-5" />
          </Button>
        )}
        
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tighter ml-2">
          NOTES
        </h1>
        <ActiveTimerIndicator compact className="ml-2" />
        <div className="flex-1" />
        <input
          ref={importInputRef}
          type="file"
          accept=".md,text/markdown"
          multiple
          className="hidden"
          onChange={(event) => handleImportVault(event.target.files)}
          {...({ webkitdirectory: "true", directory: "true" } as any)}
        />
        {/* Primary actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandOpen(true)}
            title="Search notes (⌘K)"
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button
            variant={isGraphView ? "default" : "ghost"}
            size="icon"
            onClick={() => setIsGraphView(prev => !prev)}
            title={isGraphView ? "Show editor" : "Graph view"}
          >
            <Network className="w-5 h-5" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Secondary actions grouped in a menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="More">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            <DropdownMenuItem onClick={createDailyNote}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Daily note
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Vault</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import markdown…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportVault}>
              <Download className="w-4 h-4 mr-2" />
              Export markdown…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tools</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/canvas")}>
              <PenTool className="w-4 h-4 mr-2" />
              Canvas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/help")}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        {selectedFolderId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNote}
            className="gap-2 ml-1"
          >
            <Plus className="w-4 h-4" />
            New Note
          </Button>
        )}
      </header>

      {/* Main Content with Independent Panels */}
      <div className="flex-1 overflow-hidden flex">
        {/* Folders Sidebar */}
        <div
          className="h-full border-r border-border overflow-hidden flex-shrink-0"
          style={{ 
            width: getFoldersWidth(),
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div 
            className="h-full min-h-0"
            style={{
              transform: isFoldersCollapsed ? 'translateX(-100%)' : 'translateX(0)',
              opacity: isFoldersCollapsed ? 0 : 1,
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
            }}
          >
            <div className="h-full min-w-[200px] p-4">
              <FoldersSidebar />
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div
          className="h-full border-r border-border overflow-hidden flex-shrink-0"
          style={{ 
            width: getNotesListWidth(),
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div 
            className="h-full min-h-0"
            style={{
              transform: isNotesListCollapsed ? 'translateX(-100%)' : 'translateX(0)',
              opacity: isNotesListCollapsed ? 0 : 1,
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out',
            }}
          >
            <div className="h-full min-w-[240px] p-4">
              <NotesList />
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 h-full overflow-hidden">
          <main className={isGraphView ? "h-full overflow-hidden" : "h-full p-6 overflow-hidden"}>
            {isGraphView ? (
              <GraphView
                selectedNoteId={selectedNoteId}
                notes={allNotes}
                folders={folders}
                onSelectNote={handleGraphNoteSelect}
              />
            ) : selectedNote ? (
              <MarkdownEditor
                content={selectedNote.content}
                title={selectedNote.title}
                noteId={String(selectedNote._id || selectedNote.id || "")}
                allNotes={allNotes}
                folders={folders}
                onOpenNote={handleGraphNoteSelect}
                onOpenFolder={handleOpenFolder}
                onCreateLinkedNote={handleCreateLinkedNote}
                onTogglePinned={async (pinned) => {
                  await toggleNotePinned(getNoteId(selectedNote), pinned);
                }}
                getIndexedReferences={getIndexedReferences}
                getNoteVersions={getNoteVersions}
                onRestoreVersion={async (noteId, versionId) => {
                  const restored = await restoreNoteVersion(noteId, versionId);
                  if (restored) toast.success("Version restored");
                }}
                onContentChange={async (content) => {
                  const updated = await updateNote(getNoteId(selectedNote), { content });
                  return Boolean(updated);
                }}
                onTitleChange={(title) => updateNote(getNoteId(selectedNote), { title })}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground max-w-md mx-auto text-center px-6">
                <FileText className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-lg font-body font-medium text-foreground">No note selected</p>
                <p className="text-sm mt-1">Pick a folder, choose a note, or start something new.</p>
                <div className="flex items-center gap-2 mt-6">
                  <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)} className="gap-2">
                    <Search className="w-4 h-4" /> Search (⌘K)
                  </Button>
                  <Button variant="outline" size="sm" onClick={createDailyNote} className="gap-2">
                    <CalendarDays className="w-4 h-4" /> Daily note
                  </Button>
                  {selectedFolderId && (
                    <Button size="sm" onClick={handleCreateNote} className="gap-2">
                      <Plus className="w-4 h-4" /> New note
                    </Button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search notes, actions, templates..." value={commandQuery} onValueChange={setCommandQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={createDailyNote}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Daily note
            </CommandItem>
            <CommandItem onSelect={() => setIsGraphView(prev => !prev)}>
              <Network className="mr-2 h-4 w-4" />
              Toggle graph view
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Templates">
            {noteTemplates.map((template) => (
              <CommandItem key={template.name} onSelect={() => createNoteFromTemplate(template.name, template.content)}>
                <LayoutTemplate className="mr-2 h-4 w-4" />
                {template.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {recentNotes.length > 0 && (
            <CommandGroup heading="Recent">
              {recentNotes.map((note) => (
                <CommandItem key={`recent-${getNoteId(note)}`} onSelect={() => openNote(getNoteId(note), getNoteFolderId(note))}>
                  <Clock className="mr-2 h-4 w-4" />
                  {note.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Notes">
            {commandNotes.map((note) => (
              <CommandItem key={getNoteId(note)} onSelect={() => openNote(getNoteId(note), getNoteFolderId(note))}>
                {note.pinned ? <Pin className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
                {note.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};

const Notes = () => {
  return (
    <NotesProvider>
      <NotesContent />
    </NotesProvider>
  );
};

export default Notes;
