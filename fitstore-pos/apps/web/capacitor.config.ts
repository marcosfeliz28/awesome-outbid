import type { CapacitorConfig } from "@capacitor/cli";
const hosted = process.env.FITSTORE_WEB_URL;
if (hosted && !hosted.startsWith("https://"))
  throw new Error("La aplicación nativa debe abrir un sitio HTTPS.");
const config: CapacitorConfig = {
  appId: "com.fitstore.pos",
  appName: "FitStore POS",
  webDir: "dist",
  ...(hosted ? { server: { url: hosted, cleartext: false } } : {}),
};
export default config;
