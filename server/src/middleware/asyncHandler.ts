import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler so unhandled promise rejections are passed
 * to Express's error handling middleware instead of crashing the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
