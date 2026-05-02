import mongoose from "mongoose";
import config from "../config/app.config";

let cachedConnection: typeof mongoose | null = null;

export async function connectDB(): Promise<void> {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return;
    }

    if (!config.database.connectionURL) {
        throw new Error("DATABASE_URL is missing for MongoDB");
    }

    try {
        const conn = await mongoose.connect(config.database.connectionURL, {
            bufferCommands: false,

            maxPoolSize: 10,
            minPoolSize: 1,

            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 10000,
        });

        cachedConnection = conn;
        console.log("Database connected successfully");
    } catch (error) {
        cachedConnection = null;
        console.error("Failed to connect to database:", error);
        throw error;
    }
}

export async function disconnectDB(): Promise<void> {
    if (process.env.VERCEL) return;

    try {
        console.log("Disconnecting from database...");
        await mongoose.connection.close();
        cachedConnection = null;
        console.log("Database disconnected");
    } catch (error) {
        console.error("Error disconnecting DB:", error);
    }
}
