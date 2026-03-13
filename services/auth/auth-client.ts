import { fetchWithResilience } from '../http/api-client';

export type AuthMeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
  };
  workspace: {
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  } | null;
};

export async function fetchMe(token: string): Promise<AuthMeResponse> {
  const res = await fetchWithResilience(
    '/api/auth/me',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
    { operation: 'auth.me', retries: 0 }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `auth.me failed: ${res.status}`);
  }
  return data as AuthMeResponse;
}
