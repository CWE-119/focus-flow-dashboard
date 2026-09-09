import { desktopApiHeaders, getApiBaseUrl } from "@/lib/api";

export interface Workspace { id: string; name: string; kind: "course" | "research"; description: string; createdAt: string }
export interface StudyNote { id: number; title: string; content?: string; folderId?: number }
export interface StudyDeadline { id: string; title: string; source: string; end: string; context?: string }
export interface StudySession { id: number; date: string; duration: number; startTime?: string; endTime?: string; action?: string }
export interface Reading { id: string; title: string; url: string; completed: number }
export interface StudyStep { id: string; workspaceId: string; deadlineId: string | null; title: string; date: string; minutes: number; completed: number; targetEnd: string }
export interface WorkspaceDetail extends Workspace { notes: StudyNote[]; deadlines: StudyDeadline[]; sessions: StudySession[]; readings: Reading[]; steps: StudyStep[] }
export interface Flashcard { id: string; workspaceId: string | null; noteId: number | null; glossaryId: string | null; question: string; answer: string; dueAt: string; interval: number; ease: number; repetitions: number; revision: number }
export interface StudySummary { cards: Pick<Flashcard, "id" | "question" | "workspaceId" | "dueAt">[]; steps: StudyStep[]; reviews: { reviewedAt: string }[] }

export async function studyRequest<T>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, { method, headers: { "Content-Type": "application/json", ...await desktopApiHeaders() }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  if (method !== "GET" && !endpoint.startsWith('/continuity')) window.dispatchEvent(new Event("focusflow:study-changed"));
  return result as T;
}

export const appHref = (pathname: string) => window.location.protocol === "file:" ? `#${pathname}` : pathname;
