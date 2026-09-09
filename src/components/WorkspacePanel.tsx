import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatLocalDateKey } from "@/lib/api";
import { appHref, studyRequest, type Workspace, type WorkspaceDetail, type StudyNote, type StudyDeadline, type StudySession } from "@/lib/study-api";
import { useStudyData } from "@/hooks/use-study-data";

function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, error, loading } = useStudyData<WorkspaceDetail>(`/workspaces/${workspaceId}`);
  const { data: notes } = useStudyData<StudyNote[]>("/notes");
  const { data: deadlines } = useStudyData<StudyDeadline[]>("/deadlines");
  const { data: sessions } = useStudyData<StudySession[]>("/history/activity");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [linkKind, setLinkKind] = useState("notes");
  const [targetId, setTargetId] = useState("");
  const [readingTitle, setReadingTitle] = useState("");
  const [readingURL, setReadingURL] = useState("");
  const [deadlineId, setDeadlineId] = useState("");
  const [minutes, setMinutes] = useState(180);
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [startDate, setStartDate] = useState(formatLocalDateKey());
  const perform = async (operation: () => Promise<unknown>) => {
    setBusy(true); setActionError("");
    try { await operation(); return true; } catch (failure) { setActionError(failure instanceof Error ? failure.message : "Could not save changes."); return false; } finally { setBusy(false); }
  };
  const linkOptions = linkKind === "notes" ? notes?.map((note) => ({ id: String(note.id), title: note.title }))
    : linkKind === "deadlines" ? deadlines?.map((deadline) => ({ id: deadline.id, title: `${deadline.title} · ${deadline.end.slice(0, 10)}` }))
      : sessions?.map((session) => ({ id: String(session.id), title: `${session.date} · ${session.duration || 0} min · ${session.action || "Focus"}` }));
  if (loading) return <p>Loading workspace…</p>;
  if (!workspace) return <p role="alert" className="text-destructive">{error || "Workspace unavailable."}</p>;
  const unlink = (kind: string, target: string | number) => void perform(() => studyRequest(`/workspaces/${workspaceId}/links/${kind}/${target}`, "DELETE"));
  return <div className="space-y-6">
    <div><h2 className="font-display text-2xl">{workspace.name}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{workspace.description}</p><p className="mt-2 text-sm">{workspace.notes.length} notes · {workspace.deadlines.length} deadlines · {workspace.sessions.reduce((total, session) => total + (session.duration || 0), 0)} focus minutes</p></div>
    {(error || actionError) && <p role="alert" className="text-destructive">{error || actionError}</p>}
    <form className="flex flex-wrap items-end gap-2 rounded border border-border p-4" onSubmit={(event) => { event.preventDefault(); void perform(() => studyRequest(`/workspaces/${workspaceId}/links/${linkKind}`, "POST", { targetId })); }}>
      <label className="text-sm">Link existing<select className="mt-1 block rounded border border-input bg-background p-2" value={linkKind} onChange={(event) => { setLinkKind(event.target.value); setTargetId(""); }}><option value="notes">Note</option><option value="deadlines">Assignment / deadline</option><option value="sessions">Focus session</option></select></label>
      <label className="min-w-48 flex-1 text-sm">Item<select required className="mt-1 block w-full rounded border border-input bg-background p-2" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose an item</option>{linkOptions?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><Button disabled={busy}>Link item</Button>
    </form>
    <div className="grid gap-5 md:grid-cols-2">
      <section className="space-y-2 rounded border border-border p-4"><h3 className="font-semibold">Notes</h3>{!workspace.notes.length && <p className="text-sm text-muted-foreground">Link lecture notes, drafts, or research notes.</p>}{workspace.notes.map((note) => <div key={note.id} className="flex items-center justify-between gap-2"><a className="truncate text-sm text-primary underline" href={appHref(`/notes?note=${note.id}`)}>{note.title}</a><Button size="sm" variant="ghost" disabled={busy} onClick={() => unlink("notes", note.id)}>Unlink</Button></div>)}</section>
      <section className="space-y-2 rounded border border-border p-4"><h3 className="font-semibold">Assignments & deadlines</h3>{!workspace.deadlines.length && <p className="text-sm text-muted-foreground">Import dates from Connections on the dashboard, then link them here.</p>}{workspace.deadlines.map((deadline) => <div key={deadline.id} className="flex items-center justify-between gap-2"><div><p className="text-sm">{deadline.title}</p><p className="text-xs text-muted-foreground">{deadline.end.length === 10 ? deadline.end : new Date(deadline.end).toLocaleString()}</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={() => unlink("deadlines", deadline.id)}>Unlink</Button></div>)}</section>
    </div>
    <section className="space-y-3 rounded border border-border p-4"><h3 className="font-semibold">Reading list</h3><form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); if (await perform(() => studyRequest(`/workspaces/${workspaceId}/readings`, "POST", { title: readingTitle, url: readingURL }))) { setReadingTitle(""); setReadingURL(""); } }}><Input aria-label="Reading title" placeholder="Reading title" required maxLength={200} value={readingTitle} onChange={(event) => setReadingTitle(event.target.value)} className="min-w-40 flex-1" /><Input aria-label="Reading URL" placeholder="https://…" type="url" required value={readingURL} onChange={(event) => setReadingURL(event.target.value)} className="min-w-48 flex-1" /><Button disabled={busy}>Add reading</Button></form>{workspace.readings.map((reading) => <div key={reading.id} className="flex items-center gap-3"><input type="checkbox" aria-label={`Finish ${reading.title}`} checked={Boolean(reading.completed)} disabled={busy} onChange={(event) => void perform(() => studyRequest(`/study/items/readings/${reading.id}`, "PUT", { completed: event.target.checked }))} /><a className={`flex-1 text-sm text-primary underline ${reading.completed ? "line-through" : ""}`} href={reading.url} target="_blank" rel="noopener noreferrer">{reading.title}</a><Button variant="ghost" size="sm" disabled={busy} onClick={() => void perform(() => studyRequest(`/study/items/readings/${reading.id}`, "DELETE"))}>Remove</Button></div>)}</section>
    <section className="space-y-3 rounded border border-border p-4"><h3 className="font-semibold">Plan backwards from a deadline</h3><p className="text-sm text-muted-foreground">Reserve study blocks before the due day. Estimate the total effort and set your daily budget.</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void perform(() => studyRequest(`/workspaces/${workspaceId}/plan`, "POST", { deadlineId, minutes, dailyMinutes, startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })); }}>
        <label className="text-sm">Deadline<select required value={deadlineId} onChange={(event) => setDeadlineId(event.target.value)} className="mt-1 block w-full rounded border border-input bg-background p-2"><option value="">Choose linked deadline</option>{workspace.deadlines.map((deadline) => <option key={deadline.id} value={deadline.id}>{deadline.title}</option>)}</select></label>
        <label className="text-sm">Start no earlier than<Input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="text-sm">Total estimated minutes<Input type="number" required min={1} max={60000} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
        <label className="text-sm">Maximum minutes per day<Input type="number" required min={15} max={480} value={dailyMinutes} onChange={(event) => setDailyMinutes(Number(event.target.value))} /></label>
        <Button disabled={busy || !workspace.deadlines.length}>Generate study plan</Button>
      </form>
      {workspace.steps.map((step) => <div key={step.id} className="flex items-center gap-3 rounded bg-muted/50 p-2"><input type="checkbox" aria-label={`Complete ${step.title} ${step.date}`} checked={Boolean(step.completed)} disabled={busy} onChange={(event) => void perform(() => studyRequest(`/study/items/study_steps/${step.id}`, "PUT", { completed: event.target.checked }))} /><div className="flex-1 text-sm"><p className={step.completed ? "line-through" : ""}>{step.date} · {step.minutes} min · {step.title}</p>{workspace.deadlines.find((deadline) => deadline.id === step.deadlineId)?.end !== step.targetEnd && <p className="text-xs text-destructive">Deadline changed or was unlinked. Review this plan.</p>}</div><Button variant="ghost" size="sm" disabled={busy} onClick={() => void perform(() => studyRequest(`/study/items/study_steps/${step.id}`, "DELETE"))}>Remove</Button></div>)}
    </section>
    <details><summary className="cursor-pointer text-sm font-medium">Linked focus sessions ({workspace.sessions.length})</summary>{workspace.sessions.map((session) => <div key={session.id} className="mt-2 flex items-center justify-between text-sm"><span>{session.date} · {session.startTime}–{session.endTime} · {session.duration} minutes</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => unlink("sessions", session.id)}>Unlink</Button></div>)}</details>
  </div>;
}

