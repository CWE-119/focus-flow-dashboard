import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Notes from "@/pages/Notes";

vi.mock("@/contexts/NoteTimerContext", () => ({
  useNoteTimer: () => ({
    time: 0,
    isRunning: false,
    noteTitle: null,
    toggleTimer: vi.fn(),
    resetTimer: vi.fn(),
    saveSession: vi.fn(),
    startTimer: vi.fn(),
  }),
  useNoteTimerState: () => ({
    time: 0,
    isRunning: false,
    noteTitle: null,
  }),
  useNoteTimerActions: () => ({
    toggleTimer: vi.fn(),
    resetTimer: vi.fn(),
    saveSession: vi.fn(),
    startTimer: vi.fn(),
    pauseTimer: vi.fn(),
  }),
}));

vi.mock("@/components/ActiveTimerIndicator", () => ({
  ActiveTimerIndicator: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

const folder = {
  id: "1",
  _id: "1",
  name: "Knowledge",
  color: "#547792",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const note = {
  id: "10",
  _id: "10",
  title: "Alpha Note",
  content: "[[Beta Note]]\n\nAlpha body",
  folderId: "1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Notes workspace smoke", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/folders")) {
          return Response.json([folder]);
        }
        if (url.endsWith("/notes")) {
          return Response.json([note]);
        }
        if (url.endsWith("/notes/folder/1")) {
          return Response.json([note]);
        }
        if (url.endsWith("/notes/10/references")) {
          return Response.json({
            backlinks: [],
            outgoingLinks: [],
            missingLinks: [{ target: "Beta Note", type: "missing" }],
            unlinkedMentions: [],
          });
        }
        if (url.endsWith("/notes/10/view")) {
          return Response.json({ success: true });
        }
        return Response.json([]);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads folders and notes from the backend contract", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Notes />
      </MemoryRouter>
    );

    const folderButton = await screen.findByText("Knowledge");
    fireEvent.click(folderButton);

    await waitFor(() => {
      expect(screen.getByText("Alpha Note")).toBeInTheDocument();
    });
  });
});
