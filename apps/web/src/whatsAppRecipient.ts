/**
 * WhatsApp espera el número internacional sin signos. Los teléfonos locales
 * dominicanos tienen diez dígitos y usan el código de país 1; los números que
 * ya vienen en formato internacional se conservan.
 */
export function whatsAppRecipient(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}
