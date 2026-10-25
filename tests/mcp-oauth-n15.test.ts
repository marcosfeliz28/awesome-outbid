import { describe, expect, it } from "vitest";
import { mcpClient, pkceChallenge, validateMcpAuthorization } from "../apps/api/src/mcp-oauth-core";

const clients = JSON.stringify([{ id: "cliente-ia", name: "IA del negocio", redirectUris: ["https://cliente.example/callback"] }]);

describe("N-15 · OAuth para MCP de solo lectura", () => {
  it("acepta solo cliente registrado, retorno exacto y PKCE S256", () => {
    const verifier = "a".repeat(43);
    const challenge = pkceChallenge(verifier);
    expect(validateMcpAuthorization({ clientId: "cliente-ia", redirectUri: "https://cliente.example/callback", challenge, method: "S256" }, clients).id).toBe("cliente-ia");
    expect(mcpClient("cliente-ia", clients)?.name).toBe("IA del negocio");
    expect(() => validateMcpAuthorization({ clientId: "cliente-ia", redirectUri: "https://cliente.example.evil/callback", challenge, method: "S256" }, clients)).toThrow();
    expect(() => validateMcpAuthorization({ clientId: "cliente-ia", redirectUri: "https://cliente.example/callback", challenge, method: "plain" }, clients)).toThrow();
  });

  it("permanece apagado sin clientes declarados", () => {
    expect(mcpClient("cliente-ia", "")).toBeNull();
  });
});
