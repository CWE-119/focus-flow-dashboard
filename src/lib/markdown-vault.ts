import { getNoteFolderId, getNoteId, type LinkableNote } from "@/lib/note-links";
import { getApiBaseUrl } from "@/lib/api";
import type { AnnotationDocument } from "@/components/editor/useAnnotations";

export interface ExportFolder {
  _id?: string;
  id?: string;
  name: string;
}

const safeName = (value: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "Untitled";

const noteFileName = (note: LinkableNote) => `${safeName(note.title)}.md`;

const downloadFile = (name: string, content: string, type = "text/markdown;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const sidecarFileName = (note: LinkableNote) => noteFileName(note).replace(/\.md$/i, ".annotations.json");

const fetchAnnotationDocument = async (note: LinkableNote): Promise<AnnotationDocument | null> => {
  const id = getNoteId(note);
  if (!id) return null;
  try {
    const response = await fetch(`${getApiBaseUrl()}/annotations/${id}`);
    if (!response.ok) return null;
    const doc = await response.json();
    if (!doc?.annotations?.length) return null;
    return {
      version: doc.version || 2,
      noteId: String(id),
      canvas: doc.canvas,
      annotations: doc.annotations,
    };
  } catch {
    return null;
  }
};

export const exportMarkdownVault = async (notes: LinkableNote[], folders: ExportFolder[]) => {
  const folderById = new Map(folders.map((folder) => [folder._id || folder.id || "", folder]));
  const picker = (window as any).showDirectoryPicker;

  if (picker) {
    const root = await picker({ mode: "readwrite" });
    const used = new Map<string, number>();

    for (const note of notes) {
      const folder = folderById.get(getNoteFolderId(note) || "");
      const dirName = safeName(folder?.name || "Unfiled");
      const dir = await root.getDirectoryHandle(dirName, { create: true });
      const baseName = noteFileName(note);
      const count = used.get(`${dirName}/${baseName}`) || 0;
      used.set(`${dirName}/${baseName}`, count + 1);
      const fileName = count ? baseName.replace(/\.md$/i, ` ${count + 1}.md`) : baseName;
      const file = await dir.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(note.content || "");
      await writable.close();

      const annotations = await fetchAnnotationDocument(note);
      if (annotations) {
        const sidecar = await dir.getFileHandle(fileName.replace(/\.md$/i, ".annotations.json"), { create: true });
        const sidecarWritable = await sidecar.createWritable();
        await sidecarWritable.write(JSON.stringify(annotations, null, 2));
        await sidecarWritable.close();
      }
    }
    return { mode: "directory" as const, count: notes.length };
  }

  for (const note of notes) {
    const folder = folderById.get(getNoteFolderId(note) || "");
    const prefix = folder ? `${safeName(folder.name)} - ` : "";
    downloadFile(`${prefix}${noteFileName(note)}`, note.content || "");
    const annotations = await fetchAnnotationDocument(note);
    if (annotations) {
      downloadFile(
        `${prefix}${sidecarFileName(note)}`,
        JSON.stringify(annotations, null, 2),
        "application/json;charset=utf-8"
      );
    }
  }
  return { mode: "downloads" as const, count: notes.length };
};

export const readMarkdownImportFiles = async (files: FileList | File[]) => {
  const allFiles = Array.from(files);
  const sidecars = new Map<string, File>();
  allFiles
    .filter((file) => /\.annotations\.json$/i.test(file.name))
    .forEach((file) => {
      const relativePath = (file as any).webkitRelativePath || file.name;
      sidecars.set(relativePath.replace(/\.annotations\.json$/i, ".md"), file);
    });

  const markdownFiles = allFiles.filter((file) => /\.md$/i.test(file.name));
  return Promise.all(
    markdownFiles.map(async (file) => {
      const content = await file.text();
      const relativePath = (file as any).webkitRelativePath || file.name;
      const parts = relativePath.split("/").filter(Boolean);
      const fileName = parts.pop() || file.name;
      const folderName = parts.length ? parts[parts.length - 1] : "Imported";
      const sidecar = sidecars.get(relativePath);
      let annotations: AnnotationDocument | null = null;
      if (sidecar) {
        try {
          annotations = JSON.parse(await sidecar.text()) as AnnotationDocument;
        } catch {
          annotations = null;
        }
      }
      return {
        title: fileName.replace(/\.md$/i, "") || "Untitled",
        content,
        folderName,
        annotations,
      };
    })
  );
};

export const uniqueImportTitle = (title: string, existing: LinkableNote[]) => {
  const titles = new Set(existing.map((note) => note.title.toLowerCase()));
  if (!titles.has(title.toLowerCase())) return title;
  let index = 2;
  while (titles.has(`${title} ${index}`.toLowerCase())) index += 1;
  return `${title} ${index}`;
};
