import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

interface Workspace {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, token: string, user?: Partial<User>, workspace?: Partial<Workspace> | null) => void;
  logout: () => void;
  hydrateFromStorage: () => void;
  setWorkspace: (workspace: Workspace | null) => void;
}

/**
 * 符合 react-state-management Skills: 
 * 使用 Zustand 管理全局 Auth 状态，并自动持久化到 localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workspace: null,
      token: null,
      isAuthenticated: false,
      login: (email, token, user, workspace) => {
        // Keep backward-compat for existing modules that read localStorage.auth_token
        try {
          localStorage.setItem('auth_token', token);
        } catch {
          // ignore
        }

        const incomingRole = (user as any)?.role;
        const normalizedRole: User['role'] = incomingRole === 'ADMIN' || incomingRole === 'admin' ? 'admin' : 'user';

        set({
          user: {
            id: user?.id || ('user_' + Math.random().toString(36).substr(2, 9)),
            email,
            role: normalizedRole,
          },
          workspace: workspace?.id
            ? {
                id: workspace.id,
                name: (workspace.name as any) || 'Workspace',
                role: (workspace.role as any) || 'MEMBER',
              }
            : null,
          token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, workspace: null, token: null, isAuthenticated: false });
      },

      setWorkspace: (workspace) => set({ workspace }),

      hydrateFromStorage: () => {
        let token: string | null = null;
        try {
          token = localStorage.getItem('auth_token');
        } catch {
          token = null;
        }

        if (!token) {
          set({ user: null, workspace: null, token: null, isAuthenticated: false });
          return;
        }

        // Fast-path: if persist already restored token, keep it.
        set((prev) => ({
          ...prev,
          token: prev.token || token,
          isAuthenticated: true,
        }));
      },
    }),
    {
      name: 'xc-auth-storage',
    }
  )
);
