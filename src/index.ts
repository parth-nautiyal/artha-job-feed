import { createApp } from "./app.js";
import { getPort } from "./config/env.js";
import { closeMongo, connectToMongo } from "./database/mongodb.js";
import { initializeMongoDatabase } from "./database/mongodb-init.js";

const port = getPort();

try {
	const mongoClient = await connectToMongo();
	await initializeMongoDatabase(mongoClient);
	console.log("MongoDB connection established");
	console.log("MongoDB collections and indexes initialized");

	const app = createApp(mongoClient.db());
	app.listen(port, () => {
		console.log(`HTTP server listening on port ${port}`);
	});
} catch (error) {
	console.error("MongoDB startup connection failed", error);
	process.exitCode = 1;
}

process.once("SIGINT", async () => {
	await closeMongo();
	process.exit(0);
});

process.once("SIGTERM", async () => {
	await closeMongo();
	process.exit(0);
});
