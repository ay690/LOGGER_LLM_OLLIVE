import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import conversationsRouter from "./routes/conversations";
import logsRouter from "./routes/logs";
import settingsRouter from "./routes/settings";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Crash handlers — log crashes clearly in dev ──────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[CRASH] Uncaught exception:", err);
  // Don't exit — let nodemon keep watching for file changes to fix the error
});
process.on("unhandledRejection", (reason) => {
  console.error("[CRASH] Unhandled rejection:", reason);
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Vite dev server
      "http://localhost:4173", // Vite preview
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "1mb" }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/conversations", conversationsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/settings", settingsRouter);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   API base: http://localhost:${PORT}/api`);
  });
}

main().catch((err) => {
  console.error("[CRASH] Failed to start server:", err);
  // Don't call process.exit — keep the process alive so nodemon
  // detects the next file save and restarts automatically
});
