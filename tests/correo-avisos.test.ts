// Correo de la dueña: cada cierre de caja y cada solicitud de anulación.
import { afterEach, describe, expect, it, vi } from "vitest";
import { emailSettings, sendEmail } from "../apps/api/src/notifications";

afterEach(() => vi.unstubAllGlobals());

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
    expect(await sendEmail(settings, "Cierre de caja", "A\nB")).toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer clave-secreta");
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
    );
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("clave-secreta");
  });
});
