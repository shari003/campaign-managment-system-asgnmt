import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | null = null;
let _queue: Queue | null = null;

export function getRedisConnection(): IORedis {
    if (!_connection) {
        _connection = new IORedis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.REDIS_PORT) || 6379,
            maxRetriesPerRequest: null,
        });
    }
    return _connection;
}

export function getCampaignQueue(): Queue {
    if (!_queue) {
        _queue = new Queue("campaign-processing", {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: "exponential", delay: 2000 },
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 },
            },
        });
    }
    return _queue;
}
