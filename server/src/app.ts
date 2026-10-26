import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler } from "./http";
import { requireAuth } from "./middleware/auth";
import auth from "./routes/auth";
import buyers from "./routes/buyers";
import dashboard from "./routes/dashboard";
import offers from "./routes/offers";
import payments from "./routes/payments";
import properties from "./routes/properties";
import users from "./routes/users";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", auth);
  // Everything below needs a signed-in, active staff account.
  app.use("/api", requireAuth);
  app.use("/api/dashboard", dashboard);
  app.use("/api/properties", properties);
  app.use("/api/buyers", buyers);
  app.use("/api/offers", offers);
  app.use("/api/payments", payments);
  app.use("/api/users", users);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
  app.use(errorHandler);
  return app;
}
