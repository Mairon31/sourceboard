import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./worker/db/schema.ts", "./worker/db/share-links-schema.ts", "./worker/db/cms-schema.ts"],
  out: "./migrations",
  strict: true,
  verbose: true,
});
