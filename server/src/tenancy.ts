import type { Request } from 'express-serve-static-core';
import type { PrismaClient } from '@prisma/client';
import { getRequestedWorkspaceId, type AuthContext } from './auth';

export type WorkspaceContext = {
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export async function resolveWorkspaceContext(
  prisma: PrismaClient,
  req: Request,
  auth: AuthContext
): Promise<WorkspaceContext> {
  const requested = getRequestedWorkspaceId(req);
  const workspaceId = requested || auth.workspaceId;

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: auth.userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    const err: any = new Error('Workspace access denied');
    err.status = 403;
    err.code = 'WORKSPACE_FORBIDDEN';
    return Promise.reject(err);
  }

  return {
    workspaceId,
    role: membership.role as any,
  };
}

export function requireWorkspaceWrite(role: WorkspaceContext['role']): void {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    const err: any = new Error('Workspace write forbidden');
    err.status = 403;
    err.code = 'WORKSPACE_WRITE_FORBIDDEN';
    throw err;
  }
}
