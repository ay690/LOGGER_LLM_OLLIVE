import { Router, Request, Response } from "express";
import { UserSettings } from "../models/UserSettings";
import { UpdateSettingsSchema } from "../validators/schemas";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// Currently single-user. When auth is added, replace "default" with req.user.id.
const USER_ID = "default";

// ─── GET /settings ────────────────────────────────────────────────────────────
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    let settings = await UserSettings.findOne({ userId: USER_ID });

    // Auto-create defaults on first access
    if (!settings) {
      settings = await UserSettings.create({ userId: USER_ID });
    }

    res.json({ data: settings });
  })
);

// ─── PATCH /settings ──────────────────────────────────────────────────────────
router.patch(
  "/",
  validate(UpdateSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await UserSettings.findOneAndUpdate(
      { userId: USER_ID },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ data: settings });
  })
);

export default router;
