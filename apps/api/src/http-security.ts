import type { NextFunction, Request, Response } from "express";

/** Las respuestas de la API no deben sobrevivir en cachés de un navegador compartido. */
export function preventPrivateResponseCaching(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");
  next();
}

/** CORS admite un único origen; nunca una ruta, credenciales o una lista. */
export function configuredWebOrigin(env: NodeJS.ProcessEnv = process.env) {
  const origin = env.WEB_ORIGIN?.trim();
  if (env.NODE_ENV === "production" && !origin)
    throw new Error("WEB_ORIGIN es obligatorio en producción.");
  if (!origin) return "http://localhost:5173";
  try {
    const url = new URL(origin);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      origin.includes("*")
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "WEB_ORIGIN debe ser un único origen HTTP(S), sin ruta ni credenciales.",
    );
  }
}
