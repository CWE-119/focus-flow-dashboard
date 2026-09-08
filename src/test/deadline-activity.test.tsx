import { fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Clock from "@/components/Clock";
import ContributionGrid from "@/components/ContributionGrid";
import { DeadlinesProvider, deadlineDate, formatDeadlineRange, useDeadlines } from "@/hooks/use-deadlines";
import { deadlinesAPI, deadlineIntegrationsAPI, formatLocalDateKey, type Deadline } from "@/lib/api";

const { sessions, reminders } = vi.hoisted(() => ({
  sessions: [{ date: '2027-01-05', sessions: [{ start: '09:00', end: '09:45', duration: 45 }] }],
  reminders: [{ id: 'reminder-1', title: 'Bring textbook', date: new Date(2027, 0, 5) }],
}));
vi.mock("@/contexts/SessionContext", () => ({ useSession: () => ({ sessions }) }));
vi.mock("@/contexts/RemindersContext", () => ({ useReminders: () => ({ reminders, getRemindersByDate: (date: Date) => reminders.filter((reminder) => reminder.date.toDateString() === date.toDateString()) }) }));
vi.mock("@/components/ReminderPopup", () => ({ ReminderPopup: () => null }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  deadlinesAPI: { getAll: vi.fn(), create: vi.fn(), delete: vi.fn() },
  deadlineIntegrationsAPI: { getAll: vi.fn(), save: vi.fn(), sync: vi.fn(), disconnect: vi.fn() },
}));

let dates: Deadline[];

function RefreshButton() {
  const { refresh } = useDeadlines();
  return <button onClick={() => void refresh()}>Refresh deadlines</button>;
}

function Dashboard() {
  return <DeadlinesProvider><Clock /><ContributionGrid /><RefreshButton /></DeadlinesProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });
  dates = [{ id: 'exam', title: 'Biology exam', source: 'canvas', context: 'Biology', end: '2027-01-05', url: 'https://school.instructure.com/courses/1' }];
  vi.mocked(deadlinesAPI.getAll).mockImplementation(async () => ({ success: true, data: dates }));
  vi.mocked(deadlineIntegrationsAPI.getAll).mockResolvedValue({ success: true, data: [
    { provider: 'canvas', configured: false, settings: {}, lastSyncedAt: null },
    { provider: 'google', configured: false, settings: {}, lastSyncedAt: null },
  ] });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('connected deadline activity', () => {
  it('opens deadline, reminders, and actual focus time together across years', async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'View Biology exam in Activity' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Biology exam')).toBeInTheDocument();
    expect(within(dialog).getByText('Bring textbook')).toBeInTheDocument();
    expect(within(dialog).getByText('45m')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open source' })).toHaveAttribute('href', dates[0].url);
    expect(screen.getByText('2027')).toBeInTheDocument();
    expect(deadlinesAPI.getAll).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /Tuesday, January 5, 2027: 45m focus, 1 end dates, reminders/ }));
    expect(within(screen.getByRole('dialog')).getByText('Biology exam')).toBeInTheDocument();
  });

  it('refreshes an open day after sync without stale details', async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'View Biology exam in Activity' }));
    dates = [{ ...dates[0], title: 'Rescheduled exam' }];
    fireEvent.click(screen.getByText('Refresh deadlines'));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('Rescheduled exam')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).queryByText('Biology exam')).not.toBeInTheDocument();
  });

  it('shows an honest empty state and retains cached dates when offline', async () => {
    dates = [];
    const view = render(<Dashboard />);
    expect(await screen.findByText(/No upcoming dates/)).toBeInTheDocument();
    expect(screen.queryByText(/Linear Algebra/)).not.toBeInTheDocument();
    view.unmount();
    localStorage.setItem('focusflow:deadlines', JSON.stringify([{ id: 'saved', title: 'Cached exam', source: 'canvas', end: '2027-01-05' }]));
    vi.mocked(deadlinesAPI.getAll).mockResolvedValue({ success: false, error: 'offline' });
    render(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Showing the last saved list');
    expect(screen.getByText('Cached exam')).toBeInTheDocument();
  });

  it('saves Canvas credentials, syncs dates, and clears the credential field', async () => {
    const configured = [{ provider: 'canvas' as const, configured: true, settings: { baseUrl: 'https://school.instructure.com' }, lastSyncedAt: null }];
    vi.mocked(deadlineIntegrationsAPI.save).mockResolvedValue({ success: true, data: configured });
    vi.mocked(deadlineIntegrationsAPI.sync).mockResolvedValue({ success: true, data: { count: 1, lastSyncedAt: '2026-09-09T12:00:00Z' } });
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));
    fireEvent.change(await screen.findByLabelText('School Canvas URL'), { target: { value: 'https://school.instructure.com' } });
    const token = screen.getAllByLabelText('Access token')[0];
    fireEvent.change(token, { target: { value: 'secret-test-token' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save connection' })[0]);
    expect(await screen.findByText(/Connection saved/)).toBeInTheDocument();
    expect(token).toHaveValue('');
    expect(deadlineIntegrationsAPI.save).toHaveBeenCalledWith('canvas', { baseUrl: 'https://school.instructure.com', credential: 'secret-test-token' });
    expect(localStorage.getItem('focusflow:deadlines')).not.toContain('secret-test-token');
    vi.mocked(deadlineIntegrationsAPI.getAll).mockResolvedValue({ success: true, data: configured });
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByText('1 end dates synced.')).toBeInTheDocument();
    expect(deadlineIntegrationsAPI.sync).toHaveBeenCalledWith('canvas');
  });

  it('keeps date-only events on the intended local day', () => {
    expect(formatLocalDateKey(deadlineDate('2027-01-05'))).toBe('2027-01-05');
    expect(deadlineDate('2027-01-05').getHours()).toBe(23);
    expect(formatDeadlineRange(dates[0])).toBe('Jan 5 · All day');
  });
});
