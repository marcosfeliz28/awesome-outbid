import { createHash } from "node:crypto";

export type McpClient = { id: string; name: string; redirectUris: string[] };

const oauthUri = (value: string) => {
  try {
    const url = new URL(value);
    return !url.hash && !url.username && !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
};

export function mcpClient(id: string, json: string | undefined): McpClient | null {
  if (!json) return null;
  try {
    const clients = JSON.parse(json);
    if (!Array.isArray(clients) || clients.length > 20) return null;
    const client = clients.find((entry) => entry?.id === id);
    if (!client || typeof client.name !== "string" || client.name.length > 100 ||
      !/^[A-Za-z0-9._~-]{3,80}$/.test(client.id) ||
      !Array.isArray(client.redirectUris) || client.redirectUris.length < 1 || client.redirectUris.length > 10 ||
      !client.redirectUris.every((uri: unknown) => typeof uri === "string" && oauthUri(uri))) return null;
    return client as McpClient;
  } catch { return null; }
}

export function pkceChallenge(verifier: string): string {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error("Verificador PKCE inválido.");
  return createHash("sha256").update(verifier).digest("base64url");
}

export function validateMcpAuthorization(
  input: { clientId: string; redirectUri: string; challenge: string; method: string },
  clientsJson: string | undefined,
): McpClient {
  const client = mcpClient(input.clientId, clientsJson);
  if (!client || !client.redirectUris.includes(input.redirectUri) ||
    input.method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(input.challenge))
    throw new Error("Cliente, retorno o PKCE no autorizado.");
  return client;
}
