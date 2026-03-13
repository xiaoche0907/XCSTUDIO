import type { Request } from 'express-serve-static-core';
import type { PrismaClient } from '@prisma/client';

type AuditParams = {
  workspaceId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: unknown;
};

export async function writeAuditLog(prisma: PrismaClient, req: Request, params: AuditParams): Promise<void> {
  try {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    const userAgent = (req.headers['user-agent'] as string | undefined) || undefined;

    await prisma.auditLog.create({
      data: {
        workspaceId: params.workspaceId,
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        meta: params.meta as any,
        ip,
        userAgent,
      },
    });
  } catch {
    // Never block the request on audit logging.
  }
}
