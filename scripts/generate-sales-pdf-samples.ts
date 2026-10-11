import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drawSaleReceipt } from "../apps/api/src/receipt-pdf";

const outputDir = fileURLToPath(new URL("../docs/capturas/", import.meta.url));
const logo = readFileSync(
  new URL("../apps/web/public/logo-grupo-macgen.png", import.meta.url),
);
const business = {
  name: "Grupo Macgen",
  branchName: "Plaza Lope de Vega",
  address: "Santo Domingo, República Dominicana",
  phone: "809-555-0100",
  logo: "data:image/png;base64," + logo.toString("base64"),
  returnDays: 7,
};
const customer = {
  name: "Cliente ficticio de demostración",
  phone: "8095550199",
  legalId: "00123456789",
};
const seller = { name: "Vendedor de prueba" };
const date = new Date();
const dueDate = new Date(Date.now() + 7 * 86400000);

const samples = [
  {
    filename: "recibo-venta-contado.pdf",
    sale: {
      number: "MUESTRA-CONTADO-001",
      status: "completed",
      createdAt: date,
      subtotal: 2500,
      discountTotal: 0,
      taxTotal: 381.36,
      taxIncluded: true,
      total: 2500,
      creditBalance: 0,
      items: [
        {
          qty: 1,
          unitPrice: 2500,
          discount: 0,
          lineTotal: 2500,
          variant: {
            product: { name: "Producto de muestra - venta de contado" },
          },
        },
      ],
      payments: [
        {
          method: "cash",
          entryType: "sale",
          status: "ok",
          amount: 2500,
          tendered: 2600,
          change: 100,
        },
      ],
      returns: [],
    },
  },
  {
    filename: "recibo-venta-credito.pdf",
    sale: {
      number: "MUESTRA-CREDITO-002",
      status: "completed",
      createdAt: date,
      creditDueDate: dueDate,
      subtotal: 3700,
      discountTotal: 400,
      discountReason: "Precio al por mayor",
      discountRule: "solo-interno",
      discountApprovedName: "Autorizador que no debe aparecer",
      taxTotal: 503.39,
      taxIncluded: true,
      total: 3300,
      creditBalance: 3300,
      items: [
        {
          qty: 2,
          unitPrice: 1850,
          discount: 400,
          lineTotal: 3300,
          variant: { product: { name: "Artículo ficticio de crédito" } },
        },
      ],
      payments: [
        {
          method: "cod",
          entryType: "sale",
          status: "pending",
          amount: 3300,
          tendered: 3300,
          change: 0,
        },
      ],
      returns: [],
    },
  },
  {
    filename: "recibo-venta-anulada.pdf",
    sale: {
      number: "MUESTRA-ANULADA-003",
      status: "voided",
      voidedReason: "Anulación ficticia para revisar el diseño",
      createdAt: date,
      subtotal: 1200,
      discountTotal: 0,
      taxTotal: 0,
      taxIncluded: true,
      total: 1200,
      creditBalance: 0,
      items: [
        {
          qty: 1,
          unitPrice: 1200,
          discount: 0,
          lineTotal: 1200,
          variant: { product: { name: "Artículo de muestra anulada" } },
        },
      ],
      payments: [],
      returns: [],
    },
  },
];

async function pdfBytes(sample: (typeof samples)[number]) {
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  drawSaleReceipt(doc, {
    sale: sample.sale,
    business,
    customer,
    seller,
  });
  doc.end();
  return done;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  for (const sample of samples) {
    await writeFile(join(outputDir, sample.filename), await pdfBytes(sample));
  }
  console.log(`Generados ${samples.length} recibos ficticios en ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
