import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudyData } from "@/hooks/use-study-data";
import { appHref, studyRequest, type Flashcard, type Workspace } from "@/lib/study-api";
import { FlashcardComposer, type CardDraft } from "@/components/FlashcardComposer";

export function RecallPanel() {
  const [workspaceId, setWorkspaceId] = useState("");
  const { data: cards, error, loading } = useStudyData<Flashcard[]>(`/study/cards${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
  const { data: workspaces } = useStudyData<Workspace[]>("/workspaces");
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [reviewed, setReviewed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const due = cards?.filter((card) => Date.parse(card.dueAt) <= now) || [];
  const active = due[0];
  const grade = async (rating: string) => {
    if (!active) return;
    setBusy(true); setActionError("");
    try { await studyRequest(`/study/cards/${active.id}/review`, "POST", { grade: rating, revision: active.revision }); setRevealedId(null); setReviewed((count) => count + 1); setNow(Date.now()); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : "Review was not saved."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Active recall</h2><p className="text-sm text-muted-foreground">{due.length} due · {reviewed} reviewed this visit · {cards?.length || 0} cards</p></div><Button onClick={() => setDraft({ question: "", answer: "", workspaceId })}>New card</Button></div>
    <label className="block text-sm">Filter workspace<select className="ml-3 rounded border border-input bg-background p-2" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setRevealedId(null); }}><option value="">All workspaces</option>{workspaces?.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
    {(error || actionError) && <p role="alert" className="text-destructive">{error || actionError}</p>}
    <section className="rounded-lg border border-border bg-card p-6" aria-label="Review queue">
      {loading ? <p>Loading cards…</p> : active ? <>
        <h3 className="whitespace-pre-wrap text-lg font-medium">{active.question}</h3>
        {active.noteId && <a href={appHref(`/notes?note=${active.noteId}`)} className="mt-2 inline-block text-sm text-primary underline">Source note</a>}
        {revealedId === active.id ? <><p className="my-6 whitespace-pre-wrap border-t border-border pt-4">{active.answer}</p><p className="mb-3 text-sm text-muted-foreground">How well did you recall the answer?</p><div className="flex flex-wrap gap-2">{["again", "hard", "good", "easy"].map((rating) => <Button key={rating} variant={rating === "good" ? "default" : "outline"} disabled={busy} onClick={() => void grade(rating)}>{rating === "again" ? "Again · 10 min" : rating.charAt(0).toUpperCase() + rating.slice(1)}</Button>)}</div></> : <Button className="mt-6 block" onClick={() => setRevealedId(active.id)}>Show answer</Button>}
      </> : <p className="text-muted-foreground">No cards due right now. Create cards from selected note text or glossary definitions, then return when reviews are due.</p>}
    </section>
    <details><summary className="cursor-pointer text-sm font-medium">Manage all cards ({cards?.length || 0})</summary><div className="mt-3 space-y-2">{cards?.map((card) => <div key={card.id} className="flex items-center justify-between gap-3 rounded border border-border p-3"><div className="min-w-0"><p className="truncate text-sm">{card.question}</p><p className="text-xs text-muted-foreground">Due {new Date(card.dueAt).toLocaleString()}</p></div><Button variant="outline" size="sm" onClick={() => setDraft(card)}>Edit</Button><Button variant="ghost" size="sm" disabled={busy} onClick={async () => { if (!window.confirm('Delete this card and its review history?')) return; setBusy(true); try { await studyRequest(`/study/cards/${card.id}`, "DELETE"); } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not delete card.'); } finally { setBusy(false); } }}>Delete</Button></div>)}</div></details>
    {draft && <FlashcardComposer draft={draft} onClose={() => setDraft(null)} />}
  </div>;
}
