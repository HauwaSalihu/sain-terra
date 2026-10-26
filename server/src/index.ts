import mongoose from "mongoose";
import { createApp } from "./app";
import { config } from "./config";

async function main() {
  await mongoose.connect(config.mongoUri);
  createApp().listen(config.port, () => {
    console.log(`Sain Terra API listening on http://localhost:${config.port}/api`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
