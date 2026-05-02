import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import config from "./config/app.config";
import { connectDB, disconnectDB } from "./database/db.config";
import { disconnectRedis } from './queues/queue.config';

const server = app.listen(config.port, async () => {         
    await connectDB().then(() => console.log("Database connected successfully")).catch(err => console.log);
    console.log(`Server running on http://localhost:${config.port}`);
});

process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    server.close(async () => {
        await disconnectDB();
        await disconnectRedis();
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(async () => {
        await disconnectDB();
        await disconnectRedis();
        process.exit(0);
    });
});