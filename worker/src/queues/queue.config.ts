import IORedis from "ioredis";

let _connection: IORedis | null = null;

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