import { Router, Request, Response } from "express";
import { Conversation } from "../models/Conversation";
import {
  CreateConversationSchema,
  AddMessageSchema,
  UpdateConversationStatusSchema,
} from "../validators/schemas";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// ─── GET /conversations ───────────────────────────────────────────────────────
// List all conversations (newest first), messages excluded for performance.
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const conversations = await Conversation.find(
      {},
      { messages: 0 } // exclude message content from list view
    ).sort({ updatedAt: -1 });

    // Attach messageCount from the full document via a lean aggregation
    const withCounts = await Conversation.aggregate([
      { $project: { title: 1, llmModel: 1, provider: 1, status: 1, createdAt: 1, updatedAt: 1, messageCount: { $size: "$messages" } } },
      { $sort: { updatedAt: -1 } },
    ]);

    res.json({ data: withCounts });
  })
);

// ─── POST /conversations ──────────────────────────────────────────────────────
// Create a new conversation (called when user starts a new chat).
router.post(
  "/",
  validate(CreateConversationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    const conversation = new Conversation({
      _id: body.id,
      title: body.title,
      llmModel: body.model,
      provider: body.provider,
      status: body.status,
      messages: body.messages.map((m: { id: string; role: string; content: string; timestamp: string }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      createdAt: new Date(body.createdAt),
      updatedAt: new Date(body.updatedAt),
    });

    await conversation.save();
    res.status(201).json({ data: conversation });
  })
);

// ─── GET /conversations/:id ───────────────────────────────────────────────────
// Fetch a single conversation with all messages.
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json({ data: conversation });
  })
);

// ─── POST /conversations/:id/messages ─────────────────────────────────────────
// Append a single message to a conversation.
router.post(
  "/:id/messages",
  validate(AddMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body;

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          messages: {
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: new Date(message.timestamp),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { new: true, runValidators: true }
    );

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(201).json({ data: conversation });
  })
);

// ─── PATCH /conversations/:id/status ─────────────────────────────────────────
// Update conversation status (e.g. cancel, complete).
router.patch(
  "/:id/status",
  validate(UpdateConversationStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({ data: conversation });
  })
);

// ─── DELETE /conversations/:id ────────────────────────────────────────────────
// Delete a conversation and its messages.
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await Conversation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json({ message: "Conversation deleted" });
  })
);

export default router;
