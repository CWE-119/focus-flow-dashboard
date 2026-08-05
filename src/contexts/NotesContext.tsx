import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/api";

interface Folder {
  _id?: string | number;
  id?: string | number;
  name: string;
  color?: string | null;
  parentId?: string | number | null;
  position?: number | null;
  createdAt?: Date;
}

interface Note {
  _id?: string | number;
  id?: string | number;
  title: string;
  content: string;
  folderId: string | number | { _id?: string | number; id?: string | number }; // Can be populated or just an ID
  revision?: number;
  pinned?: boolean;
  important?: boolean;
  tags?: string[];
  lastViewedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}


interface NoteVersion {
  id: string | number;
  noteId: string | number;
  title: string;
  content: string;
  folderId?: string | number | null;
  revision?: number;
  savedAt?: string;
}

interface IndexedNoteReferences {
  backlinks: Note[];
  outgoingLinks: Array<{ target: string; type: "note"; note: Note }>;
  missingLinks: Array<{ target: string; type: "missing" }>;
  unlinkedMentions: Array<{ note: Note; count: number; excerpt: string }>;
}

interface NotesContextType {
  folders: Folder[];
  notes: Note[];
  allNotes: Note[];
  recentNotes: Note[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  
  // Folder operations
  createFolder: (name: string, color: string, parentId?: string | null) => Promise<Folder | null>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<{ ok: boolean; error?: string }>;
  renameFolder: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  reorderFolders: (orderedIds: string[]) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  selectFolder: (id: string | null) => void;
  getSelectedFolder: () => Folder | null;
  
  // Note operations
  createNote: (title: string, content: string) => Promise<Note | null>;
  createNoteInFolder: (folderId: string, title: string, content: string) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note | null>;
  toggleNotePinned: (id: string, pinned: boolean) => Promise<Note | null>;
  toggleNoteImportant: (id: string, important: boolean) => Promise<Note | null>;
  updateNoteTags: (id: string, tags: string[]) => Promise<Note | null>;
  moveNoteToFolder: (id: string, folderId: string) => Promise<Note | null>;
  allTags: string[];


  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  getSelectedNote: () => Note | null;
  getNoteById: (id: string) => Note | null;
  searchNotes: (query: string) => Note[];
  getIndexedReferences: (id: string) => Promise<IndexedNoteReferences | null>;
  getNoteVersions: (id: string) => Promise<NoteVersion[]>;
  restoreNoteVersion: (id: string, versionId: string) => Promise<Note | null>;
  refreshNotes: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

const normalizeId = (value?: string | number | null) => value == null ? "" : String(value);
const getFolderId = (folder: Folder) => normalizeId(folder._id || folder.id);
const getNoteId = (note: Note) => normalizeId(note._id || note.id);
const getNoteFolderId = (note: Note) => {
  if (typeof note.folderId === "object") return normalizeId(note.folderId?._id || note.folderId?.id);
  return normalizeId(note.folderId);
};
const sortNotes = (items: Note[]) =>
  [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
let noteViewEndpointSupported = true;

export const NotesProvider = ({ children }: { children: ReactNode }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const recentNotes = sortNotes(allNotes.filter((note) => note.lastViewedAt)).slice(0, 8);
  const viewedNoteIdsRef = useState(() => new Set<string>())[0];

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
    fetchAllNotes();
  }, []);

  // Fetch notes when folder is selected
  useEffect(() => {
    if (selectedFolderId) {
      setNotes(allNotes.filter((note) => {
        return getNoteFolderId(note) === normalizeId(selectedFolderId);
      }));
    } else {
      setNotes([]);
    }
  }, [selectedFolderId, allNotes]);

  // Fetch all folders
  const sortFolders = (data: Folder[]) =>
    [...data].sort((a, b) => {
      const posA = a.position ?? 100000;
      const posB = b.position ?? 100000;
      if (posA !== posB) return posA - posB;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/folders`);
      if (!response.ok) throw new Error("Failed to fetch folders");
      const data = await response.json();
      setFolders(sortFolders(data));
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };


  // Fetch notes by folder
  const fetchNotesByFolder = async (folderId: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes/folder/${folderId}`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Error fetching notes:", error);
      setNotes([]);
    }
  };

  const refreshNotes = async () => {
    await Promise.all([fetchFolders(), fetchAllNotes()]);
  };

  const fetchAllNotes = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes`);
      if (!response.ok) throw new Error("Failed to fetch all notes");
      const data = await response.json();
      setAllNotes(sortNotes(data));
    } catch (error) {
      console.error("Error fetching all notes:", error);
      setAllNotes([]);
    }
  };

  // Create folder
  const createFolder = async (name: string, color: string, parentId?: string | null): Promise<Folder | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, parentId: parentId ?? null }),
      });

      if (!response.ok) throw new Error("Failed to create folder");
      const folder = await response.json();
      setFolders((prev) => [...prev, folder]);
      return folder;
    } catch (error) {
      console.error("Error creating folder:", error);
      return null;
    }
  };

  // Update folder
  const updateFolder = async (id: string, updates: Partial<Folder>): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return { ok: false, error: payload.error || "Failed to update folder" };
      }
      const updatedFolder = await response.json();
      setFolders((prev) =>
        sortFolders(prev.map((f) => (getFolderId(f) === normalizeId(id) ? updatedFolder : f)))
      );
      return { ok: true };
    } catch (error) {
      console.error("Error updating folder:", error);
      return { ok: false, error: "Failed to update folder" };
    }
  };

  const renameFolder = async (id: string, name: string): Promise<{ ok: boolean; error?: string }> => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Folder name cannot be empty" };
    if (trimmed.length > 60) return { ok: false, error: "Folder name must be 60 characters or fewer" };

    const target = folders.find((f) => getFolderId(f) === normalizeId(id));
    const parentId = normalizeId(target?.parentId as string | number | null);
    const duplicate = folders.some(
      (f) =>
        getFolderId(f) !== normalizeId(id) &&
        normalizeId(f.parentId as string | number | null) === parentId &&
        f.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) return { ok: false, error: "A folder with that name already exists here" };

    const result = await updateFolder(id, { name: trimmed });
    if (result.ok) await refreshNotes();
    return result;
  };

  const reorderFolders = async (orderedIds: string[]) => {
    // Optimistic local reorder of top-level folders
    setFolders((prev) => {
      const positions = new Map(orderedIds.map((id, index) => [normalizeId(id), index]));
      return sortFolders(
        prev.map((f) => {
          const next = positions.get(getFolderId(f));
          return next === undefined ? f : { ...f, position: next };
        })
      );
    });

    try {
      const response = await fetch(`${getApiBaseUrl()}/folders/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orderedIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder folders");
      const data = await response.json();
      setFolders(sortFolders(data));
    } catch (error) {
      console.error("Error reordering folders:", error);
      await fetchFolders();
    }
  };


  // Delete folder, its subfolders and their notes (backend cascades too)
  const deleteFolder = async (id: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/folders/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete folder");

      // Collect the folder and all of its descendants
      const removedIds = new Set<string>([normalizeId(id)]);
      let changed = true;
      while (changed) {
        changed = false;
        folders.forEach((f) => {
          const fid = getFolderId(f);
          const parent = normalizeId(f.parentId as string | number | null);
          if (parent && removedIds.has(parent) && !removedIds.has(fid)) {
            removedIds.add(fid);
            changed = true;
          }
        });
      }

      setFolders((prev) => prev.filter((f) => !removedIds.has(getFolderId(f))));
      setAllNotes((prev) => prev.filter((n) => !removedIds.has(getNoteFolderId(n))));

      // If a removed folder was selected, clear selection
      if (removedIds.has(normalizeId(selectedFolderId))) {
        setSelectedFolderId(null);
        setSelectedNoteId(null);
        setNotes([]);
      } else {
        setNotes((prev) => prev.filter((n) => !removedIds.has(getNoteFolderId(n))));
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };


  // Select folder
  const selectFolder = (id: string | null) => {
    setSelectedFolderId(id);
    setSelectedNoteId(null); // Clear note selection when switching folders
  };

  // Get selected folder
  const getSelectedFolder = (): Folder | null => {
    if (!selectedFolderId) return null;
    return folders.find((f) => getFolderId(f) === normalizeId(selectedFolderId)) || null;
  };

  // Create note
  const createNote = async (title: string, content: string): Promise<Note | null> => {
    if (!selectedFolderId) {
      console.error("No folder selected");
      return null;
    }
    
    return createNoteInFolder(selectedFolderId, title, content);
  };

  const createNoteInFolder = async (folderId: string, title: string, content: string): Promise<Note | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, folderId }),
      });
      if (!response.ok) throw new Error("Failed to create note");
      const note = await response.json();
      if (getNoteFolderId(note) === normalizeId(selectedFolderId)) {
        setNotes((prev) => [note, ...prev]);
      }
      setAllNotes((prev) => sortNotes([note, ...prev]));
      setSelectedNoteId(getNoteId(note));
      return note;
    } catch (error) {
      console.error("Error creating note:", error);
      return null;
    }
  };

  // Update note
  const updateNote = async (id: string, updates: Partial<Note>): Promise<Note | null> => {
    try {
      // Only send fields that were actually updated, not undefined ones
      const updateData = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      );
      
      const current = getNoteById(id);
      const response = await fetch(`${getApiBaseUrl()}/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateData,
          clientUpdatedAt: current?.updatedAt,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409 && error.current) {
          setNotes((prev) =>
            prev.map((n) => (getNoteId(n) === normalizeId(id) ? error.current : n))
          );
          setAllNotes((prev) =>
            sortNotes(prev.map((n) => (getNoteId(n) === normalizeId(id) ? error.current : n)))
          );
        }
        throw new Error(error.error || "Failed to update note");
      }
      
      const updatedNote = await response.json();
      
      setNotes((prev) =>
        prev.map((n) => (getNoteId(n) === normalizeId(id) ? updatedNote : n))
      );
      setAllNotes((prev) =>
        sortNotes(prev.map((n) => (getNoteId(n) === normalizeId(id) ? updatedNote : n)))
      );
      return updatedNote;
    } catch (error) {
      console.error(`[NotesContext] Error updating note ${id}:`, error);
      return null;
    }
  };

  const updateNoteTags = async (id: string, tags: string[]): Promise<Note | null> => {
    const cleaned: string[] = [];
    tags.forEach((tag) => {
      const normalized = tag.trim().replace(/^#/, "");
      if (normalized && !cleaned.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
        cleaned.push(normalized);
      }
    });
    return updateNote(id, { tags: cleaned });
  };

  const moveNoteToFolder = async (id: string, folderId: string): Promise<Note | null> => {
    const note = getNoteById(id);
    if (!note || getNoteFolderId(note) === normalizeId(folderId)) return note;
    return updateNote(id, { folderId });
  };

  const allTags = Array.from(
    new Set(allNotes.flatMap((note) => note.tags || []).map((tag) => tag.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const toggleNoteImportant = async (id: string, important: boolean): Promise<Note | null> => {
    return updateNote(id, { important });
  };

  const toggleNotePinned = async (id: string, pinned: boolean): Promise<Note | null> => {
    return updateNote(id, { pinned });
  };

  // Delete note
  const deleteNote = async (id: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete note");
      
      setNotes((prev) => prev.filter((n) => getNoteId(n) !== normalizeId(id)));
      setAllNotes((prev) => prev.filter((n) => getNoteId(n) !== normalizeId(id)));
      
      // If the deleted note was selected, clear selection
      if (normalizeId(selectedNoteId) === normalizeId(id)) {
        setSelectedNoteId(null);
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  // Select note
  const selectNote = (id: string | null) => {
    setSelectedNoteId(id);
    if (!id) return;
    const viewedAt = new Date().toISOString();
    setAllNotes((prev) =>
      sortNotes(prev.map((note) => getNoteId(note) === normalizeId(id) ? { ...note, lastViewedAt: viewedAt } : note))
    );
    setNotes((prev) =>
      prev.map((note) => getNoteId(note) === normalizeId(id) ? { ...note, lastViewedAt: viewedAt } : note)
    );
    if (!noteViewEndpointSupported || viewedNoteIdsRef.has(normalizeId(id))) return;
    viewedNoteIdsRef.add(normalizeId(id));
    fetch(`${getApiBaseUrl()}/notes/${id}/view`, { method: "POST" })
      .then((response) => {
        if (response.status === 404) noteViewEndpointSupported = false;
      })
      .catch(() => {});
  };

  // Get selected note
  const getSelectedNote = (): Note | null => {
    if (!selectedNoteId) return null;
    return getNoteById(selectedNoteId);
  };

  const getNoteById = (id: string): Note | null => {
    return (
      notes.find((n) => getNoteId(n) === normalizeId(id)) ||
      allNotes.find((n) => getNoteId(n) === normalizeId(id)) ||
      null
    );
  };

  const searchNotes = (query: string): Note[] => {
    const value = query.trim().toLowerCase();
    if (!value) return sortNotes(allNotes);
    return sortNotes(allNotes.filter((note) => {
      return note.title.toLowerCase().includes(value) || (note.content || "").toLowerCase().includes(value);
    }));
  };

  const getNoteVersions = async (id: string): Promise<NoteVersion[]> => {
    const response = await fetch(`${getApiBaseUrl()}/notes/${id}/versions`);
    if (!response.ok) throw new Error("Failed to fetch note versions");
    return response.json();
  };

  const getIndexedReferences = async (id: string): Promise<IndexedNoteReferences | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes/${id}/references`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  };

  const restoreNoteVersion = async (id: string, versionId: string): Promise<Note | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/notes/${id}/restore/${versionId}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to restore note version");
      const note = await response.json();
      setNotes((prev) => prev.map((n) => (getNoteId(n) === normalizeId(id) ? note : n)));
      setAllNotes((prev) => sortNotes(prev.map((n) => (getNoteId(n) === normalizeId(id) ? note : n))));
      return note;
    } catch (error) {
      console.error("Error restoring note version:", error);
      return null;
    }
  };

  return (
    <NotesContext.Provider
      value={{
        folders,
        notes,
        allNotes,
        recentNotes,
        selectedFolderId,
        selectedNoteId,
        createFolder,
        updateFolder,
        renameFolder,
        reorderFolders,
        deleteFolder,
        selectFolder,
        getSelectedFolder,
        createNote,
        createNoteInFolder,
        updateNote,
        toggleNotePinned,
        toggleNoteImportant,
        updateNoteTags,
        moveNoteToFolder,
        allTags,
        deleteNote,
        selectNote,
        getSelectedNote,
        getNoteById,
        searchNotes,
        getIndexedReferences,
        getNoteVersions,
        restoreNoteVersion,
        refreshNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error("useNotes must be used within a NotesProvider");
  }
  return context;
};
