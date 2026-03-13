import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma.js';

export type JwtClaims = {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
  wid: string;
  wrole: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('JWT_SECRET is not configured (min length 16)');
  }
  return secret;
}

export function signToken(claims: JwtClaims): string {
  const secret = getJwtSecret();
  const ttl = process.env.ACCESS_TOKEN_TTL || '7d';
  return jwt.sign(
    {
      email: claims.email,
      role: claims.role,
      wid: claims.wid,
      wrole: claims.wrole,
    },
    secret,
    {
      subject: claims.sub,
      expiresIn: ttl as any,
      issuer: 'xc-studio',
      audience: 'xc-studio-web',
    },
  );
}

export function verifyToken(token: string): JwtClaims {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, {
    issuer: 'xc-studio',
    audience: 'xc-studio-web',
  }) as any;

  const sub = decoded?.sub;
  if (!sub || !decoded?.email || !decoded?.role || !decoded?.wid || !decoded?.wrole) {
    throw new Error('Invalid token');
  }

  return {
    sub,
    email: decoded.email,
    role: decoded.role,
    wid: decoded.wid,
    wrole: decoded.wrole,
  } as JwtClaims;
}

export async function ensurePersonalWorkspace(userId: string, displayName: string): Promise<{ wid: string; wrole: JwtClaims['wrole']; name: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWorkspaceId: true },
  });

  if (user?.defaultWorkspaceId) {
    const ws = await prisma.workspace.findUnique({ where: { id: user.defaultWorkspaceId }, select: { id: true, name: true } });
    const mem = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: user.defaultWorkspaceId, userId } },
      select: { role: true },
    });
    if (ws && mem) return { wid: ws.id, wrole: mem.role as any, name: ws.name };
  }

  const created = await prisma.workspace.create({
    data: {
      name: displayName.slice(0, 64) || 'Workspace',
      type: 'PERSONAL',
      createdById: userId,
      memberships: { create: { userId, role: 'OWNER' } },
    },
    select: { id: true, name: true },
  });

  await prisma.user.update({ where: { id: userId }, data: { defaultWorkspaceId: created.id } });
  return { wid: created.id, wrole: 'OWNER', name: created.name };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(64).optional(),
});

export async function passwordLogin(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const err: any = new Error('Invalid input');
    err.status = 400;
    err.details = parsed.error.flatten();
    throw err;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const desiredRole: 'USER' | 'ADMIN' = adminEmails.includes(email) ? 'ADMIN' : 'USER';

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });

  if (existing?.passwordHash) {
    const ok = await bcrypt.compare(password, existing.passwordHash);
    if (!ok) {
      const err: any = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }
  } else if (existing && !existing.passwordHash) {
    const allowBootstrap = process.env.ALLOW_PASSWORD_BOOTSTRAP === 'true';
    if (!allowBootstrap) {
      const err: any = new Error('Password login is not enabled for this account');
      err.status = 401;
      throw err;
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash } });
  } else {
    const allowSignup = process.env.ALLOW_SIGNUP !== 'false';
    if (!allowSignup) {
      const err: any = new Error('Sign up is disabled');
      err.status = 403;
      throw err;
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name || null,
        role: desiredRole,
        passwordHash: hash,
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) throw new Error('Login failed');

  if (desiredRole === 'ADMIN' && user.role !== 'ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    user.role = 'ADMIN' as any;
  }

  const displayName = (user.name || user.email.split('@')[0] || 'Workspace');
  const ws = await ensurePersonalWorkspace(user.id, displayName);
  const token = signToken({ sub: user.id, email: user.email, role: user.role as any, wid: ws.wid, wrole: ws.wrole });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    workspace: { id: ws.wid, name: ws.name, role: ws.wrole },
  };
}
