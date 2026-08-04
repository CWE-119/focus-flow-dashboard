import { useMemo, useState } from "react";
import { useNotes } from "@/contexts/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  ChevronRight,
  FolderPlus,
  Folder as FolderIcon,
  FolderOpen,
} from "lucide-react";
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
  "#2C2C2C",
];

interface TreeNode {
  id: string;
  name: string;
  color?: string | null;
  children: TreeNode[];
}

const FoldersSidebar = () => {
  const {
    folders,
    allNotes,
    selectedFolderId,
    selectFolder,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useNotes();

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(folderColors[0]);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const noteCountsByFolder = useMemo(() => {
    const counts = new Map<string, number>();
    allNotes.forEach((note) => {
      const folderId = getNoteFolderId(note);
      if (!folderId) return;
      counts.set(folderId, (counts.get(folderId) || 0) + 1);
    });
    return counts;
  }, [allNotes]);

  const tree = useMemo<TreeNode[]>(() => {
    const q = folderQuery.trim().toLowerCase();
    const nodes = new Map<string, TreeNode>();
    folders.forEach((folder) => {
      nodes.set(getFolderId(folder), {
        id: getFolderId(folder),
        name: folder.name,
        color: folder.color,
        children: [],
      });
    });

    const roots: TreeNode[] = [];
    folders.forEach((folder) => {
      const id = getFolderId(folder);
      const node = nodes.get(id)!;
      const parentId = folder.parentId == null ? "" : String(folder.parentId);
      const parent = parentId ? nodes.get(parentId) : undefined;
      if (parent && parent.id !== id) parent.children.push(node);
      else roots.push(node);
    });

    if (!q) return roots;

    // Keep nodes matching the query, plus their ancestors
    const filter = (list: TreeNode[]): TreeNode[] =>
      list
        .map((node) => {
          const children = filter(node.children);
          const matches = node.name.toLowerCase().includes(q);
          if (matches || children.length) return { ...node, children };
          return null;
        })
        .filter(Boolean) as TreeNode[];

    return filter(roots);
  }, [folders, folderQuery]);

  const totalSubtreeCount = (node: TreeNode): number =>
    (noteCountsByFolder.get(node.id) || 0) +
    node.children.reduce((sum, child) => sum + totalSubtreeCount(child), 0);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder = await createFolder(newFolderName.trim(), selectedColor, parentForNew);
    if (folder) {
      if (parentForNew) setCollapsed((prev) => ({ ...prev, [parentForNew]: false }));
      selectFolder(getFolderId(folder));
    }
    setNewFolderName("");
    setParentForNew(null);
    setIsCreating(false);
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

  const renderNode = (node: TreeNode, depth: number) => {
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const isOpen = hasChildren && !collapsed[node.id];
    const count = totalSubtreeCount(node);

    return (
      <div key={node.id}>
        <motion.div
          layout
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "group flex items-center gap-1 rounded-md pr-1 py-1 cursor-pointer transition-colors border border-transparent",
            isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/60"
          )}
          style={{ paddingLeft: 4 + depth * 14 }}
          onClick={() => selectFolder(node.id)}
        >
          <button
            className={cn(
              "h-4 w-4 flex items-center justify-center flex-shrink-0 text-muted-foreground transition-transform",
              !hasChildren && "opacity-0 pointer-events-none",
              isOpen && "rotate-90"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((prev) => ({ ...prev, [node.id]: !collapsed[node.id] }));
            }}
            aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {isSelected || isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: node.color || undefined }} />
          ) : (
            <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: node.color || undefined }} />
          )}

          {editingId === node.id ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateFolder(node.id)}
                className="h-6 text-xs flex-1"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateFolder(node.id)}>
                <Check className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-xs font-body truncate flex-1">{node.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums group-hover:hidden">
                {count || ""}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  title="New subfolder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentForNew(node.id);
                    setIsCreating(true);
                  }}
                >
                  <FolderPlus className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(node.id);
                    setEditingName(node.name);
                  }}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:text-destructive"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(node.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </motion.div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key={`${node.id}-children`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5">
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const parentName = parentForNew
    ? folders.find((f) => getFolderId(f) === parentForNew)?.name
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-semibold text-lg">Folders</h3>
          <p className="text-[11px] text-muted-foreground">
            {folders.length} {folders.length === 1 ? "folder" : "folders"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setParentForNew(null);
            setIsCreating(true);
          }}
          title="New Folder"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={folderQuery}
          onChange={(e) => setFolderQuery(e.target.value)}
          placeholder="Filter folders..."
          className="h-8 text-xs pl-8"
        />
      </div>

      {/* Tree */}
      <div className="sidebar-scroll flex-1 overflow-y-auto overscroll-contain pt-1 pr-1 space-y-0.5">
        {tree.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {folderQuery ? "No matching folders" : "No folders yet"}
          </p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {parentName ? `New subfolder in “${parentName}”` : "Create New Folder"}
            </DialogTitle>
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
            This will delete the folder, all of its subfolders and their notes. This action cannot be undone.
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
