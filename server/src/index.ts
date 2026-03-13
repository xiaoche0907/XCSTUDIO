import express from 'express';
import path from 'path';
import type { Request as ExRequest, Response as ExResponse } from 'express-serve-static-core';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { getRequestedWorkspaceId, handleLogin, handleMe, requireAdmin, requireAuth } from './auth';
import { writeAuditLog } from './audit';
import { z } from 'zod';

dotenv.config();

// 全局异常捕获以便在云端调试
process.on('uncaughtException', (err) => {
    console.error('!!! UNCAUGHT EXCEPTION !!!', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('!!! UNHANDLED REJECTION !!!', reason);
});

const app = express();
const port = Number(process.env.PORT || 9000);

let prisma: PrismaClient;

const getPrisma = () => {
    if (!prisma) {
        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL
                }
            }
        });
    }
    return prisma;
};

const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.set('trust proxy', 1);

app.use(
    cors({
        origin: (origin, cb) => {
            // Allow non-browser tools (no Origin header)
            if (!origin) return cb(null, true);
            // If not configured, default to deny in production
            if (corsOrigins.length === 0) {
                if (process.env.NODE_ENV === 'production') return cb(new Error('CORS blocked'));
                return cb(null, true);
            }
            if (corsOrigins.includes(origin)) return cb(null, true);
            return cb(new Error('CORS blocked'));
        },
        credentials: true
    })
);
app.use(express.json({ limit: '50mb' }));

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);

app.use(
    '/api/',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
    })
);

app.use(
    '/api/auth/login',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
    })
);

// 基础健康检查 - 不依赖数据库
app.get('/health', (req: ExRequest, res: ExResponse) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ status: 'ok', msg: 'Healthy', version: 'node20-v2-force-' + Date.now() });
});


// 诊断接口
app.get('/debug', (req: ExRequest, res: ExResponse) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not Found' });
    }
    res.json({
        uptime: process.uptime(),
        env: process.env.NODE_ENV,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        cwd: process.cwd(),
        dirname: __dirname
    });
});

