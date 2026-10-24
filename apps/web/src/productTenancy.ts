export function productTenancyRequired(mode: string | undefined): boolean {
  return mode === "required";
}

export function publicRegistrationEnabled(tenancyMode: string | undefined, registrationMode: string | undefined): boolean {
  return productTenancyRequired(tenancyMode) && registrationMode === "enabled";
}

export function initialCompanyCode(required: boolean): string {
  return required ? "" : "demo";
}
