import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { readInvoiceTable } from "../apps/api/src/invoice";

const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");
const apiRequire = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const JSZip = createRequire(apiRequire.resolve("exceljs"))("jszip");
const path = new URL(
  "../docs/plantillas/ENTRADA-MERCANCIA-LOTES.xlsx",
  import.meta.url,
);
const mapping = {
  code: "codigo",
  description: "descripcion",
  qty: "cantidad",
  unitCost: "costo",
};

it("generador reproducible: CLI ExcelJS funciona sin runtime externo y conserva el contrato", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "nexora-template-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "../scripts/create-merchandise-template.mjs",
            import.meta.url,
          ),
        ),
        "--output",
        temporary,
      ],
      {
        cwd: temporary,
        env: {
          ...process.env,
          NEXORA_ARTIFACT_DEPENDENCIES: join(temporary, "runtime-inexistente"),
        },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    const generated = readFileSync(
      join(temporary, "ENTRADA-MERCANCIA-LOTES.xlsx"),
    );
    const repeated = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "../scripts/create-merchandise-template.mjs",
            import.meta.url,
          ),
        ),
        "--output",
        temporary,
      ],
      { cwd: temporary, encoding: "utf8", windowsHide: true },
    );
    expect(repeated.status).not.toBe(0);
    expect(repeated.stderr).toContain("EEXIST");
    expect(
      readFileSync(join(temporary, "ENTRADA-MERCANCIA-LOTES.xlsx")),
    ).toEqual(generated);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated);
    expect(
      workbook.worksheets.map((sheet: { name: string }) => sheet.name),
    ).toEqual(["Mercancia", "Instrucciones"]);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).values.slice(1)).toEqual([
      "codigo",
      "descripcion",
      "cantidad",
      "costo",
      "lote",
      "vencimiento",
    ]);
    expect(sheet.rowCount).toBe(201);
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 1,
      ySplit: 1,
      showGridLines: false,
    });
    for (let row = 2; row <= 201; row++) {
      for (let column = 1; column <= 6; column++)
        expect(sheet.getCell(row, column).value).toBeNull();
      expect(sheet.getCell(row, 1).numFmt).toBe("@");
      expect(sheet.getCell(row, 5).numFmt).toBe("@");
      expect(sheet.getCell(row, 6).numFmt).toBe("yyyy-mm-dd");
    }
    expect(
      workbook.getWorksheet("Instrucciones").getCell("B5").value,
    ).toContain("no importa lote ni vencimiento automáticamente");
    sheet.getRow(2).values = [
      "001033",
      "Producto de prueba",
      2.5,
      800.25,
      "0007",
      new Date("2028-06-30T00:00:00Z"),
    ];
    const filled = Buffer.from(await workbook.xlsx.writeBuffer());
    const zip = await JSZip.loadAsync(filled);
    const xml = await zip.file("xl/worksheets/sheet1.xml").async("string");
    const dateCell = xml.match(/<c\b[^>]*r="F2"[^>]*>(.*?)<\/c>/)?.[0];
    expect(dateCell).toBeDefined();
    expect(dateCell).not.toMatch(/t="(?:s|str|inlineStr)"/);
    expect(dateCell).toMatch(/<v>\d+(?:\.\d+)?<\/v>/);
    const parsed = await readInvoiceTable(filled, "xlsx", mapping);
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]).toMatchObject({
      code: "001033",
      qty: 2.5,
      unitCost: 800.25,
    });
    expect(parsed.lines[0].lotNumber).toBeUndefined();
    expect(parsed.lines[0].expiryDate).toBeUndefined();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(filled);
    expect(reopened.worksheets[0].getCell("E2").value).toBe("0007");
    expect(reopened.worksheets[0].getCell("F2").value.toISOString()).toBe(
      "2028-06-30T00:00:00.000Z",
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

it("plantilla vacía: columnas reales, códigos texto y aviso de lote manual", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path));
  const sheet = workbook.worksheets[0];
  expect(sheet.name).toBe("Mercancia");
  expect(sheet.getRow(1).values.slice(1)).toEqual([
    "codigo",
    "descripcion",
    "cantidad",
    "costo",
    "lote",
    "vencimiento",
  ]);
  expect(sheet.getCell("A2").numFmt).toBe("@");
  expect(sheet.getCell("E2").numFmt).toBe("@");
  expect(sheet.getCell("F2").numFmt).toBe("yyyy-mm-dd");
  expect(sheet.getCell("A2").value).toBeNull();
  expect(workbook.getWorksheet("Instrucciones").getCell("B5").value).toContain(
    "no importa lote ni vencimiento",
  );
  await expect(
    readInvoiceTable(readFileSync(path), "xlsx", mapping),
  ).rejects.toThrow("No encontramos líneas");
});

it("roundtrip: llenado y lector real conservan ceros, decimales y columnas auxiliares", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path));
  workbook.worksheets[0].getRow(2).values = [
    "001033",
    "Producto de prueba",
    2.5,
    800.25,
    "0007",
    new Date("2028-06-30T00:00:00Z"),
  ];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await readInvoiceTable(buffer, "xlsx", mapping);
  expect(result.lines).toHaveLength(1);
  expect(result.lines[0]).toMatchObject({
    code: "001033",
    description: "Producto de prueba",
    qty: 2.5,
    unitCost: 800.25,
  });
  expect(result.lines[0].lotNumber).toBeUndefined();
  expect(result.lines[0].expiryDate).toBeUndefined();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  expect(reopened.worksheets[0].getCell("E2").value).toBe("0007");
  expect(
    reopened.worksheets[0].getCell("F2").value.toISOString().slice(0, 10),
  ).toBe("2028-06-30");
});
