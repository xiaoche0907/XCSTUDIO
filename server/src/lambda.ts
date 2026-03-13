import serverless from 'serverless-http';
import app from './index';

const baseHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  // Alibaba FC http triggers and CLI invoke sometimes pass event as a JSON string.
  // serverless-http expects an object with `path`/`httpMethod`.
  let normalizedEvent = event;
  if (typeof event === 'string') {
    const trimmed = event.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        normalizedEvent = JSON.parse(event);
      } catch {
        normalizedEvent = event;
      }
    }
  }
  return baseHandler(normalizedEvent, context);
};
