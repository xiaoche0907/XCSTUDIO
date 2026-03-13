import { fetchWithResilience } from '../http/api-client';

export type WorkspaceDto = {
  id: string;
  name: string;
  type: 'PERSONAL' | 'TEAM';
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export async function fetchWorkspaces(token: string): Promise<WorkspaceDto[]> {
  const res = await fetchWithResilience(
    '/api/workspaces',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
    { operation: 'workspaces.list', retries: 0 }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `workspaces.list failed: ${res.status}`);
  }
  return ((data as any)?.workspaces || []) as WorkspaceDto[];
}
