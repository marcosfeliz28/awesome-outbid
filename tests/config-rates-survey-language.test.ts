import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import ledger from "./config-rates-survey-ledger.json";
import {
  configRatesSurveyCopy,
  configRatesSurveyText,
  type ConfigRatesSurveyKey,
} from "../apps/web/src/configRatesSurveyLanguage";
describe("Configuración: tarifas y resumen de encuesta ES/EN", () => {
  for (const [name, entry] of Object.entries(ledger)) {
    it(`${name}: reversiones de presentación recuperan íntegra la base del producto 8ef351e6`, () => {
      let source = readFileSync(`apps/web/src/${name}.tsx`, "utf8");
      for (const edit of entry.edits) {
        expect(source.split(edit.after).length - 1).toBe(1);
        source = source.replace(edit.after, edit.before);
      }
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        entry.sha256,
      );
    });
  }
  it("cada entrada conserva ES y ofrece EN no vacío", () => {
    for (const key of Object.keys(
      configRatesSurveyCopy,
    ) as ConfigRatesSurveyKey[]) {
      expect(configRatesSurveyText(false, key)).toBe(key);
      expect(configRatesSurveyText(true, key)).toBe(configRatesSurveyCopy[key]);
      expect(configRatesSurveyText(true, key).length).toBeGreaterThan(0);
    }
  });
  it("incentivo por unidad, mitad al por mayor y tarifa histórica conservados", () => {
    const text =
      configRatesSurveyCopy[
        "Lo que gana la cajera por cada unidad vendida. «Venta al por mayor» paga la mitad. Cambiar una tarifa no altera lo ya ganado: cada venta guarda la tarifa vigente al cobrar."
      ];
    expect(text).toContain("per unit sold");
    expect(text).toContain("pays half");
    expect(text).toContain("does not alter past earnings");
    expect(text).not.toContain("percent");
  });
  it("no traduce preguntas, respuestas abiertas, nombres ni claves de encuesta", () => {
    const s = readFileSync("apps/web/src/QuickQuestions.tsx", "utf8").split(
      "export function CashierSurveySummary()",
    )[1];
    expect(s).toContain("<td>{q.text}</td>");
    expect(s).toContain("{t.name}: {t.text}");
    expect(s).toContain('k === "true" ? t("Sí") : k === "false" ? t("No") : k');
    expect(s).toContain('queryKey: ["survey-summary"]');
    expect(s).toContain('>("/survey/summary")');
  });
});
