import { useLanguage } from "./inicioLanguage";

export function CustomerPrivacyNotice() {
  const english = useLanguage() === "en";
  return (
    <p className="privacy-notice full">
      {english
        ? "We use these data only to record the customer's sales, warranties and credit. Phone, email and identity card/RNC are optional. The customer may request to view, correct or delete them."
        : "Usamos estos datos sólo para registrar las ventas, garantías y créditos del cliente. Teléfono, correo y cédula/RNC son opcionales. El cliente puede pedir verlos, corregirlos o borrarlos."}{" "}
      <a href="/privacidad.html" target="_blank" rel="noopener">
        {english ? "Privacy (Spanish)" : "Privacidad"}
      </a>
    </p>
  );
}
