import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const worlds = pgTable("worlds", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  seedText: text("seed_text").notNull(),
  params: jsonb("params").notNull(),
  overrides: jsonb("overrides").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorldRow = typeof worlds.$inferSelect;
