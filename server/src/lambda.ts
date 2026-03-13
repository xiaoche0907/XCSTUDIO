import serverless from 'serverless-http';
import app from './index';

const baseHandler = serverless(app);

export const handler = async (...args: any[]) => {
  const a = args[0];
  const b = args[1];

  // FC HTTP trigger can run in HTTP handler mode: (req, res, context)
  // In this case, we should directly hand off to Express.
  if (a && typeof a === 'object' && typeof a.method === 'string' && typeof a.url === 'string' && b && typeof b.setHeader === 'function') {
    return (app as any)(a, b);
  }

  // Otherwise, treat as event handler mode (CLI invoke / other runtimes)
  let normalizedEvent = a;
  if (typeof a === 'string') {
    const trimmed = a.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        normalizedEvent = JSON.parse(a);
      } catch {
        normalizedEvent = a;
      }
    }
  }

  return baseHandler(normalizedEvent, args[1]);
};