export function WorkspacePanel() {
  const { data: workspaces, error } = useStudyData<Workspace[]>("/workspaces");
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("course");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <aside className="space-y-4"><h2 className="font-display text-xl">Course & research workspaces</h2>{(error || actionError) && <p role="alert" className="text-sm text-destructive">{error || actionError}</p>}
      <div className="space-y-1">{workspaces?.map((workspace) => <div key={workspace.id} className="flex gap-1"><Button variant={selected === workspace.id ? "secondary" : "ghost"} className="min-w-0 flex-1 justify-start truncate" onClick={() => setSelected(workspace.id)}>{workspace.name}</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(workspace.id); setName(workspace.name); setKind(workspace.kind); setDescription(workspace.description); }}>Edit</Button></div>)}</div>
      <form className="space-y-3 rounded border border-border p-3" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setActionError(""); try { const workspace = await studyRequest<Workspace>(`/workspaces${editing ? `/${editing}` : ""}`, editing ? "PUT" : "POST", { name, kind, description }); setSelected(workspace.id); setEditing(null); setName(""); setDescription(""); } catch (failure) { setActionError(failure instanceof Error ? failure.message : "Could not save workspace."); } finally { setBusy(false); } }}>
        <Label htmlFor="workspace-name">{editing ? "Edit workspace" : "New workspace"}</Label><Input id="workspace-name" required maxLength={120} placeholder="Biology 101" value={name} onChange={(event) => setName(event.target.value)} />
        <select aria-label="Workspace type" className="w-full rounded border border-input bg-background p-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}><option value="course">Course</option><option value="research">Research project</option></select>
        <Textarea aria-label="Workspace description" placeholder="Goals, syllabus, or research question" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /><Button disabled={busy} className="w-full">{editing ? "Save workspace" : "Create workspace"}</Button>
        {editing && <><Button type="button" variant="ghost" onClick={() => { setEditing(null); setName(""); setDescription(""); }}>Cancel</Button><Button type="button" variant="destructive" disabled={busy} onClick={async () => { if (!window.confirm('Delete this workspace, its reading list, and study plan? Notes, deadlines, focus sessions, and cards are kept.')) return; setBusy(true); try { await studyRequest(`/workspaces/${editing}`, "DELETE"); if (selected === editing) setSelected(""); setEditing(null); setName(""); setDescription(""); } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not delete workspace.'); } finally { setBusy(false); } }}>Delete</Button></>}
      </form>
    </aside>
    <div>{selected ? <WorkspaceView key={selected} workspaceId={selected} /> : <p className="rounded-lg border border-dashed border-border p-10 text-muted-foreground">Create or select a workspace to bring its notes, assignments, readings, and focus sessions together.</p>}</div>
  </div>;
}
