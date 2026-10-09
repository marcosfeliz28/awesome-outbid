// SEC-01: un .xlsx es un ZIP. Los importadores deben rechazar una bomba de
// descompresión (o un ZIP malformado) ANTES de que ExcelJS lo cargue en
// memoria, y acotar las celdas de la hoja tras el parseo.
import { describe, expect, it } from "vitest";
import { readInvoiceTable } from "../apps/api/src/invoice";
import { CatalogController } from "../apps/api/src/catalog";
import {
  buildZip,
  sheetXml,
  workbookEntries,
  xlsxBomb,
  xlsxWithSheet,
} from "./fixtures/xlsx-zip";

const map = {
  code: "codigo",
  description: "descripcion",
  qty: "cantidad",
  unitCost: "costo",
};
const MB = 1024 * 1024;
const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "QA",
  email: "qa@example.test",
  role: "manager",
  permissions: ["catalog:write"],
  branchId: "22222222-2222-4222-8222-222222222222",
};
// Una base que falla si alguien llega a escribir: el rechazo es previo.
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error("No debía tocar la base");
    },
  },
);
const catalog = () => new CatalogController(noDb as any);

async function measured(run: () => Promise<unknown>) {
  const peakBefore = process.resourceUsage().maxRSS * 1024;
  const rssBefore = process.memoryUsage().rss;
  const started = Date.now();
  let error: any;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  return {
    error,
    ms: Date.now() - started,
    rssGrowth: process.memoryUsage().rss - rssBefore,
    peakGrowth: process.resourceUsage().maxRSS * 1024 - peakBefore,
  };
}

