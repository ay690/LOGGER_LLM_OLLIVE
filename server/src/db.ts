import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  await mongoose.connect(uri, {
    dbName: "logger_llm",  // explicit DB name; ignores anything in the URI path
  });

  isConnected = true;
  console.log("✅ MongoDB connected");

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
    isConnected = false;
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
    isConnected = false;
  });
}
