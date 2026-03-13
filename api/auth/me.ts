import { prisma } from '../_lib/prisma';
import { getBearerToken, sendJson } from '../_lib/http';
import { verifyToken } from '../_lib/auth';

export default async function handler(req: any, res: any) {
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    const claims = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, name: true, role: true, defaultWorkspaceId: true },
    });
    if (!user) return sendJson(res, 404, { error: 'User not found' });

    const workspaceId = claims.wid || user.defaultWorkspaceId;
    const workspace = workspaceId
      ? await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } })
      : null;
    const membership = workspaceId
      ? await prisma.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
          select: { role: true },
        })
      : null;

    return sendJson(res, 200, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, role: (membership?.role as any) || claims.wrole }
        : null,
    });
  } catch (e: any) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }
}
