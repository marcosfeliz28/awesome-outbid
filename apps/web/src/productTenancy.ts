export function productTenancyRequired(mode: string | undefined): boolean {
  return mode === "required";
}

export function initialCompanyCode(required: boolean): string {
  return required ? "" : "demo";
}
