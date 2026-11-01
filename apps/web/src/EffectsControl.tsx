import { useState } from "react";
import { readEffects, saveEffects, type EffectsMode } from "./motionEffects";

/** Preferencia solo de este navegador; no altera configuración del negocio. */
export function EffectsControl() {
  const [mode, setMode] = useState<EffectsMode>(() => {
    try {
      return readEffects(window.localStorage);
    } catch {
      return "normal";
    }
  });
  return (
    <label className="field">
      <span>Efectos visuales en este equipo</span>
      <select
        aria-label="Efectos visuales"
        value={mode}
        onChange={(event) => {
          const value = event.target.value as EffectsMode;
          setMode(value);
          try {
            saveEffects(value, window.localStorage, document.documentElement);
          } catch {
            document.documentElement.dataset.effects = value;
          }
        }}
      >
        <option value="maximo">Máximo</option>
        <option value="normal">Normal</option>
        <option value="apagado">Apagado</option>
      </select>
    </label>
  );
}