app.get('/api/debug/files', (req: ExRequest, res: ExResponse) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not Found' });
    }
    try {
        const listDir = (dir: string) => {
            if (!fs.existsSync(dir)) return `${dir} NOT FOUND`;
            return fs.readdirSync(dir).map(f => {
                const stat = fs.statSync(path.join(dir, f));
                return stat.isDirectory() ? `${f}/` : f;
            });
        };
        res.json({
            cwd: process.cwd(),
            dirname: __dirname,
            publicExists: fs.existsSync(publicPath),
            publicFiles: listDir(publicPath),
            assetsFiles: listDir(path.join(publicPath, 'assets'))
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


// 静态资源服务路径计算 - 增强 FC 兼容性
const publicPath = path.resolve(process.cwd(), 'public');
console.log('Serving static files from:', publicPath);

// Middleware: 对静态资源请求做初步过滤
app.use((req, res, next) => {
    const ext = path.extname(req.path);
    if (['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.json'].includes(ext)) {
        // 如果是静态资源请求，但不匹配 express.static 逻辑，后续将不再回退到 index.html
        (req as any).isAssetRequest = true;
    }
    next();
});

app.use(express.static(publicPath));

// 显式处理根路径
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// --- Auth ---
app.post('/api/auth/login', async (req: ExRequest, res: ExResponse) => {
    try {
        const client = getPrisma();
        return await handleLogin(client)(req as any, res as any);
    } catch (e: any) {
        console.error('[Auth Login Error]:', e);
        return res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    try {
        const client = getPrisma();
        return await handleMe(client)(req as any, res as any);
    } catch (e: any) {
        console.error('[Auth Me Error]:', e);
        return res.status(500).json({ error: 'Failed to load user' });
    }
});

// --- Workspaces ---
app.get('/api/workspaces', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    const auth = (req as any).auth;
    const userId = auth?.userId;

    try {
        const client = getPrisma();
        const memberships = await client.workspaceMembership.findMany({
            where: { userId },
            include: { workspace: true },
            orderBy: { createdAt: 'asc' }
        });

        const list = memberships.map((m) => ({
            id: m.workspace.id,
            name: m.workspace.name,
            type: m.workspace.type,
            role: m.role,
            createdAt: m.workspace.createdAt,
        }));

        return res.json({ workspaces: list });
    } catch (error: any) {
        console.error('[Workspaces Error]:', error);
        return res.status(500).json({ error: 'Failed to load workspaces', details: error.message });
    }
});



/**
 * AI 代理接口 - 统一网关
 */
app.post('/api/proxy/ai', async (req: ExRequest, res: ExResponse) => {
    try {
        const { providerId, model, contents, config } = req.body;
        
        const providers: Record<string, { baseUrl: string, envKey: string }> = {
            'yunwu': { baseUrl: 'https://yunwu.ai', envKey: 'YUNWU_API_KEYS' },
            'plato': { baseUrl: 'https://api.bltcy.ai', envKey: 'PLATO_API_KEYS' },
            'gemini': { baseUrl: 'https://generativelanguage.googleapis.com', envKey: 'GEMINI_API_KEY' }
        };

        const provider = providers[providerId || 'yunwu'];
        if (!provider) {
            return res.status(400).json({ error: '无效的服务商 ID' });
        }

        const rawKeys = process.env[provider.envKey] || '';
        const apiKeys = rawKeys.split(',').filter(k => k.trim());
        
        if (apiKeys.length === 0) {
            return res.status(500).json({ error: `后端未配置 ${providerId} 的 API 密钥` });
        }

        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
        const isGoogle = provider.baseUrl.includes('googleapis.com');
        const baseUrl = provider.baseUrl.replace(/\/+$/, '');

        if (isGoogle) {
            // 直接使用 axios 调用 Google Gemini API，规避 @google/genai 依赖库的 ESM 兼容性问题
            const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const apiRes = await axios.post(url, {
                contents,
                ...config
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 300000 
            });
            // 适配 Google API 的返回格式，使其与 SDK 以前期待的格式一致（或者直接返回原始 JSON）
            return res.json(apiRes.data);
        }

        // 处理其他服务商 (yunwu, plato)
        const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const apiRes = await axios.post(url, {
            contents,
            ...config
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 300000 
        });
        return res.json(apiRes.data);
    } catch (error: any) {
        console.error('[AI Proxy Error]:', error);
        res.status(error.response?.status || 500).json({ 
            error: error.message || 'AI 生成请求失败',
            details: error.response?.data || error.stack
        });
    }
});

import { searchHandler } from './search';

const createProjectSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    thumbnail: z.string().trim().max(4096).optional(),
    content: z.any().optional(),
});

const updateProjectSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    thumbnail: z.string().trim().max(4096).optional().nullable(),
    content: z.any().optional().nullable(),
});

app.get('/api/projects', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    const auth = (req as any).auth;
    const userId = auth?.userId;
    const requested = getRequestedWorkspaceId(req as any);
    const workspaceId = requested || auth?.workspaceId;
    try {
        const client = getPrisma();
        const projects = await client.project.findMany({
            where: { userId, workspaceId },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error('[Prisma Error]:', error);
        res.status(500).json({ error: '获取项目失败，请检查数据库连接', details: error.message });
    }
});

app.post('/api/projects', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    const auth = (req as any).auth;
    const userId = auth?.userId;
    const requested = getRequestedWorkspaceId(req as any);
    const workspaceId = requested || auth?.workspaceId;

    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    try {
        const client = getPrisma();
        const created = await client.project.create({
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                thumbnail: parsed.data.thumbnail,
                content: parsed.data.content,
                userId,
                workspaceId,
            },
        });

        await writeAuditLog(client, req as any, {
            workspaceId,
            actorUserId: userId,
            action: 'project.create',
            entityType: 'Project',
            entityId: created.id,
            meta: { name: created.name },
        });

        return res.status(201).json(created);
    } catch (error: any) {
        console.error('[Prisma Error]:', error);
        return res.status(500).json({ error: '创建项目失败', details: error.message });
    }
});

