import { describe, expect, it } from "vitest";
import type * as Sentry from "@sentry/node";
import {
  initializeApiMonitoring,
  sanitizeApiEvent,
} from "../apps/api/src/monitoring";

describe("API monitoring privacy guardrails", () => {
  it("stays disabled unless an operator provides a DSN", () => {
    expect(initializeApiMonitoring({})).toBe(false);
  });

  it("removes request, identity, and free-text error data before reporting", () => {
    const event = {
      request: {
        url: "/api/sales/secret-sale-id?token=secret-token",
        data: { customerName: "Private Customer", amount: 9999 },
        headers: { authorization: "Bearer secret-token" },
        cookies: { session: "secret-cookie" },
      },
      user: { id: "private-user", email: "private@example.invalid" },
      extra: { payment: "private-card-data" },
      contexts: { sale: { amount: 9999 } },
      breadcrumbs: [{ message: "Private Customer purchased product" }],
      logentry: { message: "Private Customer payment failed" },
      transaction: "/api/sales/secret-sale-id",
      message: "Private Customer payment failed",
      tags: { area: "sales", user: "private-user" },
      exception: {
        values: [
          {
            type: "Error",
            value: "secret-token Private Customer",
            mechanism: { type: "generic", data: { token: "secret-token" } },
            stacktrace: {
              frames: [
                {
                  filename: "sales.js",
                  function: "saveSale",
                  vars: { customerName: "Private Customer" },
                  context_line: "payment secret-token",
                },
              ],
            },
          },
        ],
      },
    } as unknown as Sentry.Event;

    const sanitized = sanitizeApiEvent(event);
    const encoded = JSON.stringify(sanitized);
    for (const privateValue of [
      "secret-sale-id",
      "secret-token",
      "secret-cookie",
      "Private Customer",
      "private@example.invalid",
      "9999",
      "private-card-data",
      "private-user",
    ]) {
      expect(encoded).not.toContain(privateValue);
    }
    expect(sanitized.transaction).toBe("api.internal_error");
    expect(sanitized.message).toBe("Unhandled API exception");
    expect(sanitized.tags).toEqual({ service: "nexora-api", area: "sales" });
    expect(sanitized.exception?.values?.[0]?.value).toBe(
      "Unhandled API exception",
    );
  });
});
