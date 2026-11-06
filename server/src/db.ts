import mongoose from "mongoose";
import { config } from "./config.js";

let memoryServer: { stop: () => Promise<unknown> } | null = null;

/**
 * Connect to MongoDB. With no MONGODB_URI (development only) a throwaway
 * in-memory MongoDB is started so the app runs with zero setup.
 */
export async function connectDb(uri = config.mongoUri): Promise<void> {
  let target = uri;
  if (!target) {
    if (config.isProd) throw new Error("MONGODB_URI is required in production.");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    target = server.getUri();
    console.info("[db] MONGODB_URI is not set. Using an in-memory MongoDB; data resets on restart.");
  }
  await mongoose.connect(target, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes (unique email, unique queue code per user, ...) before serving traffic.
  await mongoose.connection.syncIndexes();
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  memoryServer = null;
}
