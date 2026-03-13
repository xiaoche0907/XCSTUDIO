import type { NextFunction, Request, Response } from 'express-serve-static-core';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

export type AuthContext = {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
};

type JwtPayload = {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
  iat?: number;
  exp?: number;
};

type DbUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  passwordHash: string | null;
};

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('JWT_SECRET is not configured (min length 16)');
  }
  return secret;
};

export const signAccessToken = (ctx: AuthContext): string => {
  const secret = getJwtSecret();
  const expiresIn = (process.env.ACCESS_TOKEN_TTL || '7d') as SignOptions['expiresIn'];
  return jwt.sign(
    {
      email: ctx.email,
      role: ctx.role,
    },
    secret,
    {
      subject: ctx.userId,
      expiresIn,
      issuer: 'xc-studio',
      audience: 'xc-studio-web',
    }
  );
};

export const parseBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

export const requireAuth = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = parseBearerToken(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret, {
        issuer: 'xc-studio',
        audience: 'xc-studio-web',
      }) as JwtPayload;

      if (!decoded?.sub || !decoded.email || !decoded.role) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      (req as any).auth = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      } satisfies AuthContext;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
};

export const requireAdmin = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth as AuthContext | undefined;
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    if (auth.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    // Optional second-factor for admin endpoints
    const adminToken = req.headers['x-admin-token'];
    const secureToken = process.env.ADMIN_TOKEN;
    if (process.env.NODE_ENV === 'production') {
      if (!secureToken) return res.status(500).json({ error: 'ADMIN_TOKEN is not configured' });
      if (adminToken !== secureToken) return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(64).optional(),
});

export const handleLogin = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { email, password, name } = parsed.data;
    const emailNorm = email.trim().toLowerCase();

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const desiredRole: 'USER' | 'ADMIN' = adminEmails.includes(emailNorm) ? 'ADMIN' : 'USER';

    const existing = (await prisma.user.findUnique({
      where: { email: emailNorm },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    })) as DbUser | null;

    if (existing?.passwordHash) {
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    } else if (existing && !existing.passwordHash) {
      // User exists (e.g. created by Clerk). Allow password login only if explicitly enabled.
      const allowPasswordBootstrap = process.env.ALLOW_PASSWORD_BOOTSTRAP === 'true';
      if (!allowPasswordBootstrap) {
        return res.status(401).json({ error: 'Password login is not enabled for this account' });
      }
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: hash },
      });
    } else {
      // New user
      const allowSignup = process.env.ALLOW_SIGNUP !== 'false';
      if (!allowSignup) return res.status(403).json({ error: 'Sign up is disabled' });

      const hash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email: emailNorm,
          name: name || null,
          role: desiredRole,
          passwordHash: hash,
        },
      });
    }

    const user = (await prisma.user.findUnique({
      where: { email: emailNorm },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    })) as DbUser | null;
    if (!user) return res.status(500).json({ error: 'Login failed' });

    // If the user is in ADMIN_EMAILS, keep DB role in sync.
    if (desiredRole === 'ADMIN' && user.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      user.role = 'ADMIN' as any;
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: (user.role as any) || 'USER',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  };
};

export const handleMe = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const auth = (req as any).auth as AuthContext;
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  };
};
