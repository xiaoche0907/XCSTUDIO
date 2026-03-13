import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { ROUTES } from '../utils/routes';

type Props = {
  children: React.ReactElement;
};

export default function RequireAdmin({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);

  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace />;
  if (role !== 'admin') return <Navigate to={ROUTES.dashboard} replace />;
  return children;
}
