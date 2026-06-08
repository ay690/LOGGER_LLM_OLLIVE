import { Schema, model, Document } from "mongoose";

// ─── UserSettings document ───────────────────────────────────────────────────
// One document per user. Currently supports a single anonymous "default" user;
// swap userId for a real auth ID when auth is added.
export interface IUserSettings extends Document {
  userId: string;
  defaultProvider: string;
  defaultModel: string;
  streamingEnabled: boolean;
  piiRedactionEnabled: boolean;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: { type: String, required: true, unique: true, default: "default" },
    defaultProvider: { type: String, required: true, default: "puter" },
    defaultModel: { type: String, required: true, default: "gpt-4o-mini" },
    streamingEnabled: { type: Boolean, required: true, default: true },
    piiRedactionEnabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const UserSettings = model<IUserSettings>("UserSettings", UserSettingsSchema);
