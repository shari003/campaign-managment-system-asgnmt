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

config.database = {
    connectionURL: getEnv<string>("DATABASE_URL", ""),
    connectionType: getEnv<string>("DATABASE_TYPE", "mongodb"),
};

config.redis = {
    host: getEnv<string>("REDIS_HOST", "localhost"),
    port: getEnv<number>("REDIS_PORT", 6379),
};

config.environment = getEnv<string>("NODE_ENV", "development");

export default config;
