import { describe, expect, it } from "vitest";
import { readMarkdownImportFiles, uniqueImportTitle } from "@/lib/markdown-vault";
import type { LinkableNote } from "@/lib/note-links";

const markdownFile = (content: string, name: string, webkitRelativePath = name) => ({
  name,
  webkitRelativePath,
  text: async () => content,
});

describe("markdown vault import", () => {
  it("preserves folder names from markdown folder imports", async () => {
    const imports = await readMarkdownImportFiles([
      markdownFile("# Alpha", "Alpha.md", "Projects/Research/Alpha.md"),
      markdownFile("# Beta", "Beta.md", "Daily/Beta.md"),
      markdownFile("Ignore me", "notes.txt", "Daily/notes.txt"),
    ] as unknown as File[]);

    expect(imports).toEqual([
      { title: "Alpha", content: "# Alpha", folderName: "Research", annotations: null },
      { title: "Beta", content: "# Beta", folderName: "Daily", annotations: null },
    ]);
  });

  it("pairs annotation sidecars with imported markdown notes", async () => {
    const imports = await readMarkdownImportFiles([
      markdownFile("# Alpha", "Alpha.md", "Projects/Research/Alpha.md"),
      markdownFile('{"version":2,"noteId":"10","annotations":[{"id":"ann-1","type":"text","x":1,"y":2,"text":"Hi","fontSize":16,"color":"#000"}]}', "Alpha.annotations.json", "Projects/Research/Alpha.annotations.json"),
    ] as unknown as File[]);

    expect(imports[0].annotations?.annotations).toHaveLength(1);
    expect(imports[0].annotations?.annotations[0].id).toBe("ann-1");
  });

  it("generates stable titles when imported notes collide", () => {
    const existing: LinkableNote[] = [
      { id: 1, title: "Alpha" },
      { id: 2, title: "Alpha 2" },
    ];

    expect(uniqueImportTitle("Alpha", existing)).toBe("Alpha 3");
    expect(uniqueImportTitle("Beta", existing)).toBe("Beta");
  });
});
