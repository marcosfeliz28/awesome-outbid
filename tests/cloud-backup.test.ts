import { describe, expect, it } from "vitest";
import { databaseConfig } from "../deploy/render/backup/render-backup.mjs";

describe("pipeline de respaldo cloud", () => {
  it("construye variables PostgreSQL internas y sólo pasa lo necesario al cliente", () => {
    const { database, env } = databaseConfig(
      "postgresql://backup%40user:p%40ss%3Aword@internal-db:5432/nexora?sslmode=require",
    );
    expect(database).toBe("nexora");
    expect(env).toMatchObject({
      PGHOST: "internal-db",
      PGPORT: "5432",
      PGUSER: "backup@user",
      PGPASSWORD: "p@ss:word",
      PGDATABASE: "nexora",
      PGSSLMODE: "require",
      PGAPPNAME: "nexora-daily-backup",
    });
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
  });

  it("rechaza endpoints no PostgreSQL y URLs incompletas", () => {
    expect(() => databaseConfig("https://example.test/db")).toThrow(
      "BACKUP_DATABASE_URL debe usar PostgreSQL.",
    );
    expect(() => databaseConfig("postgresql://internal-db")).toThrow(
      "BACKUP_DATABASE_URL debe incluir host, usuario y base de datos.",
    );
  });
});
