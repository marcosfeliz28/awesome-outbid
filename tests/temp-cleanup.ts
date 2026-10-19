import { rm } from "node:fs/promises";

const RETRYABLE = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

/** Retries transient Windows locks while deleting test-owned temporary folders. */
export async function retryTemporaryCleanup(
  remove: () => Promise<unknown>,
  wait: (milliseconds: number) => Promise<unknown> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await remove();
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Under full Vitest parallel load antivirus/indexers can keep a stopped
      // embedded-PostgreSQL directory open longer than the usual short retry.
      if (!RETRYABLE.has(code ?? "") || attempt >= 20) throw error;
      await wait(Math.min(300 * (attempt + 1), 2000));
    }
  }
}

export function removeTemporaryDirectory(path: string) {
  return retryTemporaryCleanup(() =>
    rm(path, {
      recursive: true,
      force: true,
      maxRetries: 0,
    }),
  );
}
