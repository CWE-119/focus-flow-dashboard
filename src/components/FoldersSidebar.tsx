import { useMemo, useState } from "react";
import { useNotes } from "@/contexts/NotesContext";
import Folder from "@/components/Folder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getFolderId, getNoteFolderId } from "@/lib/note-links";

const folderColors = [
  // Reds / Pinks
  "#F7374F",
  "#BE3144",
  "#921A40",
  "#872341",
  "#88304E",
  "#522546",
  "#C75B7A",
  "#E17564",
  "#F4D9D0",
  "#DDC3C3",
  "#D9ABAB",
  "#C8AAAA",
  "#9F8383",

  // Purples
  "#A376A2",
  "#8D5F8C",
  "#6B3F69",
  "#574964",

  // Blues
  "#94B4C1",
  "#547792",
  "#435663",
  "#3B4953",
  "#313647",
  "#213448",
  "#09122C",
  "#5227FF",

  // Greens
  "#EBF4DD",
  "#A3B087",
  "#9EBC8A",
  "#90AB8B",
  "#73946B",
  "#5A7863",
  "#537D5D",

  // Yellows / Beiges
  "#FFF8D4",
  "#FFDAB3",
  "#EAE0CF",
  "#D2D0A0",

  // Neutral / Dark
  "#2C2C2C"
];

const FOLDER_ROW_HEIGHT = 128;
const FOLDER_OVERSCAN = 5;

const FoldersSidebar = () => {
  const { 
    folders, 
    notes,
    selectedFolderId, 
    selectedNoteId,
    selectFolder, 
    createFolder, 
    updateFolder, 
    deleteFolder
  } = useNotes();

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(folderColors[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const noteCountsByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
      const folderId = getNoteFolderId(note);
      if (!folderId) return;
      counts.set(folderId, (counts.get(folderId) || 0) + 1);
    });
    return counts;
  }, [notes]);

  const visibleFolders = useMemo(() => {
    const viewportHeight = 760;
    const startIndex = Math.max(0, Math.floor(scrollTop / FOLDER_ROW_HEIGHT) - FOLDER_OVERSCAN);
    const endIndex = Math.min(
      folders.length,
      Math.ceil((scrollTop + viewportHeight) / FOLDER_ROW_HEIGHT) + FOLDER_OVERSCAN
    );

    return folders.slice(startIndex, endIndex).map((folder, offset) => ({
      folder,
      index: startIndex + offset,
    }));
  }, [folders, scrollTop]);

  const handleFolderClick = (folderId: string) => {
    selectFolder(folderId);
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      const folder = await createFolder(newFolderName.trim(), selectedColor);
      if (folder) {
        selectFolder(getFolderId(folder));
      }
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  const handleUpdateFolder = async (id: string) => {
    if (editingName.trim()) {
      await updateFolder(id, { name: editingName.trim() });
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg">Folders</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCreating(true)}
          title="New Folder"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div
        className="sidebar-scroll flex-1 overflow-y-auto overscroll-contain pt-2 pr-1"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div
          className="relative"
          style={{ height: folders.length * FOLDER_ROW_HEIGHT }}
        >
          <AnimatePresence mode="popLayout">
            {visibleFolders.map(({ folder, index }) => {
              const folderId = getFolderId(folder);
              const noteCount = noteCountsByFolder.get(folderId) || 0;
              
              return (
                <motion.div
                  key={folderId}
                  className="absolute left-0 right-0"
                  style={{ top: index * FOLDER_ROW_HEIGHT, height: FOLDER_ROW_HEIGHT - 6 }}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Folder Card */}
                  <div 
                    className={cn(
                      "flex h-full flex-col items-center gap-1 rounded-lg p-3 cursor-pointer transition-colors group",
                      selectedFolderId === folderId
                        ? "bg-muted" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleFolderClick(folderId)}
                  >
                    {/* Top row with count and actions */}
                    <div className="w-full flex items-center justify-between">
                      {/* Note count badge */}
                      <span className="text-xs text-muted-foreground">
                        {noteCount}
                      </span>

                      {/* Actions */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(folderId);
                            setEditingName(folder.name);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(folderId);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Folder Icon */}
                    <div className="flex-shrink-0 my-1">
                      <Folder
                        color={folder.color}
                        size={0.5}
                        items={[]}
                        isOpen={selectedFolderId === folderId}
                      />
                    </div>
                    
                    {/* Folder Name at bottom */}
                    <div className="w-full text-center">
                      {editingId === folderId ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateFolder(folderId)}
                            className="h-5 text-xs flex-1 text-center"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={() => handleUpdateFolder(folderId)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs font-body truncate block">
                          {folder.name}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="flex gap-2 flex-wrap">
              {folderColors.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    selectedColor === color && "ring-2 ring-offset-2 ring-primary"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This will delete the folder and all its notes. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDeleteFolder(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FoldersSidebar;
