import "dotenv/config";

export function getMongoUri(): string | undefined {
  return process.env.MONGO_URI;
}

export function getPort(): number {
  return Number(process.env.PORT ?? 3000);
}