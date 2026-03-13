import { fetchWithResilience } from '../http/api-client';

export async function setActiveWorkspace(token: string, workspaceId: string): Promise<{ token: string; workspace: any }> {
  const res = await fetchWithResilience(
    '/api/workspaces/active',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ workspaceId }),
    },
    { operation: 'workspaces.setActive', retries: 0 }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `workspaces.setActive failed: ${res.status}`);
  }
  return data as any;
}
