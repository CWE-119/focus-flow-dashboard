import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecallPanel } from '@/components/RecallPanel';
import { FlashcardComposer } from '@/components/FlashcardComposer';
import { ContinuityPanel } from '@/components/ContinuityPanel';

const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
let reviewed = false;
let synced = false;
beforeEach(() => {
  calls.length = 0; reviewed = false; synced = false;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const pathname = new URL(String(input)).pathname.replace('/api', '');
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(String(options.body)) : {};
    calls.push({ path: pathname, method, body });
    if (pathname === '/workspaces') return Response.json([{ id: 'course', name: 'Biology', kind: 'course' }]);
    if (pathname.endsWith('/review')) { reviewed = true; return Response.json({}); }
    if (pathname === '/study/cards') return Response.json(method === 'GET' ? [{ id: 'card', question: 'What is a cell?', answer: 'Basic unit of life', revision: 1, dueAt: reviewed ? '2099-01-01T00:00:00Z' : '2020-01-01T00:00:00Z' }] : {});
    if (pathname === '/continuity') return Response.json({ configured: true, config: { owner: 'student', repo: 'private-notes', autoBackup: true, autoSync: false }, backups: [], lastSyncAt: null, lastBackupAt: null });
    if (pathname === '/continuity/sync') { if (body.resolution) { synced = true; return Response.json({ synced: true }); } return Response.json({ conflict: true, localHash: 'local-version', remoteSha: 'remote-version', localCounts: { notes: 1 }, remoteCounts: { notes: 2 } }); }
    return Response.json({});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Study workflows', () => {
  it('hides the answer until revealed and records a revision-checked review', async () => {
    render(<RecallPanel />);
    expect(await screen.findByRole('heading', { name: 'What is a cell?' })).toBeInTheDocument();
    expect(screen.queryByText('Basic unit of life')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('Basic unit of life')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/review') && call.body.grade === 'good' && call.body.revision === 1)).toBe(true));
    expect(await screen.findByText(/No cards due right now/)).toBeInTheDocument();
  });
  it('creates an editable source-linked card from a selected passage', async () => {
    const close = vi.fn();
    render(<FlashcardComposer draft={{ question: 'Explain cell theory', answer: 'Selected passage', noteId: 12 }} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What does cell theory predict?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ noteId: 12, question: 'What does cell theory predict?', answer: 'Selected passage' });
  });
  it('requires an explicit version-bound choice for divergent GitHub data', async () => {
    render(<ContinuityPanel />);
    const button = await screen.findByRole('button', { name: 'Sync now' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    expect(await screen.findByText('Both devices have changes')).toBeInTheDocument();
    expect(synced).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this device & publish' }));
    await waitFor(() => expect(synced).toBe(true));
    expect(calls.find((call) => call.body.resolution)?.body.resolution).toEqual({ choice: 'local', localHash: 'local-version', remoteSha: 'remote-version' });
  });
});
