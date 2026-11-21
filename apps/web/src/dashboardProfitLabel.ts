export function grossProfitLabel(
  taxIncluded: boolean,
  language: "es" | "en",
) {
  if (language === "en")
    return taxIncluded
      ? "Gross profit (tax included)"
      : "Gross profit (tax excluded)";
  return taxIncluded
    ? "Ganancia bruta (con ITBIS)"
    : "Ganancia bruta (sin ITBIS)";
}
