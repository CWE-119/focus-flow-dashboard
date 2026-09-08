// API Service Layer - Centralized API calls with error handling
// Single source of truth for API base URL (web + Electron)
const isElectron = () => !!(window as any).electron;
const API_BASE_URL = isElectron()
  ? 'http://localhost:5000/api'
  : import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const formatLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Use this in contexts/components that call fetch() directly so endpoints work in both web and Electron. */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

// Generic fetch wrapper with error handling
const fetchAPI = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = response.status === 204 ? null : await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// TODO API
export const todoAPI = {
  getAll: () => fetchAPI<any[]>('/todos'),
  create: (title: string) => 
    fetchAPI<any>('/todos', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  update: (id: string, updates: any) =>
    fetchAPI<any>(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<any>(`/todos/${id}`, {
      method: 'DELETE',
    }),
};

// TASK CATEGORIES API
export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export const categoriesAPI = {
  getAll: () => fetchAPI<TaskCategory[]>('/categories'),
  create: (name: string, color: string, id?: string) =>
    fetchAPI<TaskCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, color, ...(id ? { id } : {}) }),
    }),
  update: (id: string, updates: { name?: string; color?: string }) =>
    fetchAPI<TaskCategory>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/categories/${id}`, {
      method: 'DELETE',
    }),
};

// NOTES API
export const notesAPI = {
  getAll: () => fetchAPI<any[]>('/notes'),
  getByFolder: (folderId: string) => fetchAPI<any[]>(`/notes/folder/${folderId}`),
  create: (title: string, folderId: string, content?: string) =>
    fetchAPI<any>('/notes', {
      method: 'POST',
      body: JSON.stringify({ title, folderId, content }),
    }),
  update: (id: string, updates: any) =>
    fetchAPI<any>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<any>(`/notes/${id}`, {
      method: 'DELETE',
    }),
};

// FOLDERS API
export const foldersAPI = {
  getAll: () => fetchAPI<any[]>('/folders'),
  create: (name: string, color: string) =>
    fetchAPI<any>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  update: (id: string, updates: any) =>
    fetchAPI<any>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<any>(`/folders/${id}`, {
      method: 'DELETE',
    }),
};

// REMINDERS API
export const remindersAPI = {
  getAll: () => fetchAPI<any[]>('/reminders'),
  getByDate: (date: string) => fetchAPI<any[]>(`/reminders/date/${date}`),
  create: (title: string, date: string, description?: string) =>
    fetchAPI<any>('/reminders', {
      method: 'POST',
      body: JSON.stringify({ title, date, description }),
    }),
  update: (id: string, updates: any) =>
    fetchAPI<any>(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<any>(`/reminders/${id}`, {
      method: 'DELETE',
    }),
};

// DEADLINES API
export type DeadlineSource = 'google' | 'canvas' | 'manual';

export interface Deadline {
  id: string;
  title: string;
  context?: string | null;
  source: DeadlineSource;
  end: string;
  start?: string | null;
  url?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const deadlinesAPI = {
  getAll: () => fetchAPI<Deadline[]>('/deadlines'),
  create: (deadline: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
    fetchAPI<Deadline>('/deadlines', {
      method: 'POST',
      body: JSON.stringify(deadline),
    }),
  update: (id: string, updates: Partial<Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>>) =>
    fetchAPI<Deadline>(`/deadlines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/deadlines/${id}`, {
      method: 'DELETE',
    }),
};

export type DeadlineProvider = 'canvas' | 'google';
export interface DeadlineConnection {
  provider: DeadlineProvider;
  configured: boolean;
  settings: { baseUrl?: string; calendarId?: string; authMode?: 'apiKey' | 'accessToken' };
  lastSyncedAt: string | null;
}

export const deadlineIntegrationsAPI = {
  getAll: () => fetchAPI<DeadlineConnection[]>('/integrations/deadlines'),
  save: (provider: DeadlineProvider, settings: DeadlineConnection['settings'] & { credential?: string }) =>
    fetchAPI<DeadlineConnection[]>(`/integrations/deadlines/${provider}`, { method: 'PUT', body: JSON.stringify(settings) }),
  sync: (provider: DeadlineProvider) =>
    fetchAPI<{ count: number; lastSyncedAt: string }>(`/integrations/deadlines/${provider}/sync`, { method: 'POST', body: '{}' }),
  disconnect: (provider: DeadlineProvider) =>
    fetchAPI<DeadlineConnection[]>(`/integrations/deadlines/${provider}`, { method: 'DELETE' }),
};

// GLOSSARY API
export interface GlossaryTerm {
  id: string;
  term: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
}

export const glossaryAPI = {
  getAll: () => fetchAPI<GlossaryTerm[]>('/glossary'),
  create: (term: string, description: string, id?: string) =>
    fetchAPI<GlossaryTerm>('/glossary', {
      method: 'POST',
      body: JSON.stringify({ term, description, ...(id ? { id } : {}) }),
    }),
  update: (id: string, updates: Partial<Pick<GlossaryTerm, 'term' | 'description'>>) =>
    fetchAPI<GlossaryTerm>(`/glossary/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/glossary/${id}`, {
      method: 'DELETE',
    }),
};

// HISTORY API
export const historyAPI = {
  getAll: () => fetchAPI<any[]>('/history'),
  getActivity: () => fetchAPI<any[]>('/history/activity'),
  getByDate: (date: string) => fetchAPI<any[]>(`/history/${date}`),
  create: (action: string, details?: string, sessionData?: any) =>
    fetchAPI<any>('/history', {
      method: 'POST',
      body: JSON.stringify({ 
        action, 
        details,
        duration: sessionData?.duration,
        startTime: sessionData?.startTime,
        endTime: sessionData?.endTime,
        date: sessionData?.date || formatLocalDateKey(),
        metadata: sessionData,
      }),
    }),
};

// DRAWINGS API
export const drawingsAPI = {
  getAll: () => fetchAPI<any[]>('/drawings'),
  getById: (id: string) => fetchAPI<any>(`/drawings/${id}`),
  create: (title: string, data: any, thumbnail?: string) =>
    fetchAPI<any>('/drawings', {
      method: 'POST',
      body: JSON.stringify({ title, data, thumbnail }),
    }),
  update: (id: string, updates: any) =>
    fetchAPI<any>(`/drawings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    fetchAPI<any>(`/drawings/${id}`, {
      method: 'DELETE',
    }),
};
