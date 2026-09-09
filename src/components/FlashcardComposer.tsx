import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStudyData } from "@/hooks/use-study-data";
import { studyRequest, type Flashcard, type Workspace } from "@/lib/study-api";

export interface CardDraft { question: string; answer: string; workspaceId?: string | null; noteId?: string | number | null; glossaryId?: string | null; id?: string; revision?: number }

export function FlashcardComposer({ draft, onClose }: { draft: CardDraft; onClose: () => void }) {
  const [question, setQuestion] = useState(draft.question);
  const [answer, setAnswer] = useState(draft.answer);
  const [workspaceId, setWorkspaceId] = useState(draft.workspaceId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data: workspaces } = useStudyData<Workspace[]>("/workspaces");
  const save = async () => {
    setBusy(true); setError("");
    try {
      await studyRequest<Flashcard>(`/study/cards${draft.id ? `/${draft.id}` : ""}`, draft.id ? "PUT" : "POST", { ...draft, question, answer, workspaceId: workspaceId || null });
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save card."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{draft.id ? "Edit recall card" : "Create recall card"}</DialogTitle><DialogDescription>Write a question you can answer from memory. The answer stays hidden during review.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div><Label htmlFor="card-question">Question</Label><Textarea id="card-question" required maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} /></div>
      <div><Label htmlFor="card-answer">Answer</Label><Textarea id="card-answer" required maxLength={12000} className="min-h-32" value={answer} onChange={(event) => setAnswer(event.target.value)} /></div>
      <div><Label htmlFor="card-workspace">Workspace</Label><select id="card-workspace" className="mt-1 w-full rounded border border-input bg-background p-2" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}><option value="">Unassigned</option>{workspaces?.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save card"}</Button>
    </form>
  </DialogContent></Dialog>;
}
