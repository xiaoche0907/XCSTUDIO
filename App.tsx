import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './utils/routes';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import { useAuthStore } from './stores/useAuthStore';
import { fetchMe } from './services/auth/auth-client';

const Home = lazy(() => import('./pages/Home'));
const Workspace = lazy(() => import('./pages/Workspace'));
const WorkspaceNew = lazy(() => import('./pages/Workspace/WorkspaceNew'));
const Projects = lazy(() => import('./pages/Projects'));
const Settings = lazy(() => import('./pages/Settings'));
const VideoWorkspace = lazy(() => import('./pages/VideoWorkspace'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));

const App: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) return;
      try {
        const me = await fetchMe(token);
        if (cancelled) return;
        login(me.user.email, token, { id: me.user.id, role: me.user.role === 'ADMIN' ? 'admin' : 'user' });
      } catch {
        if (cancelled) return;
        logout();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token, login, logout]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
          <Routes>
            <Route path={ROUTES.landing} element={<Landing />} />
            <Route path={ROUTES.login} element={<Login />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              }
            />
            <Route
              path={ROUTES.dashboard}
              element={
                <RequireAuth>
                  <Home onExit={onExit} />
                </RequireAuth>
              }
            />
            <Route
              path={ROUTES.projects}
              element={
                <RequireAuth>
                  <Projects onExit={onExit} />
                </RequireAuth>
              }
            />
            <Route
              path={`${ROUTES.workspace}/:id`}
              element={
                <RequireAuth>
                  <Workspace />
                </RequireAuth>
              }
            />
            <Route
              path={ROUTES.videoWorkspace}
              element={
                <RequireAuth>
                  <VideoWorkspace />
                </RequireAuth>
              }
            />
            {/* 新版Workspace - 使用Store和组件化架构 */}
            <Route
              path={`${ROUTES.workspaceNew}/:id`}
              element={
                <RequireAuth>
                  <WorkspaceNew />
                </RequireAuth>
              }
            />
            <Route
              path={ROUTES.settings}
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
};

export default App;
