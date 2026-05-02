import IORedis from "ioredis";

import config from "../config/app.config";

let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis {

    const isProduction = config.nodeEnv === "production";

    if (!_connection) {
        if(!isProduction) {
            _connection = new IORedis({
                host: process.env.REDIS_HOST || "127.0.0.1",
                port: Number(process.env.REDIS_PORT) || 6379,
                maxRetriesPerRequest: null,
            });
        } else {
            _connection = new IORedis(process.env.REDIS_PRODUCTION_URL || "", {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });
        }
    }
    return _connection;
}

export async function disconnectRedis(): Promise<void> {
    if (_connection) {
        await _connection.quit();
        _connection = null;
        console.log("Redis disconnected");
    }
}