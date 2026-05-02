import mongoose from "mongoose";
import config from "../config/app.config";

let isConnected = false;

export async function connectDB() {
    if(isConnected) return;
    try {

        const uri = config.database.connectionURL || "mongodb://127.0.0.1:27017/mydb";

        isConnected = true;
        return await mongoose.connect(uri);
    } catch (error: any) {
        console.error("Failed to connect to database", { error });
        throw new Error(error);
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