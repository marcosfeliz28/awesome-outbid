/** Preferencia visual local: nunca modifica los ajustes ni los datos del negocio. */
export type EffectsMode = "maximo" | "normal" | "apagado";
const KEY = "norexos:efectos";

export function readEffects(storage: Pick<Storage, "getItem">): EffectsMode {
  try {
    const value = storage.getItem(KEY);
    return value === "maximo" || value === "apagado" ? value : "normal";
  } catch {
    return "normal";
  }
}

export function applyEffects(
  mode: EffectsMode,
  target: { dataset: { effects?: string } },
) {
  target.dataset.effects = mode;
}

export function saveEffects(
  mode: EffectsMode,
  storage: Pick<Storage, "setItem">,
  target: { dataset: { effects?: string } },
) {
  applyEffects(mode, target);
  try {
    storage.setItem(KEY, mode);
  } catch {
    /* Conserva el modo durante esta visita. */
  }
}
