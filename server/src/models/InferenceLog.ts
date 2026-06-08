import { Schema, model } from "mongoose";

// ─── InferenceLog document ───────────────────────────────────────────────────
export interface IInferenceLog {
  _id: string;           // nanoid log.id
  conversationId: string; // ref → Conversation._id
  sessionId: string;      // currently same as conversationId; future-proofed
  provider: string;
  llmModel: string;      // renamed from `model` to avoid clash with Mongoose Document.model()
  requestTimestamp: Date;
  responseTimestamp: Date;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  status: "success" | "error" | "cancelled";
  errorMessage?: string;
  inputPreview: string;
  outputPreview: string;
  requestId: string;
}

const InferenceLogSchema = new Schema<IInferenceLog>(
  {
    _id: { type: String, required: true },
    conversationId: { type: String, required: true, ref: "Conversation" },
    sessionId: { type: String, required: true },
    provider: { type: String, required: true, default: "puter" },
    llmModel: { type: String, required: true },
    requestTimestamp: { type: Date, required: true },
    responseTimestamp: { type: Date, required: true },
    latencyMs: { type: Number, required: true, min: 0 },
    promptTokens: { type: Number, required: true, min: 0 },
    completionTokens: { type: Number, required: true, min: 0 },
    totalTokens: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["success", "error", "cancelled"],
      required: true,
    },
    errorMessage: { type: String },
    inputPreview: { type: String, required: true, maxlength: 500 },
    outputPreview: { type: String, required: true, maxlength: 500 },
    requestId: { type: String, required: true },
  },
  {
    timestamps: false, // requestTimestamp / responseTimestamp carry the time data
  }
);

// ─── Indexes for common query patterns ──────────────────────────────────────
// 1. Filter logs by conversation
InferenceLogSchema.index({ conversationId: 1, requestTimestamp: -1 });
// 2. Dashboard time-series aggregation (newest first)
InferenceLogSchema.index({ requestTimestamp: -1 });
// 3. Filter by model or status in logs view
InferenceLogSchema.index({ llmModel: 1, requestTimestamp: -1 });
InferenceLogSchema.index({ status: 1, requestTimestamp: -1 });
// 4. Unique requestId for idempotency checks
InferenceLogSchema.index({ requestId: 1 }, { unique: true });

export const InferenceLog = model<IInferenceLog>("InferenceLog", InferenceLogSchema);
