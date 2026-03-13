import type { Project } from '../../types/common';
import { fetchWithResilience } from '../http/api-client';

export async function fetchProjects(token: string): Promise<Project[]> {
  const res = await fetchWithResilience(
    '/api/projects',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
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
