import type { Project } from '../../types/common';
import { fetchWithResilience } from '../http/api-client';

const buildHeaders = (token: string, workspaceId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };
  if (workspaceId) headers['x-workspace-id'] = workspaceId;
  return headers;
};

export async function fetchProjects(token: string, workspaceId?: string | null): Promise<Project[]> {
  const res = await fetchWithResilience(
    '/api/projects',
    {
      headers: {
        ...buildHeaders(token, workspaceId),
      },
    },
    { operation: 'projects.list', retries: 0 }
  );

  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    const message = (data as any)?.error || `projects.list failed: ${res.status}`;
    throw new Error(message);
  }
  return data as Project[];
}

export async function createProject(token: string, workspaceId: string | null | undefined, input: { name: string; description?: string; thumbnail?: string; content?: any }): Promise<any> {
  const res = await fetchWithResilience(
    '/api/projects',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildHeaders(token, workspaceId),
      },
      body: JSON.stringify(input),
    },
    { operation: 'projects.create', retries: 0 }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `projects.create failed: ${res.status}`);
  }
  return data;
}

export async function updateProject(token: string, workspaceId: string | null | undefined, id: string, input: Partial<{ name: string; description: string | null; thumbnail: string | null; content: any | null }>): Promise<any> {
  const res = await fetchWithResilience(
    `/api/projects/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...buildHeaders(token, workspaceId),
      },
      body: JSON.stringify(input),
    },
    { operation: 'projects.update', retries: 0 }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `projects.update failed: ${res.status}`);
  }
  return data;
}

export async function deleteProjectApi(token: string, workspaceId: string | null | undefined, id: string): Promise<void> {
  const res = await fetchWithResilience(
    `/api/projects/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        ...buildHeaders(token, workspaceId),
      },
    },
    { operation: 'projects.delete', retries: 0 }
  );

  if (res.status === 204) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `projects.delete failed: ${res.status}`);
  }
}
