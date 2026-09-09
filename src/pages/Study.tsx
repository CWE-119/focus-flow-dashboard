import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { RecallPanel } from "@/components/RecallPanel";
import { ContinuityPanel } from "@/components/ContinuityPanel";
import { appHref } from "@/lib/study-api";

export default function Study() {
  const [tab, setTab] = useState(() => {
    const query = window.location.protocol === 'file:' ? window.location.hash.split('?')[1] : window.location.search;
    const requested = new URLSearchParams(query).get('tab');
    return ['recall', 'backups'].includes(requested || '') ? requested : 'workspaces';
  });
  return <div className="min-h-screen bg-background px-4 pb-12 pt-12 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div><a className="text-sm text-muted-foreground underline" href={appHref('/')}>← Dashboard</a><h1 className="mt-2 font-display text-3xl font-bold">Study & research</h1></div><nav className="flex flex-wrap gap-2" aria-label="Study sections">{[['workspaces', 'Workspaces'], ['recall', 'Active recall'], ['backups', 'Backups & sync']].map(([value, label]) => <Button key={value} variant={tab === value ? 'default' : 'outline'} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</Button>)}</nav></header>
    {tab === 'workspaces' ? <WorkspacePanel /> : tab === 'recall' ? <RecallPanel /> : <ContinuityPanel />}
  </div></div>;
}
