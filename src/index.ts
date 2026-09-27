import "dotenv/config";

import { createApp } from "./app.js";
import { closeMongo, connectToMongo } from "./mongodb.js";

const port = Number(process.env.PORT ?? 3000);

try {
	await connectToMongo();
	console.log("MongoDB connection established");

	const app = createApp();
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
