import { readJsonBody, requireMethod, sendJson } from '../_lib/http.js';
import { passwordLogin } from '../_lib/auth.js';

export default async function handler(req: any, res: any) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const body = readJsonBody(req);
    const result = await passwordLogin(body);
    return sendJson(res, 200, result);
  } catch (e: any) {
    return sendJson(res, e.status || 500, { error: e.message || 'Login failed', details: e.details });
  }
}
