import { AppearanceControls } from "./AppearanceControls";
import { setLanguage, type Language } from "./inicioLanguage";

/** Visual preferences only. No cart reads, writes, reloads or checkout effects. */
export function CajaVisualPreferences({ language }: { language: Language }) {
  const en = language === "en";
  return (
    <details
      className="fc-preferences"
      aria-label={en ? "Checkout appearance" : "Apariencia de Caja"}
    >
      <summary>
        {en ? "Appearance and language" : "Apariencia e idioma"}
      </summary>
      <div className="fc-preferences-panel">
        <label>
          {en ? "Language" : "Idioma"}
          <select
            aria-label={en ? "Interface language" : "Idioma de la interfaz"}
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value === "en" ? "en" : "es")
            }
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <AppearanceControls language={language} scope="checkout" />
        <small>
          {en
            ? "Main checkout labels translated; product data, payment dialogs and server messages retain their original language."
            : "Preferencias visuales. Los datos de productos y los procesos de pago se conservan sin cambios."}
        </small>
      </div>
    </details>
  );
}
