import { Injectable } from "@nestjs/common";
import { localLicense, type LicenseState } from "./local-license";

/**
 * Efectos permitidos para procesos que no pasan por el middleware HTTP.
 * Un respaldo realmente de solo lectura puede continuar para proteger los
 * datos. Todo trabajo que escriba o borre se pausa en modo de solo lectura.
 */
export type BackgroundEffect = "write-or-delete" | "read-only-backup";

export function backgroundEffectAllowed(
  effect: BackgroundEffect,
  state: LicenseState | undefined,
) {
  return effect === "read-only-backup" || !state || state.mode === "write";
}

@Injectable()
export class LocalLicenseBackgroundPolicy {
  allows(effect: BackgroundEffect) {
    return backgroundEffectAllowed(effect, localLicense()?.state());
  }
}
