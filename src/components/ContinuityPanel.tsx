import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudyData } from "@/hooks/use-study-data";
import { studyRequest } from "@/lib/study-api";

interface ContinuityStatus { configured: boolean; config: { owner?: string; repo?: string; autoSync?: boolean; autoBackup?: boolean }; lastSyncAt: string | null; lastBackupAt: string | null; lastError: string | null; backups: string[] }
interface Preview { counts: Record<string, number>; localHash: string; createdAt: string }
interface Conflict { conflict: boolean; localHash: string; remoteSha: string | null; localCounts: Record<string, number>; remoteCounts: Record<string, number> }

export function ContinuityPanel() {
  const { data: status, error: loadError, reload } = useStudyData<ContinuityStatus>("/continuity");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [filePassphrase, setFilePassphrase] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [backupName, setBackupName] = useState("");
  const [importFile, setImportFile] = useState("");
  useEffect(() => {
    if (status) { setOwner(status.config.owner || ""); setRepo(status.config.repo || ""); setAutoSync(Boolean(status.config.autoSync)); setAutoBackup(status.config.autoBackup !== false); }
  }, [status]);

  const perform = async (operation: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); await reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Operation failed. Your saved data remains available."); }
    finally { setBusy(false); }
  };
  const sync = (choice?: "local" | "remote") => void perform(async () => {
    const result = await studyRequest<Conflict & { synced?: boolean; restored?: boolean }>("/continuity/sync", "POST", { ...(choice && conflict ? { resolution: { choice, localHash: conflict.localHash, remoteSha: conflict.remoteSha } } : {}) });
    if (result.conflict) { setConflict(result); return; }
    setConflict(null);
    if (result.restored) window.location.reload();
    else setMessage("Encrypted workspace synced with GitHub.");
  });
  const changedRepository = owner !== status?.config.owner || repo !== status?.config.repo;
  return <div className="space-y-6">
    <div><h2 className="font-display text-2xl">Backups & device sync</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Sync an encrypted workspace through your private GitHub repository. Use the same repository and passphrase on each device. Keep a copy of the passphrase: it cannot be recovered from GitHub.</p></div>
    {(error || loadError || status?.lastError) && <p role="alert" className="text-destructive">{error || loadError || status?.lastError}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    <form className="grid gap-4 rounded border border-border p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void perform(async () => { await studyRequest("/continuity", "PUT", { owner, repo, autoSync, autoBackup, ...(token ? { token } : {}), ...(passphrase ? { passphrase } : {}) }); setToken(""); setPassphrase(""); setMessage("Connection saved. Sync now to compare this device with GitHub."); }); }}>
      <label className="text-sm">GitHub owner<Input required value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Your username or organization" /></label>
      <label className="text-sm">Private repository<Input required value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="focusflow-private-backup" /></label>
      <label className="text-sm">GitHub token<Input type="password" autoComplete="new-password" required={!status?.configured || changedRepository} value={token} onChange={(event) => setToken(event.target.value)} placeholder={status?.configured ? "Blank keeps saved token" : "Fine-grained access token"} /></label>
      <label className="text-sm">Sync passphrase<Input type="password" autoComplete="new-password" minLength={12} maxLength={1024} required={!status?.configured || changedRepository} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={status?.configured ? "Blank keeps saved passphrase" : "At least 12 characters"} /></label>
      <p className="text-xs text-muted-foreground sm:col-span-2">Create a dedicated private repository, initialize it with a README, and grant the token Contents: read and write for that repository only. Data is stored as focusflow/workspace.enc.json. Provider tokens and local app settings are excluded from synced snapshots.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoSync} onChange={(event) => setAutoSync(event.target.checked)} /> Check / upload every 15 minutes; remote changes wait for review</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoBackup} onChange={(event) => setAutoBackup(event.target.checked)} /> Daily local backup</label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy || !status}>Save settings</Button><Button type="button" variant="outline" disabled={busy || !status?.configured || changedRepository || Boolean(token || passphrase)} onClick={() => sync()}>Sync now</Button>{status?.configured && <Button type="button" variant="ghost" disabled={busy} onClick={() => void perform(async () => { await studyRequest("/continuity", "DELETE"); setConflict(null); setMessage("Disconnected. Local backups and the GitHub file are kept."); })}>Disconnect GitHub</Button>}</div>
    </form>
    <p className="text-xs text-muted-foreground">Last sync: {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"} · Last backup: {status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : "Not yet"}</p>
    {conflict && <section className="space-y-3 rounded border border-destructive p-4" aria-label="Sync conflict"><h3 className="font-semibold">Both devices have changes</h3><p className="text-sm">Choose the entire workspace to keep. Using GitHub saves a local recovery snapshot first; using this device saves the remote version as a local recovery snapshot before publishing.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Data</th><th>This device</th><th>GitHub</th></tr></thead><tbody>{['notes', 'workspaces', 'flashcards', 'card_reviews', 'study_steps'].map((table) => <tr key={table}><td>{table.replaceAll('_', ' ')}</td><td>{conflict.localCounts[table]}</td><td>{conflict.remoteCounts[table]}</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => sync("local")}>Keep this device & publish</Button><Button disabled={busy} variant="outline" onClick={() => sync("remote")}>Use GitHub & reload</Button><Button variant="ghost" onClick={() => setConflict(null)}>Decide later</Button></div></section>}
    <section className="space-y-3 rounded border border-border p-4"><h3 className="font-semibold">Local recovery snapshots</h3><p className="text-sm text-muted-foreground">Local backups work without GitHub and retain the latest 30 daily snapshots. Manual and recovery snapshots are kept. They are encrypted with this device's local key; use portable export for another device.</p><Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await studyRequest("/continuity/backup", "POST", {}); setMessage("Local backup created."); })}>Back up now</Button>
      <div className="max-h-60 space-y-2 overflow-y-auto">{status?.backups.map((name) => <div key={name} className="flex items-center justify-between gap-3 text-sm"><span>{new Date(Number(name.split('-')[0])).toLocaleString()} · {name.includes('before-restore') ? "Recovery" : name.includes('conflict-remote') ? "Remote conflict copy" : name.includes('auto') ? "Daily" : "Manual"}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => void perform(async () => { setPreview(await studyRequest<Preview>("/continuity/preview", "POST", { name })); setBackupName(name); setImportFile(""); })}>Preview restore</Button></div>)}</div>
    </section>
    <section className="space-y-3 rounded border border-border p-4"><h3 className="font-semibold">Portable encrypted export / import</h3><p className="text-sm text-muted-foreground">Export includes notes, drawings, annotations, tasks, reminders, deadlines, glossary, workspaces, cards, and review history. Browser-only preferences and offline drafts are not included; save notes before exporting or restoring.</p><label className="block max-w-md text-sm">File passphrase<Input type="password" autoComplete="new-password" value={filePassphrase} onChange={(event) => { setFilePassphrase(event.target.value); setPreview(null); }} placeholder="At least 12 characters" /></label><div className="flex flex-wrap items-center gap-3"><Button disabled={busy || filePassphrase.length < 12} variant="outline" onClick={() => void perform(async () => { const result = await studyRequest<{ file: string }>("/continuity/export", "POST", { passphrase: filePassphrase }); const url = URL.createObjectURL(new Blob([result.file], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `focusflow-${new Date().toISOString().slice(0, 10)}.enc.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Encrypted export downloaded."); })}>Download encrypted export</Button><label className="text-sm">Choose encrypted file<input className="block max-w-xs text-sm" type="file" accept=".json" disabled={busy || !filePassphrase} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void perform(async () => { if (file.size > 32 * 1024 * 1024) throw new Error('File exceeds 32 MB.'); const raw = await file.text(); setPreview(await studyRequest<Preview>("/continuity/import-preview", "POST", { file: raw, passphrase: filePassphrase })); setImportFile(raw); setBackupName(""); }); }} /></label></div></section>
    {preview && <section className="space-y-3 rounded border border-primary p-4" aria-label="Restore preview"><h3 className="font-semibold">Restore preview · {new Date(preview.createdAt).toLocaleString()}</h3><p className="text-sm">{Object.entries(preview.counts).filter(([, count]) => count).map(([table, count]) => `${count} ${table.replaceAll('_', ' ')}`).join(' · ')}</p><p className="text-sm">Restoring replaces the saved workspace and reloads the app. A recovery snapshot is created first. Save any open drafts on other windows before continuing.</p><Button disabled={busy} onClick={() => void perform(async () => { await studyRequest(importFile ? "/continuity/import" : "/continuity/restore", "POST", importFile ? { file: importFile, passphrase: filePassphrase, localHash: preview.localHash } : { name: backupName, localHash: preview.localHash }); window.location.reload(); })}>Restore this snapshot & reload</Button><Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button></section>}
  </div>;
}
