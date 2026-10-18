import { describe, expect, it } from "vitest";
import { retryTemporaryCleanup } from "./temp-cleanup";

describe("limpieza de directorios temporales con PostgreSQL", () => {
  it("reintenta bloqueos EBUSY transitorios y termina la eliminación", async () => {
    let attempts = 0;
    const waits: number[] = [];
    await retryTemporaryCleanup(
      async () => {
        attempts += 1;
        if (attempts < 3)
          throw Object.assign(new Error("busy"), { code: "EBUSY" });
      },
      async (milliseconds) => {
        waits.push(milliseconds);
      },
    );
    expect(attempts).toBe(3);
    expect(waits).toEqual([300, 600]);
  });

  it("no oculta errores permanentes de permisos", async () => {
    const failure = Object.assign(new Error("denied"), { code: "EACCES" });
    await expect(
      retryTemporaryCleanup(async () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });
});
