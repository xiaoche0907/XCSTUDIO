import serverless from 'serverless-http';
import app from './index';

const baseHandler = serverless(app);

const normalizeToApiGatewayV1 = (event: any) => {
  if (!event || typeof event !== 'object') return event;

  // Already v1
  if (typeof event.httpMethod === 'string' && typeof event.path === 'string') {
    return event;
  }

  const method =
    event.httpMethod ||
    event?.requestContext?.http?.method ||
    event?.requestContext?.httpMethod ||
    'GET';

  const headers = event.headers || {};

  const pickHeader = (name: string): string | null => {
    const v = headers[name] ?? headers[name.toLowerCase()];
    if (!v) return null;
    if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
    return typeof v === 'string' ? v : null;
  };

  const headerUri =
    pickHeader('x-fc-request-uri') ||
    pickHeader('x-forwarded-uri') ||
    pickHeader('x-original-url') ||
    pickHeader('x-request-uri');

  const headerPath = (() => {
    if (!headerUri) return null;
    try {
      if (headerUri.startsWith('http://') || headerUri.startsWith('https://')) {
        const u = new URL(headerUri);
        return `${u.pathname}${u.search || ''}`;
      }
      return headerUri;
    } catch {
      return null;
    }
  })();

  const path =
    (typeof event.path === 'string' && event.path !== '/' ? event.path : null) ||
    (typeof event.rawPath === 'string' && event.rawPath !== '/' ? event.rawPath : null) ||
    (typeof event?.requestContext?.http?.path === 'string' && event.requestContext.http.path !== '/' ? event.requestContext.http.path : null) ||
    (typeof event?.requestContext?.path === 'string' && event.requestContext.path !== '/' ? event.requestContext.path : null) ||
    (headerPath && headerPath.startsWith('/') ? headerPath : null) ||
    (typeof event.path === 'string' ? event.path : null) ||
    (typeof event.rawPath === 'string' ? event.rawPath : null) ||
    '/';

  const qs =
    event.queryStringParameters ||
    event.queryParameters ||
    event?.requestContext?.queryStringParameters ||
    undefined;

  return {
    resource: path,
    path,
    httpMethod: method,
    headers,
    multiValueHeaders: event.multiValueHeaders,
    queryStringParameters: qs,
    multiValueQueryStringParameters: event.multiValueQueryStringParameters,
    pathParameters: event.pathParameters,
    stageVariables: event.stageVariables,
    requestContext: event.requestContext || {},
    body: event.body || '',
    isBase64Encoded: !!event.isBase64Encoded,
  };
};

export const handler = async (event: any, context: any) => {
  let normalized = event;
  if (typeof event === 'string') {
    const trimmed = event.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        normalized = JSON.parse(event);
      } catch {
        normalized = event;
      }
    }
  }
  normalized = normalizeToApiGatewayV1(normalized);
  return baseHandler(normalized, context);
};
