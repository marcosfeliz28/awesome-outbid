export const configRatesSurveyCopy = {
  "Incentivos por categoría": "Incentives by category",
  "Lo que gana la cajera por cada unidad vendida. «Venta al por mayor» paga la mitad. Cambiar una tarifa no altera lo ya ganado: cada venta guarda la tarifa vigente al cobrar.":
    "What the cashier earns per unit sold. “Wholesale sale” pays half. Changing a rate does not alter past earnings: each sale keeps the rate in effect when payment was collected.",
  CATEGORÍA: "CATEGORY",
  "RD$ POR UNIDAD": "RD$ PER UNIT",
  "Por defecto": "Default",
  "Incentivo por unidad de ": "Per-unit incentive for ",
  "Guardando…": "Saving…",
  "Guardar tarifas": "Save rates",
  "Cada tarifa debe ser un monto de 0 o más.":
    "Each rate must be an amount of 0 or more.",
  "Tarifas de incentivos guardadas.": "Incentive rates saved.",
  "Encuesta de la caja": "Cashier survey",
  "personas respondieron.": "people responded.",
  PREGUNTA: "QUESTION",
  RESPUESTAS: "RESPONSES",
  Sí: "Yes",
  No: "No",
  "Promedio ": "Average ",
} as const;
export type ConfigRatesSurveyKey = keyof typeof configRatesSurveyCopy;
export function configRatesSurveyText(
  english: boolean,
  key: ConfigRatesSurveyKey,
): string {
  return english ? configRatesSurveyCopy[key] : key;
}
