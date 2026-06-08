import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  code?: number; // Mongoose duplicate key code (11000)
}

/**
 * Global Express error handler. Must be registered last (4 params).
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error("[ERROR]", err.message, err.stack);

  // MongoDB duplicate key
  if (err.code === 11000) {
    res.status(409).json({ error: "Duplicate entry — resource already exists" });
    return;
  }

  const status = err.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message;

  res.status(status).json({ error: message });
}
