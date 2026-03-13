export function readJsonBody(req: any): any {
  const body = req?.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export function sendJson(res: any, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function requireMethod(req: any, res: any, method: string): boolean {
  if (req.method !== method) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function getBearerToken(req: any): string | null {
  const header = req?.headers?.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
