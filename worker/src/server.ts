import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";

import processCampaign from "./processors/campaign.processor";

import { connectDB, disconnectDB } from "./database/db.config";
import { disconnectRedis, getRedisConnection } from "./queues/queue.config";

async function startWorker() {
    try {
        await connectDB();

        const worker = new Worker("campaign-processing", processCampaign, {
            connection: getRedisConnection(),
            concurrency: 2,
            limiter: {
                max: 10,
                duration: 1000,
            },
        });

        worker.on("completed", (job) => {
            console.log(`[Worker] Job ${job.id} completed`);
        });

        worker.on("failed", (job, err) => {
            console.error(`[Worker] Job ${job?.id} failed:`, err.message);
        });

        worker.on("error", (err) => {
            console.error("[Worker] Error:", err);
        });

        console.log(`[Worker] Campaign processor started, listening for jobs...`);

        const shutdown = async () => {
            console.log("[Worker] Shutting down gracefully...");
            await worker.close();
            await disconnectDB();
            await disconnectRedis();
            process.exit(0);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    } catch (error) {
        console.error("[Worker] Failed to start:", error);
        process.exit(1);
    }
}

startWorker();
