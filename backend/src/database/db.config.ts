import mongoose from "mongoose";
import config from "../config/app.config";

let isConnected = false;

export async function connectDB(): Promise<void> {
    try {
        if(isConnected) return;

        const uri = config.database.connectionURL || "mongodb://127.0.0.1:27017/mydb";

        await mongoose.connect(uri, {
            bufferCommands: false,
        });
        isConnected = true;
        console.log("Database connected successfully");
    } catch (error) {
        console.error("Failed to connect to database", { error });
    }
};

export async function disconnectDB(): Promise<void> {
    if (!isConnected) return;
	try {
		console.log("Disconnecting from database...")
		await mongoose.connection.close();
        isConnected = false;
		console.log("Database disconnected");
	} catch (error) {
		console.error("Error disconnecting DB: ", error);
	}
}