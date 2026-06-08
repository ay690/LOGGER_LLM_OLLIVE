import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure returns 400 with structured field errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }
    // Replace body with the parsed/coerced value (defaults applied by Zod)
    req.body = result.data;
    next();
  };
}
