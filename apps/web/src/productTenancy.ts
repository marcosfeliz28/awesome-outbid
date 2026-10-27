export function productTenancyRequired(mode: string | undefined): boolean {
  return mode === "required";
}

export function productAssistantAvailable(
  mode: string | undefined,
  role: string | undefined,
): boolean {
  return productTenancyRequired(mode) && role !== "support";
}

export function publicRegistrationEnabled(tenancyMode: string | undefined, registrationMode: string | undefined): boolean {
  return productTenancyRequired(tenancyMode) && registrationMode === "enabled";
}

export function initialCompanyCode(required: boolean): string {
  return required ? "" : "demo";
}

// Palabras y valores propios de la tienda (la dueña, su mensajero) que el
// producto no muestra a otras empresas.
export const PRODUCT_MODE = productTenancyRequired(import.meta.env.VITE_PRODUCT_TENANCY);
export const OWNER_WORD = PRODUCT_MODE ? "la administración" : "la dueña";
export const DEFAULT_COURIER = PRODUCT_MODE ? "Mensajero" : "Addison";
