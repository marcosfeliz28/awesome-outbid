import { describe, expect, it } from "vitest";
import {
  matchesSearch,
  searchHits,
  searchTerms,
  searchVariantsForDb,
} from "../packages/shared/src/index";

// Orden de la dueña (21-oct): el buscador va palabra por palabra.
const iso = "ISO100 Hydrolyzed - Dymatize - Gourmet Vanilla / 5 lb";
const iso2 = "Isopure - Vanilla Salted Caramel / 3 lb";
const cinna = "ISO100 Hydrolyzed - Dymatize - Cinnamon Cereal / 1.34 lb";
const nitro = "Nitro Tech - MuscleTech - Chocolate / 12 lbs";

describe("Buscador palabra por palabra", () => {
  it("una palabra al final del nombre encuentra el producto", () => {
    expect(matchesSearch(iso, "vanilla")).toBe(true);
    expect(matchesSearch(iso, "5 lb")).toBe(true);
  });
  it("vainilla (español) encuentra Vanilla", () => {
    expect(matchesSearch(iso, "vainilla")).toBe(true);
    expect(matchesSearch(iso2, "vainilla caramelo")).toBe(true);
    expect(matchesSearch(cinna, "canela")).toBe(true);
  });
  it("2 libras, 2 L, 2lbs y 3 lb encuentran su peso", () => {
    expect(matchesSearch(iso2, "3 libras")).toBe(true);
    expect(matchesSearch(iso2, "3 L")).toBe(true);
    expect(matchesSearch(iso2, "3lbs")).toBe(true);
    expect(matchesSearch(nitro, "12 libras")).toBe(true);
    expect(matchesSearch(cinna, "1.34 lb")).toBe(true);
  });
  it("2 libras no encuentra 12 lb", () => {
    expect(matchesSearch(nitro, "2 libras")).toBe(false);
  });
  it("iso encuentra ISO100 e Isopure; el orden no importa", () => {
    expect(matchesSearch(iso, "iso")).toBe(true);
    expect(matchesSearch(iso2, "iso")).toBe(true);
    expect(matchesSearch(iso, "vainilla iso 5 libras")).toBe(true);
    expect(matchesSearch(iso, "chocolate iso")).toBe(false);
  });
  it("la API recibe las formas escritas del peso", () => {
    expect(searchTerms("vainilla 2 L")).toEqual([
      ["vainilla", "vanilla"],
      ["2lb"],
    ]);
    expect(searchVariantsForDb("2lb")).toEqual(
      expect.arrayContaining(["2lb", "2 lb", "2 lbs", "2lbs"]),
    );
  });
  it("la talla es palabra completa: «m» no encuentra Mousse ni la S", () => {
    const m = "Faja tipo chaleco M";
    expect(matchesSearch(m, "chaleco m")).toBe(true);
    expect(matchesSearch("Faja tipo chaleco S", "chaleco m")).toBe(false);
    expect(matchesSearch("Isopure - Chocolate Mousse", "chocolate m")).toBe(
      false,
    );
    expect(matchesSearch("FAJA TIPO CHALECO 2xs", "chaleco 2xs")).toBe(true);
  });
  it("parecidos: cuenta las palabras en común, con la talla", () => {
    const q = "cinturilla tipo chaleco m";
    expect(searchHits("Cinturilla tipo corset M", q)).toBe(3);
    expect(searchHits("Faja tipo chaleco M", q)).toBe(3);
    expect(searchHits("Cinturilla tipo corset S", q)).toBe(2);
  });
});
