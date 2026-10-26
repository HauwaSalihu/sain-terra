import "dotenv/config";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See server/.env.example.`);
  return value;
}

export const config = {
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/sainterra",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  port: Number(process.env.PORT) || 4000,
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim()),
};
