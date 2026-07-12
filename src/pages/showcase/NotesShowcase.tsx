import { ArrowLeft, Check, ChevronDown, FileText, Folder, Link2, MoreHorizontal, Network, Pin, Plus, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ShowcaseShell from "./ShowcaseShell";
import { selectedShowcaseNote, showcaseFolders, showcaseNotes } from "./showcase-data";

const NotesShowcase = () => (
  <ShowcaseShell title="A thinking workspace">
    <main className="flex h-full flex-col overflow-hidden px-7 py-6 sm:px-10">
      <header className="mb-4 flex h-16 shrink-0 items-center gap-2 border border-border bg-card px-4">
        <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><Folder className="h-5 w-5" /></Button>
        <h1 className="ml-2 font-display text-3xl font-bold tracking-tighter">NOTES</h1>
        <Badge variant="outline" className="ml-2 gap-2 rounded-full font-normal">
          <span className="h-2 w-2 rounded-full bg-contribution-medium" /> writing session · 32:08
        </Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="icon"><Search className="h-5 w-5" /></Button>
        <Button variant="default" size="icon"><Network className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />New note</Button>
      </header>

      <section className="flex min-h-0 flex-1 overflow-hidden border border-border bg-card">
        <aside className="flex w-[215px] shrink-0 flex-col border-r border-border p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Folders</span>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            {showcaseFolders.map((folder, index) => (
              <div key={folder.id} className={`flex items-center gap-3 px-3 py-3 text-sm ${index === 0 ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: folder.color }} />
                <span className="flex-1">{folder.name}</span>
                <span className="text-[10px]">{folder.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-border pt-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Vault pulse</div>
            <div className="flex items-end gap-1">
              {[30, 58, 42, 75, 52, 84, 66, 96, 70, 88].map((height, index) => (
                <span key={index} className={index > 6 ? "w-full bg-contribution-medium" : "w-full bg-muted"} style={{ height: `${height * 0.32}px` }} />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">31 notes · 46 connections</p>
          </div>
        </aside>

        <aside className="w-[265px] shrink-0 border-r border-border p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Strategy</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            {showcaseNotes.slice(0, 6).map((note, index) => (
              <article key={note.id} className={`cursor-default border-l-2 p-3 ${index === 0 ? "border-primary bg-muted" : "border-transparent hover:bg-muted/50"}`}>
                <div className="flex items-center gap-2">
                  {note.pinned ? <Pin className="h-3 w-3" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                  <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{note.title}</h2>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{note.excerpt}</p>
                <span className="mt-2 block text-[9px] uppercase tracking-wider text-muted-foreground">{note.updated}</span>
              </article>
            ))}
          </div>
        </aside>

        <article className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-[74px] shrink-0 items-center gap-4 border-b border-border px-6">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-3xl font-semibold tracking-tight">{selectedShowcaseNote.title}</h2>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Check className="h-3 w-3 text-contribution-medium" /> Saved · 2 minutes ago
              </div>
            </div>
            <Button variant="ghost" size="sm" className="gap-2"><Pin className="h-4 w-4" />Pinned</Button>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button>
          </div>

          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-5 text-xs text-muted-foreground">
            {['H1', 'H2', 'B', 'I', 'Link', 'Quote', 'Code'].map((tool) => (
              <span key={tool} className="flex h-7 min-w-7 items-center justify-center px-2 hover:bg-muted">{tool}</span>
            ))}
            <div className="flex-1" />
            <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Preview</span>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-hidden px-8 py-6">
              <div className="mx-auto max-w-2xl">
                <p className="font-accent text-lg italic leading-7 text-muted-foreground">
                  A calm, repeatable path from final polish to launch day.
                </p>

                <h3 className="mb-3 mt-6 font-display text-xl font-semibold tracking-tight">The outcome</h3>
                <p className="text-sm leading-6 text-foreground/85">
                  Help people see how FocusFlow turns scattered effort into a visible, connected practice—without adding noise to the day.
                </p>

                <div className="my-5 border-l-2 border-contribution-high bg-muted/55 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">North star</div>
                  <p className="mt-1 font-display text-lg font-medium">Make meaningful progress feel inevitable.</p>
                </div>

                <h3 className="mb-3 font-display text-xl font-semibold tracking-tight">Launch sequence</h3>
                <div className="space-y-2 text-sm">
                  {["Polish the product story and screenshots", "Connect release notes to the public roadmap", "Prepare the demo vault and final build", "Close with a focused daily review"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 items-center justify-center border ${index < 2 ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {index < 2 && <Check className="h-3 w-3" />}
                      </span>
                      <span className={index < 2 ? "text-muted-foreground line-through" : ""}>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {["[[North Star]]", "[[Campaign Systems]]", "[[Deep Work]]", "[[Daily Review]]"].map((link) => (
                    <Badge key={link} variant="outline" className="gap-1 rounded-md bg-card font-normal text-muted-foreground">
                      <Link2 className="h-3 w-3" />{link}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <aside className="hidden w-[230px] shrink-0 border-l border-border bg-card p-5 xl:block">
              <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Connected context</div>
              <div className="space-y-3">
                {["North Star", "Campaign Systems", "Daily Review"].map((title, index) => (
                  <div key={title} className="border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-xs font-medium"><Link2 className="h-3 w-3 text-contribution-medium" />{title}</div>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{index === 0 ? "2 backlinks · 4 mentions" : index === 1 ? "3 backlinks · 2 mentions" : "5 backlinks · updated today"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-2 text-xs"><Network className="h-4 w-4" />Local graph</div>
                <svg viewBox="0 0 180 100" className="h-24 w-full" aria-hidden="true">
                  <g stroke="currentColor" className="text-border"><line x1="90" y1="50" x2="30" y2="22" /><line x1="90" y1="50" x2="150" y2="24" /><line x1="90" y1="50" x2="48" y2="84" /><line x1="90" y1="50" x2="145" y2="80" /></g>
                  <circle cx="90" cy="50" r="8" className="fill-primary" /><circle cx="30" cy="22" r="5" className="fill-contribution-medium" /><circle cx="150" cy="24" r="5" className="fill-contribution-high" /><circle cx="48" cy="84" r="4" className="fill-muted-foreground" /><circle cx="145" cy="80" r="4" className="fill-contribution-low" />
                </svg>
              </div>
            </aside>
          </div>
        </article>
      </section>
    </main>
  </ShowcaseShell>
);

export default NotesShowcase;
