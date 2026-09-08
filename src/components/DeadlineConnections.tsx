import { useCallback, useEffect, useState } from "react";
import { CalendarClock, RefreshCw, Settings2 } from "lucide-react";
import { deadlineIntegrationsAPI, type DeadlineConnection } from "@/lib/api";
import { useDeadlines } from "@/hooks/use-deadlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function ConnectionForm({ connection, onChange }: { connection: DeadlineConnection; onChange: (connections: DeadlineConnection[]) => void }) {
  const { refresh } = useDeadlines();
  const [baseUrl, setBaseUrl] = useState(connection.settings.baseUrl || "");
  const [calendarId, setCalendarId] = useState(connection.settings.calendarId || "primary");
  const [authMode, setAuthMode] = useState(connection.settings.authMode || "accessToken");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const provider = connection.provider;
  const name = provider === "canvas" ? "Canvas LMS" : "Google Calendar";
  const changed = provider === "canvas" ? baseUrl.replace(/\/$/, "") !== (connection.settings.baseUrl || "")
    : calendarId.trim() !== connection.settings.calendarId || authMode !== connection.settings.authMode;

  const perform = async (action: "save" | "sync" | "disconnect") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "sync") {
        const result = await deadlineIntegrationsAPI.sync(provider);
        if (!result.success || !result.data) throw new Error(result.error || "Sync failed.");
        const refreshed = await refresh();
        setMessage(`${result.data.count} end dates synced.${refreshed ? "" : " Reload the dashboard to view them."}`);
        const status = await deadlineIntegrationsAPI.getAll();
        if (status.success && status.data) onChange(status.data);
      } else {
        const result = action === "disconnect" ? await deadlineIntegrationsAPI.disconnect(provider)
          : await deadlineIntegrationsAPI.save(provider, {
            ...(provider === "canvas" ? { baseUrl: baseUrl.trim() } : { calendarId: calendarId.trim(), authMode }),
            ...(credential.trim() ? { credential: credential.trim() } : {}),
          });
        if (!result.success || !result.data) throw new Error(result.error || "Could not save connection.");
        onChange(result.data);
        setCredential("");
        setMessage(action === "disconnect" ? "Credential removed. Previously imported dates are kept." : "Connection saved. Choose Sync now to import dates.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Connection failed.");
    } finally { setBusy(false); }
  };

  return (
    <form className="space-y-3 rounded-md border border-border p-4" onSubmit={(event) => { event.preventDefault(); void perform("save"); }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{name}</h3>
        <span className="text-xs text-muted-foreground">{connection.configured ? "Credential saved" : "Not connected"}</span>
      </div>
      {provider === "canvas" ? (
        <div className="space-y-1">
          <Label htmlFor="canvas-url">School Canvas URL</Label>
          <Input id="canvas-url" type="url" required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://school.instructure.com" disabled={busy} />
          <p className="text-xs text-muted-foreground">Create a personal access token in Canvas → Account → Settings → Approved Integrations. Your school must allow API access.</p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="google-mode">Calendar access</Label>
            <select id="google-mode" value={authMode} disabled={busy} onChange={(event) => setAuthMode(event.target.value as "apiKey" | "accessToken")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="accessToken">Private calendar — OAuth access token</option>
              <option value="apiKey">Public calendar — API key</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="google-calendar">Calendar ID</Label>
            <Input id="google-calendar" required value={calendarId} onChange={(event) => setCalendarId(event.target.value)} disabled={busy} />
          </div>
          <p className="text-xs text-muted-foreground">{authMode === "accessToken"
            ? "Use a Google OAuth access token with calendar.events.readonly permission. Tokens expire; replace yours here when needed. Use primary for your own calendar."
            : "Enable Google Calendar API in your Google Cloud project. An API key reads public calendars only. Copy the calendar ID from Google Calendar → Settings → Integrate calendar."}</p>
        </>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${provider}-credential`}>{provider === "google" && authMode === "apiKey" ? "API key" : "Access token"}</Label>
        <Input id={`${provider}-credential`} type="password" autoComplete="new-password" spellCheck={false} required={!connection.configured || changed} value={credential} onChange={(event) => setCredential(event.target.value)} disabled={busy} placeholder={connection.configured && !changed ? "Leave blank to keep saved credential" : "Paste credential"} />
      </div>
      <p className="text-xs text-muted-foreground">Last synced: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : "Never"}</p>
      <a className="inline-block text-xs text-primary underline" target="_blank" rel="noopener noreferrer" href={provider === "canvas"
        ? "https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth"
        : authMode === "accessToken" ? "https://developers.google.com/oauthplayground/"
          : "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"}>
        {provider === "canvas" ? "Canvas token setup guide" : authMode === "accessToken" ? "Get a token in Google's OAuth Playground" : "Enable Google Calendar API"}
      </a>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" disabled={busy}>Save connection</Button>
        <Button size="sm" variant="outline" type="button" disabled={busy || !connection.configured || changed || Boolean(credential)} onClick={() => void perform("sync")}>
          <RefreshCw className={`mr-1 h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Sync now
        </Button>
        {connection.configured && <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => void perform("disconnect")}>Disconnect</Button>}
      </div>
    </form>
  );
}

export function DeadlineConnections() {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<DeadlineConnection[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await deadlineIntegrationsAPI.getAll();
    if (result.success && result.data) setConnections(result.data);
    else setError(result.error || "Start the backend to configure connections.");
    setLoading(false);
  }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs"><Settings2 className="h-3.5 w-3.5" /> Connections</Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> End date connections</DialogTitle>
          <DialogDescription>Import Canvas assignments and Google Calendar events into End dates and Activity. Sync is manual and reads the past 30 days and next 365 days.</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Credentials are encrypted locally and never sent back to the browser. Disconnect keeps imported dates. Sync updates moved dates and removes missing imports from the past 30 days and future, while retaining older dates in Activity.</p>
        {loading ? <p role="status">Loading connections…</p> : error ? <div><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Retry</Button></div> :
          connections.map((connection) => <ConnectionForm key={connection.provider} connection={connection} onChange={setConnections} />)}
      </DialogContent>
    </Dialog>
  );
}
