import { Schema, model } from "mongoose";

// ─── Message sub-document ────────────────────────────────────────────────────
export interface IMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
  // isStreaming is transient UI state — never persisted
}

const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false } // no extra _id for sub-documents; we carry our own nanoid `id`
);

// ─── Conversation document ───────────────────────────────────────────────────
export interface IConversation {
  _id: string; // nanoid string kept as-is from the frontend
  title: string;
  llmModel: string;   // named llmModel to avoid clash with mongoose Document.model()
  provider: string;
  status: "active" | "cancelled" | "completed";
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    _id: { type: String, required: true }, // nanoid from client
    title: { type: String, required: true, trim: true, maxlength: 200 },
    llmModel: { type: String, required: true, trim: true },
    provider: { type: String, required: true, default: "puter" },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
    },
    messages: { type: [MessageSchema], default: [] },
  },
  {
    timestamps: true, // auto-manages createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: message count without loading all message content
ConversationSchema.virtual("messageCount").get(function () {
  return (this.messages as IMessage[]).length;
});

// Index: most recent conversations first, filter by status
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ status: 1, updatedAt: -1 });

export const Conversation = model<IConversation>("Conversation", ConversationSchema);
