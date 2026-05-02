export const getEnv = <T>(key: string, defaultValue?: T): T => {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
        throw new Error(`Missing environment variable: ${key}`);
    }

    return value as T;
};

const config: any = {};

config.port = getEnv<number>("PORT", 5000);
config.nodeEnv = getEnv<string>("NODE_ENV", "development");
config.rateLimit = {
    limit: getEnv<number>("RATE_LIMIT_LIMIT", 10),
    windowSeconds: getEnv<number>("RATE_LIMIT_WINDOW_SECONDS", 300),
};

config.database = {
    connectionURL: getEnv<string>("DATABASE_URL", ""),
    connectionType: getEnv<string>("DATABASE_TYPE", "mongodb"),
};

config.redis = {
    host: getEnv<string>("REDIS_HOST", "localhost"),
    port: getEnv<number>("REDIS_PORT", 6379),
};

config.environment = getEnv<string>("NODE_ENV", "development");

config.security = {
    allowedOrigins: ["https://campaign-managment-system-asgnmt.vercel.app/", "http://localhost:5173"],
    blockOnThreat: getEnv<boolean>("BLOCK_ON_THREAT", false),
    logThreats: getEnv<boolean>("LOG_THREATS", true),
    credentials: getEnv<boolean>("ALLOW_CREDENTIALS", false),
    xssOptions: {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style"],
        allowCommentTag: false,
        css: false,
    },
};

export default config;
