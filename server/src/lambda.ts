import app from './index';

// Alibaba FC Node.js web function handler signature is (req, res, context).
// Express apps are compatible with (req, res), so we can export the app directly.
export const handler = (req: any, res: any) => {
  return (app as any)(req, res);
};
