import express, { Application, Request, Response, NextFunction } from "express";
import morgan from "morgan";

import config from "./config/app.config";
import routes from "./routes";

const app: Application = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use((req: Request, res: Response, next: NextFunction) => {
    const origins = config.security.allowedOrigins;

    if (
        origins.length === 0 ||
        origins.includes("*") ||
        origins.includes(req.headers.origin as string)
    ) {
        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    }

    if (config.security.credentials) {
        res.header("Access-Control-Allow-Credentials", "true");
    }

    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ message: "Campaign Management System API", status: "running" });
});

app.use("/api", routes);

app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error:", err);

    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
    });
});

export default app;