describe("SEC-01 · bomba XLSX", () => {
  it("la bomba de ~300 KB que descomprime a >100 MB se rechaza rápido y sin subir la memoria (facturas)", async () => {
    const { file, uncompressed } = await xlsxBomb();
    expect(file.length).toBeLessThan(1 * MB);
    expect(uncompressed).toBeGreaterThan(100 * MB);
    const r = await measured(() => readInvoiceTable(file, "xlsx", map));
    console.info(
      `[SEC-01] facturas: archivo ${Math.round(file.length / 1024)} KB → ${Math.round(uncompressed / MB)} MB; ${r.ms} ms; RSS +${Math.round(r.rssGrowth / MB)} MB; pico +${Math.round(r.peakGrowth / MB)} MB`,
    );
    expect(r.error?.status).toBe(400);
    expect(r.error?.message).toMatch(/demasiado grande al descomprimirse/);
    expect(r.ms).toBeLessThan(2000);
    expect(r.rssGrowth).toBeLessThan(64 * MB);
    expect(r.peakGrowth).toBeLessThan(64 * MB);
  }, 60000);

  it("la misma bomba se rechaza en la importación del catálogo sin tocar la base", async () => {
    const { file } = await xlsxBomb();
    const r = await measured(() =>
      catalog().import({ buffer: file, size: file.length }, actor as any),
    );
    expect(r.error?.status).toBe(400);
    expect(r.error?.message).toMatch(/demasiado grande al descomprimirse/);
    expect(r.ms).toBeLessThan(2000);
    expect(r.peakGrowth).toBeLessThan(64 * MB);
  }, 60000);

  it("un directorio central que miente sobre el tamaño descomprimido no la cuela", async () => {
    // Declara 4 KB para una hoja de >100 MB: el tope se aplica a lo que
    // realmente sale del descompresor, no a la cabecera.
    const file = await xlsxWithSheet(sheetXml(1000, 4800, 2), (e) =>
      e.name === "xl/worksheets/sheet1.xml" ? { ...e, declaredSize: 4096 } : e,
    );
    const r = await measured(() => readInvoiceTable(file, "xlsx", map));
    expect(r.error?.status).toBe(400);
    expect(r.error?.message).toMatch(/dañado|demasiado grande/);
    expect(r.ms).toBeLessThan(2000);
    expect(r.peakGrowth).toBeLessThan(64 * MB);
  }, 60000);

  it("muchas etiquetas XML pequeñas (<8 MB) también se rechazan antes de parsear", async () => {
    // 600 000 celdas vacías ocupan 6,6 MB pero ExcelJS gastaría >200 MB.
    const rows: string[] = [];
    for (let r = 1; r <= 1000; r++)
      rows.push(`<row r="${r}">` + `<c r="A${r}"/>`.repeat(600) + "</row>");
    const sheet = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        rows.join("") +
        "</sheetData></worksheet>",
    );
    expect(sheet.length).toBeLessThan(8 * MB);
    const file = await xlsxWithSheet(sheet);
    const r = await measured(() => readInvoiceTable(file, "xlsx", map));
    expect(r.error?.status).toBe(400);
    expect(r.error?.message).toMatch(/demasiados elementos/);
    expect(r.ms).toBeLessThan(2000);
  }, 60000);

  it("tras el parseo acota filas × columnas (celdas) de la hoja", async () => {
    // 20 filas × 3000 columnas = 60 000 celdas: pasa el ZIP (1,4 MB) pero no
    // es una factura.
    const file = await xlsxWithSheet(sheetXml(20, 3000));
    await expect(readInvoiceTable(file, "xlsx", map)).rejects.toThrow(
      /demasiadas celdas/,
    );
    await expect(
      catalog().import({ buffer: file, size: file.length }, actor as any),
    ).rejects.toThrow(/demasiadas celdas/);
  }, 60000);

  describe("ZIP malformados: mensaje claro en español", () => {
    const corrupt = /no es un Excel \(\.xlsx\) válido o está dañado/;
    const entries = () => workbookEntries();
    it("no es un ZIP", async () => {
      await expect(
        readInvoiceTable(Buffer.from("hola, no soy un excel"), "xlsx", map),
      ).rejects.toThrow(corrupt);
    });
    it("el registro final declara más entradas de las que hay", async () => {
      const file = buildZip(await entries(), { entries: 50 });
      await expect(readInvoiceTable(file, "xlsx", map)).rejects.toThrow(
        corrupt,
      );
    });
    it("el directorio central apunta fuera del archivo", async () => {
      const file = buildZip(await entries(), { cdOffset: 10 * MB });
      await expect(readInvoiceTable(file, "xlsx", map)).rejects.toThrow(
        corrupt,
      );
    });
    it("bytes sobrantes tras el registro final", async () => {
      const file = Buffer.concat([
        buildZip(await entries()),
        Buffer.from("basura"),
      ]);
      await expect(readInvoiceTable(file, "xlsx", map)).rejects.toThrow(
        corrupt,
      );
    });
    it("una firma 0x02014b50 suelta en los datos no se cuenta como entrada", async () => {
      // Un escáner de bytes sueltos sumaría esta «entrada» falsa; el
      // directorio central real no la contiene y el libro es legítimo.
      const sig = Buffer.alloc(64);
      sig.writeUInt32LE(0x02014b50, 0);
      sig.writeUInt32LE(0xfffffff0, 24);
      const list = await entries();
      list.push({ name: "docProps/relleno.bin", data: sig, stored: true });
      const wb = buildZip(list);
      await expect(readInvoiceTable(wb, "xlsx", map)).rejects.toThrow(
        /No encontramos las columnas/,
      );
    });
  });

  it("una factura legítima en Excel sigue importando", async () => {
    const legit = await xlsxWithSheet(
      Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
          '<row r="1"><c r="A1" t="inlineStr"><is><t>codigo</t></is></c><c r="B1" t="inlineStr"><is><t>descripcion</t></is></c><c r="C1" t="inlineStr"><is><t>cantidad</t></is></c><c r="D1" t="inlineStr"><is><t>costo</t></is></c></row>' +
          '<row r="2"><c r="A2" t="inlineStr"><is><t>F-1</t></is></c><c r="B2" t="inlineStr"><is><t>Faja</t></is></c><c r="C2"><v>2</v></c><c r="D2"><v>450</v></c></row>' +
          "</sheetData></worksheet>",
      ),
    );
    const table = await readInvoiceTable(legit, "xlsx", map);
    expect(table.lines).toEqual([
      { code: "F-1", description: "Faja", qty: 2, unitCost: 450 },
    ]);
  });
});
