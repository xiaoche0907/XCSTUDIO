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

  const path =
    event.path ||
    event.rawPath ||
    event?.requestContext?.http?.path ||
    event?.requestContext?.path ||
    '/';

  const qs =
    event.queryStringParameters ||
    event.queryParameters ||
    event?.requestContext?.queryStringParameters ||
    undefined;

  const headers = event.headers || {};

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
