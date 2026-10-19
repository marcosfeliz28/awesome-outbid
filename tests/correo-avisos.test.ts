// Correo de la dueña: cada cierre de caja y cada solicitud de anulación.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailSettings,
  emailWithRetry,
  sendEmail,
} from "../apps/api/src/notifications";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("avisos por correo", () => {
  it("sin clave o sin destinatario queda apagado", () => {
    expect(emailSettings({}).enabled).toBe(false);
    expect(emailSettings({ RESEND_API_KEY: "k" }).enabled).toBe(false);
    expect(
      emailSettings({ RESEND_API_KEY: "k", NOTIFY_EMAIL_TO: "a@b.c" }),
    ).toMatchObject({ enabled: true, to: "a@b.c" });
  });
  it("envía a Resend con la clave y el destinatario", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const settings = emailSettings({
      RESEND_API_KEY: "clave-secreta",
      NOTIFY_EMAIL_TO: "dueña@example.test",
    });
    expect(
      await sendEmail(settings, "Cierre de caja", "A\nB", "cash_close/session-1"),
    ).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer clave-secreta");
    expect(init.headers["Idempotency-Key"]).toBe("cash_close/session-1");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["dueña@example.test"]);
    expect(body.subject).toBe("Cierre de caja");
    expect(body.html).toContain("A<br>B");
  });
  it("un error no filtra la clave", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fallo con clave-secreta");
      }),
    );
    const result: any = await sendEmail(
      emailSettings({
        RESEND_API_KEY: "clave-secreta",
        NOTIFY_EMAIL_TO: "a@b.c",
      }),
      "x",
      "y",
      "void_request/request-1",
    );
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("clave-secreta");
  });

  it("un reintento tras respuesta ambigua reutiliza la clave idempotente", async () => {
    vi.useFakeTimers();
    let accepted: { key: string; body: string; id: string } | null = null;
    let delivered = 0;
    const requests: Array<{ key: string; body: string }> = [];
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const key = init.headers["Idempotency-Key"];
      const body = init.body as string;
      requests.push({ key, body });
      if (accepted) {
        if (accepted.key !== key || accepted.body !== body)
          return new Response('{"message":"idempotency conflict"}', {
            status: 409,
          });
        return new Response(JSON.stringify({ id: accepted.id }), {
          status: 200,
        });
      }
      accepted = { key, body, id: "email_fixture_1" };
      delivered += 1;
      // El proveedor ya aceptó el correo, pero la respuesta se pierde en la red.
      throw new Error("socket closed after provider accepted");
    });
    vi.stubGlobal("fetch", fetchMock);
    const settings = emailSettings({
      RESEND_API_KEY: "test-only-key",
      NOTIFY_EMAIL_TO: "owner@example.test",
    });

    const delivery = emailWithRetry(
      settings,
      "Cierre de caja",
      "fixture",
      "cash_close/session-ambiguous",
    );
    await vi.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delivered).toBe(1);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[0].key).toBe("cash_close/session-ambiguous");
    vi.useRealTimers();
  });
});
