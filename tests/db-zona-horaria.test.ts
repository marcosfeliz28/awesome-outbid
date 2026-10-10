// D-B7 (auditoría 06 v2): al arrancar se lee TimeZone de la sesión de
// PostgreSQL y se avisa si no es UTC; el diagnóstico nunca impide arrancar.
import { describe, expect, it, vi } from "vitest";
import {
  checkDatabaseTimeZone,
  isUtcTimeZone,
} from "../apps/api/src/database-timezone";

const db = (tz: unknown) => ({
  $queryRawUnsafe: vi.fn(async () => [{ tz }]),
});

describe("D-B7 · zona horaria de la base al arrancar", () => {
  it("reconoce los nombres de UTC", () => {
    for (const name of ["UTC", "utc", "Etc/UTC", "GMT", "Etc/GMT", "Zulu"])
      expect(isUtcTimeZone(name), name).toBe(true);
    for (const name of ["America/Santo_Domingo", "Europe/Madrid", "", null])
      expect(isUtcTimeZone(name), String(name)).toBe(false);
  });

  it("en UTC no avisa", async () => {
    const warn = vi.fn();
    expect(await checkDatabaseTimeZone(db("UTC"), warn)).toBe("UTC");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fuera de UTC avisa con la zona encontrada y cómo corregirla", async () => {
    const warn = vi.fn();
    await checkDatabaseTimeZone(db("America/Santo_Domingo"), warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(
      /America\/Santo_Domingo.*no UTC.*TimeZone/s,
    );
  });

  it("si la lectura falla no lanza ni avisa", async () => {
    const warn = vi.fn();
    const broken = {
      $queryRawUnsafe: vi.fn(async () => {
        throw new Error("sin conexión");
      }),
    };
    expect(await checkDatabaseTimeZone(broken, warn)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(await checkDatabaseTimeZone(db(undefined), warn)).toBeNull();
  });
});
