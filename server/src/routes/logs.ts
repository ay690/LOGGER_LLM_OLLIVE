import { Router, Request, Response } from "express";
import { InferenceLog } from "../models/InferenceLog";
import { IngestLogSchema, IngestLogBatchSchema } from "../validators/schemas";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// ─── POST /logs ───────────────────────────────────────────────────────────────
// Ingest a single log (called from the SDK's finally block).
router.post(
  "/",
  validate(IngestLogSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    // Idempotency: skip duplicates by requestId
    const existing = await InferenceLog.findOne({ requestId: body.requestId });
    if (existing) {
      res.status(200).json({ data: existing, duplicate: true });
      return;
    }

    const log = new InferenceLog({
      _id: body.id,
      conversationId: body.conversationId,
      sessionId: body.sessionId,
      provider: body.provider,
      llmModel: body.model,
      requestTimestamp: new Date(body.requestTimestamp),
      responseTimestamp: new Date(body.responseTimestamp),
      latencyMs: body.latencyMs,
      promptTokens: body.promptTokens,
      completionTokens: body.completionTokens,
      totalTokens: body.totalTokens,
      status: body.status,
      errorMessage: body.errorMessage,
      inputPreview: body.inputPreview,
      outputPreview: body.outputPreview,
      requestId: body.requestId,
    });

    await log.save();
    res.status(201).json({ data: log });
  })
);

// ─── POST /logs/batch ─────────────────────────────────────────────────────────
// Bulk ingest up to 50 logs at once (useful for flushing offline-queued logs).
router.post(
  "/batch",
  validate(IngestLogBatchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { logs } = req.body;

    // Collect existing requestIds to skip duplicates
    const requestIds = logs.map((l: { requestId: string }) => l.requestId);
    const existingIds = await InferenceLog.find(
      { requestId: { $in: requestIds } },
      { requestId: 1 }
    ).lean();
    const existingSet = new Set(existingIds.map((e) => e.requestId));

    const newLogs = logs
      .filter((l: { requestId: string }) => !existingSet.has(l.requestId))
      .map((body: {
        id: string; conversationId: string; sessionId: string; provider: string;
        model: string; requestTimestamp: string; responseTimestamp: string;
        latencyMs: number; promptTokens: number; completionTokens: number;
        totalTokens: number; status: string; errorMessage?: string;
        inputPreview: string; outputPreview: string; requestId: string;
      }) => ({
        _id: body.id,
        conversationId: body.conversationId,
        sessionId: body.sessionId,
        provider: body.provider,
        llmModel: body.model,
        requestTimestamp: new Date(body.requestTimestamp),
        responseTimestamp: new Date(body.responseTimestamp),
        latencyMs: body.latencyMs,
        promptTokens: body.promptTokens,
        completionTokens: body.completionTokens,
        totalTokens: body.totalTokens,
        status: body.status,
        errorMessage: body.errorMessage,
        inputPreview: body.inputPreview,
        outputPreview: body.outputPreview,
        requestId: body.requestId,
      }));

    let inserted: unknown[] = [];
    if (newLogs.length > 0) {
      inserted = await InferenceLog.insertMany(newLogs, { ordered: false });
    }

    res.status(201).json({
      inserted: inserted.length,
      skipped: logs.length - inserted.length,
    });
  })
);

// ─── GET /logs ────────────────────────────────────────────────────────────────
// Paginated log list with optional filters: model, status, conversationId.
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      model,
      status,
      conversationId,
      search,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (model && model !== "all") filter.llmModel = model;
    if (status && status !== "all") filter.status = status;
    if (conversationId) filter.conversationId = conversationId;
    if (search) {
      filter.$or = [
        { inputPreview: { $regex: search, $options: "i" } },
        { outputPreview: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      InferenceLog.find(filter)
        .sort({ requestTimestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InferenceLog.countDocuments(filter),
    ]);

    res.json({
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  })
);

// ─── GET /logs/stats ──────────────────────────────────────────────────────────
// Aggregate dashboard metrics. Accepts optional ?since= ISO timestamp.
router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const since = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24h

    const [summary, byModel, byStatus, timeSeries] = await Promise.all([
      // Overall summary
      InferenceLog.aggregate([
        { $match: { requestTimestamp: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
            errorCount: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
            cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
            avgLatencyMs: { $avg: "$latencyMs" },
            totalTokens: { $sum: "$totalTokens" },
            totalPromptTokens: { $sum: "$promptTokens" },
            totalCompletionTokens: { $sum: "$completionTokens" },
          },
        },
      ]),

      // Breakdown by model
      InferenceLog.aggregate([
        { $match: { requestTimestamp: { $gte: since } } },
        { $group: { _id: "$llmModel", count: { $sum: 1 }, totalTokens: { $sum: "$totalTokens" }, avgLatency: { $avg: "$latencyMs" } } },
        { $sort: { count: -1 } },
      ]),

      // Breakdown by status
      InferenceLog.aggregate([
        { $match: { requestTimestamp: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Per-minute time series for charts (last 60 minutes)
      InferenceLog.aggregate([
        { $match: { requestTimestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } } },
        {
          $group: {
            _id: {
              year: { $year: "$requestTimestamp" },
              month: { $month: "$requestTimestamp" },
              day: { $dayOfMonth: "$requestTimestamp" },
              hour: { $hour: "$requestTimestamp" },
              minute: { $minute: "$requestTimestamp" },
            },
            requests: { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
            avgLatency: { $avg: "$latencyMs" },
            tokens: { $sum: "$totalTokens" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.minute": 1 } },
      ]),
    ]);

    const s = summary[0] ?? {
      totalRequests: 0, successCount: 0, errorCount: 0, cancelledCount: 0,
      avgLatencyMs: 0, totalTokens: 0, totalPromptTokens: 0, totalCompletionTokens: 0,
    };

    res.json({
      data: {
        summary: {
          totalRequests: s.totalRequests,
          successRate: s.totalRequests > 0 ? (s.successCount / s.totalRequests) * 100 : 0,
          errorCount: s.errorCount,
          cancelledCount: s.cancelledCount,
          avgLatencyMs: Math.round(s.avgLatencyMs ?? 0),
          totalTokens: s.totalTokens,
          totalPromptTokens: s.totalPromptTokens,
          totalCompletionTokens: s.totalCompletionTokens,
        },
        byModel,
        byStatus,
        timeSeries: timeSeries.map((t) => ({
          time: `${String(t._id.hour).padStart(2, "0")}:${String(t._id.minute).padStart(2, "0")}`,
          requests: t.requests,
          errors: t.errors,
          latency: Math.round(t.avgLatency),
          tokens: t.tokens,
        })),
      },
    });
  })
);

// ─── GET /logs/:id ────────────────────────────────────────────────────────────
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const log = await InferenceLog.findById(req.params.id);
    if (!log) {
      res.status(404).json({ error: "Log not found" });
      return;
    }
    res.json({ data: log });
  })
);

export default router;
