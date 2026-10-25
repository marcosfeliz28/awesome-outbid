/* global document */
// Número de WhatsApp de ventas: código de país y solo dígitos (ej.: "18095551234").
// Vacío: los enlaces abren WhatsApp con el mensaje y la persona elige el contacto.
const WHATSAPP_NUMERO = "";
if (/^\d{8,15}$/.test(WHATSAPP_NUMERO)) {
  for (const link of document.querySelectorAll('a[href^="https://wa.me/?"]')) {
    link.href = link.href.replace("https://wa.me/?", `https://wa.me/${WHATSAPP_NUMERO}?`);
  }
}
