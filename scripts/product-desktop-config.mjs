import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function desktopConfig(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("NEXORA_PRODUCT_URL debe ser un origen HTTPS válido."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("NEXORA_PRODUCT_URL debe ser un origen HTTPS, sin ruta ni credenciales.");
  const origin = url.origin;
  return {
    overlay: {
      app: { windows: [{ label: "main", title: "Nexora POS", url: origin,
        width: 1440, height: 960, minWidth: 390, minHeight: 600 }], withGlobalTauri: false },
    },
    capability: {
      identifier: "product-remote-printer",
      description: "Solo la página oficial del producto puede usar la impresora de este equipo.",
      remote: { urls: [origin + "/*"] }, windows: ["main"], permissions: [
        "core:default", "allow-list-printers", "allow-print-thermal", "allow-open-cash-drawer",
      ],
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== "win32") throw new Error("El instalador Tauri de Windows debe compilarse en Windows.");
    const { overlay, capability } = desktopConfig(process.env.NEXORA_PRODUCT_URL);
    const tauri = resolve(root, "apps/web/src-tauri");
    const configFile = resolve(tauri, "product-build.json");
    const capabilityFile = resolve(tauri, "capabilities/product-remote.json");
    mkdirSync(dirname(capabilityFile), { recursive: true });
    writeFileSync(configFile, JSON.stringify(overlay, null, 2) + "\n", { mode: 0o600 });
    writeFileSync(capabilityFile, JSON.stringify(capability, null, 2) + "\n", { mode: 0o600 });
    const cli = resolve(root, "apps/web/node_modules/@tauri-apps/cli/tauri.js");
    execFileSync(process.execPath, [cli, "build", "--config", configFile],
      { cwd: resolve(root, "apps/web"), stdio: "inherit" });
  } catch (error) {
    console.error(String(error?.message ?? error));
    process.exitCode = 1;
  }
}