app.put('/api/projects/:id', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    const auth = (req as any).auth;
    const userId = auth?.userId;
    const requested = getRequestedWorkspaceId(req as any);
    const workspaceId = requested || auth?.workspaceId;
    const projectId = req.params.id;

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    try {
        const client = getPrisma();
        const existing = await client.project.findFirst({ where: { id: projectId, workspaceId, userId } });
        if (!existing) return res.status(404).json({ error: 'Project not found' });

        const updated = await client.project.update({
            where: { id: projectId },
            data: {
                ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
                ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
                ...(parsed.data.thumbnail !== undefined ? { thumbnail: parsed.data.thumbnail } : {}),
                ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
            },
        });

        await writeAuditLog(client, req as any, {
            workspaceId,
            actorUserId: userId,
            action: 'project.update',
            entityType: 'Project',
            entityId: updated.id,
            meta: { before: { name: existing.name }, after: { name: updated.name } },
        });

        return res.json(updated);
    } catch (error: any) {
        console.error('[Prisma Error]:', error);
        return res.status(500).json({ error: '更新项目失败', details: error.message });
    }
});

app.delete('/api/projects/:id', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    const auth = (req as any).auth;
    const userId = auth?.userId;
    const requested = getRequestedWorkspaceId(req as any);
    const workspaceId = requested || auth?.workspaceId;
    const projectId = req.params.id;

    try {
        const client = getPrisma();
        const existing = await client.project.findFirst({ where: { id: projectId, workspaceId, userId } });
        if (!existing) return res.status(404).json({ error: 'Project not found' });

        await client.project.delete({ where: { id: projectId } });

        await writeAuditLog(client, req as any, {
            workspaceId,
            actorUserId: userId,
            action: 'project.delete',
            entityType: 'Project',
            entityId: existing.id,
            meta: { name: existing.name },
        });

        return res.status(204).end();
    } catch (error: any) {
        console.error('[Prisma Error]:', error);
        return res.status(500).json({ error: '删除项目失败', details: error.message });
    }
});

app.post('/api/proxy/search', requireAuth(), async (req: ExRequest, res: ExResponse) => {
    try {
        const result = await searchHandler(req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: '搜索请求失败', details: error.message });
    }
});

app.get('/api/admin/stats', requireAuth(), requireAdmin(), async (req: ExRequest, res: ExResponse) => {
    try {
        const client = getPrisma();
        const [userCount, projectCount] = await Promise.all([
            client.user.count(),
            client.project.count()
        ]);
        res.json({
            totalUsers: userCount,
            activeProjects: projectCount,
            apiUsage: '72%',
            systemHealth: 'Optimal',
            providerStatus: { yunwu: 'Healthy', plato: 'Healthy', gemini: 'Healthy' }
        });
    } catch (error) {
        res.status(500).json({ error: '获取统计失败', details: error.message });
    }
});

app.get('/api/admin/users', requireAuth(), requireAdmin(), async (req: ExRequest, res: ExResponse) => {
    try {
        const client = getPrisma();
        const users = await client.user.findMany({
            include: { projects: true },
            take: 20
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: '获取用户列表失败', details: error.message });
    }
});

// 静态资源服务 - 映射到 public 目录
app.use(express.static(publicPath));


// 处理前端路由 - SPA 特性支持
app.get('*', (req, res) => {
    // 如果是 API 请求或特定的静态资源请求（但没找到文件），返回 404
    if (req.path.startsWith('/api/') || (req as any).isAssetRequest) {
        return res.status(404).json({ error: 'Resource Not Found', path: req.path });
    }
    // 否则作为前端路由，返回 index.html
    res.sendFile(path.join(publicPath, 'index.html'));
});



// 如果是本地开发环境，可以保留 listen；在 FC 环境下由 lambda.ts 处理导出
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Local server is running on http://localhost:${port}`);
    });
}


export default app;
