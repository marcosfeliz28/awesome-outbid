import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import request from "supertest";
import { MerchandiseController } from "../apps/api/src/merchandise";
import { AdminController } from "../apps/api/src/admin";
import { CatalogController } from "../apps/api/src/catalog";
import { SalesController } from "../apps/api/src/sales";
import { extractAnthropic } from "../apps/api/src/invoice";
import { Database, type Actor } from "../apps/api/src/common";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const ExcelJS = requireApi("exceljs");
const PDFDocument = requireApi("pdfkit");
const { Module } = requireApi("@nestjs/common");
const { NestFactory } = requireApi("@nestjs/core");

vi.mock("../apps/api/src/invoice", async (original) => ({
  ...(await original<typeof import("../apps/api/src/invoice")>()),
  extractAnthropic: vi.fn(),
}));

const actor: Actor = {
  id: "10000000-0000-4000-8000-000000000001",
  branchId: "10000000-0000-4000-8000-000000000002",
  name: "Prueba",
  email: "prueba@example.test",
  role: "admin",
  permissions: ["inventory:write"],
};
const attachmentId = "10000000-0000-4000-8000-000000000003";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=",
  "base64",
);

function uploaded(
  buffer: Buffer,
  originalname = "factura.png",
  mimetype = "image/png",
) {
  return { buffer, originalname, mimetype, size: buffer.length };
}

function setup() {
  const db = {
    invoiceDraft: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: attachmentId }),
    },
    invoiceAttachment: {
      create: vi.fn().mockResolvedValue({ id: attachmentId }),
      findFirstOrThrow: vi.fn().mockResolvedValue({
        data: png,
        mime: "image/png",
      }),
    },
    variant: { findMany: vi.fn().mockResolvedValue([]) },
    supplier: { findFirstOrThrow: vi.fn().mockResolvedValue({}) },
    supplierCode: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (run) => run(db));
  return { db, controller: new MerchandiseController(db as any) };
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "clave-ficticia-prueba");
  vi.mocked(extractAnthropic).mockResolvedValue({
    lines: [{ description: "Producto", qty: 1, unitCost: 1 }],
    total: 1,
    skipped: 0,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("3ag · formularios que sólo admiten un archivo", () => {
  it.each([
    {
      label: "catálogo",
      controller: CatalogController,
      path: "/products/import",
      xlsx: true,
    },
    {
      label: "logo",
      controller: AdminController,
      path: "/settings/logo",
      xlsx: false,
    },
    {
      label: "evidencia",
      controller: SalesController,
      path: `/payments/${attachmentId}/proof`,
      xlsx: false,
    },
  ])(
    "$label: admite el archivo y rechaza campos de texto antes de consultar datos",
    async (route) => {
      const db: any = {
        auditLog: { create: vi.fn().mockResolvedValue({}) },
        category: { findMany: vi.fn().mockResolvedValue([{ id: actor.id }]) },
        product: { create: vi.fn().mockResolvedValue({ id: attachmentId }) },
        settings: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ id: actor.branchId, data: {} }),
          update: vi.fn().mockResolvedValue({}),
        },
        payment: {
          findFirstOrThrow: vi.fn().mockResolvedValue({
            id: attachmentId,
            saleId: actor.id,
            proofUrl: null,
          }),
          update: vi.fn().mockImplementation(async ({ data }) => ({
            id: attachmentId,
            saleId: actor.id,
            ...data,
          })),
        },
        $queryRaw: vi.fn().mockResolvedValue([]),
        $transaction: vi.fn(),
      };
      db.$transaction.mockImplementation(async (run: any) => run(db));
      let buffer = png;
      if (route.xlsx) {
        const book = new ExcelJS.Workbook();
        const sheet = book.addWorksheet("Productos");
        sheet.addRow([
          "Nombre",
          "SKU",
          "Categoría",
          "Barras",
          "Precio",
          "Costo",
        ]);
        sheet.addRow(["Producto de prueba", "P-001", actor.id, "001", 10, 5]);
        buffer = Buffer.from(await book.xlsx.writeBuffer());
      }
      class FileOnlyTestModule {}
      Module({
        controllers: [route.controller],
        providers: [{ provide: Database, useValue: db }],
      })(FileOnlyTestModule);
      const app = await NestFactory.create(FileOnlyTestModule, {
        logger: false,
      });
      app.use((req: any, _res: any, next: () => void) => {
        req.actor = { ...actor, permissions: ["*"] };
        next();
      });
      await app.init();
      try {
        const send = () =>
          request(app.getHttpServer())
            .post(route.path)
            .attach("file", buffer, {
              filename: route.xlsx ? "productos.xlsx" : "imagen.png",
              contentType: route.xlsx
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "image/png",
            });
        await send().field("extra", "rechazado").expect(400);
        expect(db.category.findMany).not.toHaveBeenCalled();
        expect(db.settings.findUniqueOrThrow).not.toHaveBeenCalled();
        expect(db.payment.findFirstOrThrow).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(db.auditLog.create).not.toHaveBeenCalled();
        expect(extractAnthropic).not.toHaveBeenCalled();
        await send().expect(201);
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(db.auditLog.create).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    },
  );
});

describe("3ag · archivos de facturas", () => {
  it("acepta los cuatro componentes legítimos y rechaza campos adicionales por HTTP", async () => {
    const { db } = setup();
    class FileTestModule {}
    Module({
      controllers: [MerchandiseController],
      providers: [{ provide: Database, useValue: db }],
    })(FileTestModule);
    const app = await NestFactory.create(FileTestModule, { logger: false });
    app.use((req: any, _res: any, next: () => void) => {
      req.actor = actor;
      next();
    });
    await app.init();
    try {
      const send = () =>
        request(app.getHttpServer())
          .post("/merchandise/import")
          .field("supplierId", actor.id)
          .field("mapping", "{}")
          .field("total", "1")
          .attach("file", png, {
            filename: "factura.png",
            contentType: "image/png",
          });
      await send().expect(201);
      await send().field("extra", "rechazado").expect(400);
      expect(db.invoiceAttachment.create).toHaveBeenCalledTimes(1);
      expect(extractAnthropic).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it.each(["image/png", "image/jpeg", "image/webp", "application/pdf"])(
    "rechaza HTML anunciado como %s antes de consultar o enviar datos",
    async (mime) => {
      const { db, controller } = setup();
      await expect(
        controller.importInvoice(
          uploaded(
            Buffer.from("<html><script>alert(1)</script></html>"),
            "factura",
            mime,
          ),
          {},
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(db.invoiceDraft.count).not.toHaveBeenCalled();
      expect(extractAnthropic).not.toHaveBeenCalled();
      expect(db.invoiceAttachment.create).not.toHaveBeenCalled();
    },
  );

  it("rechaza un MIME que contradice los bytes del documento", async () => {
    const { db, controller } = setup();
    await expect(
      controller.importInvoice(
        uploaded(png, "foto.jpg", "image/jpeg"),
        {},
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("comprueba los bytes y no el tamaño declarado en la factura IA", async () => {
    const { controller } = setup();
    const large = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(
      controller.importInvoice({ ...uploaded(large), size: 1 }, {}, actor),
    ).rejects.toMatchObject({ status: 400 });
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("comprueba el límite de 1 MB con los bytes de CSV", async () => {
    const { db, controller } = setup();
    const large = Buffer.from(
      "codigo,descripcion,cantidad,costo\nA,Producto,1,1\n" +
        " ".repeat(1024 * 1024),
    );
    await expect(
      controller.importInvoice(
        { ...uploaded(large, "factura.csv", "text/csv"), size: 1 },
        {
          mapping: JSON.stringify({
            code: "codigo",
            description: "descripcion",
            qty: "cantidad",
            unitCost: "costo",
          }),
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
  });

  it("rechaza contenido binario disfrazado de CSV antes de leerlo", async () => {
    const { db, controller } = setup();
    await expect(
      controller.importInvoice(
        uploaded(
          Buffer.from(
            "codigo,descripcion,cantidad,costo\nA,Producto\u0000,1,1\n",
          ),
          "factura.csv",
          "text/csv",
        ),
        {
          mapping: JSON.stringify({
            code: "codigo",
            description: "descripcion",
            qty: "cantidad",
            unitCost: "costo",
          }),
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
  });

  it("rechaza campos extra del formulario antes de enviar la factura", async () => {
    const { db, controller } = setup();
    await expect(
      controller.importInvoice(
        uploaded(png),
        { branchId: actor.branchId },
        actor,
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("una foto válida se guarda con su tipo verificado y auditoría", async () => {
    const { db, controller } = setup();
    await controller.importInvoice(uploaded(png), {}, actor);
    expect(extractAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ buffer: png, mimetype: "image/png" }),
      "clave-ficticia-prueba",
      expect.any(Object),
    );
    expect(db.invoiceAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mime: "image/png",
        branchId: actor.branchId,
        data: png,
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "invoice_import_review",
        branchId: actor.branchId,
      }),
    });
  });

  it("acepta un PDF real con tipo verificado", async () => {
    const { db, controller } = setup();
    const pdf = new PDFDocument();
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });
    pdf.text("Factura de prueba sin datos reales");
    pdf.end();
    await controller.importInvoice(
      uploaded(await done, "factura.pdf", "application/pdf"),
      {},
      actor,
    );
    expect(db.invoiceAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mime: "application/pdf" }),
    });
  });

  it("rechaza un supuesto PDF truncado antes de enviarlo a la IA", async () => {
    const { db, controller } = setup();
    await expect(
      controller.importInvoice(
        uploaded(
          Buffer.from("%PDF-1.7\narchivo truncado"),
          "factura.pdf",
          "application/pdf",
        ),
        {},
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("mantiene la lectura del XLSX real y guarda el MIME canónico", async () => {
    const { db, controller } = setup();
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Factura");
    sheet.addRow(["codigo", "descripcion", "cantidad", "costo"]);
    sheet.addRow(["001", "Producto de prueba", 1, 10]);
    await controller.importInvoice(
      uploaded(
        Buffer.from(await book.xlsx.writeBuffer()),
        "factura.xlsx",
        "application/octet-stream",
      ),
      {
        mapping: JSON.stringify({
          code: "codigo",
          description: "descripcion",
          qty: "cantidad",
          unitCost: "costo",
        }),
      },
      actor,
    );
    expect(db.invoiceAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    });
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("rechaza archivos renombrados a XLSX antes de consultar datos", async () => {
    const { db, controller } = setup();
    await expect(
      controller.importInvoice(
        uploaded(
          Buffer.from("esto no es un ZIP"),
          "factura.xlsx",
          "application/octet-stream",
        ),
        {},
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.invoiceDraft.count).not.toHaveBeenCalled();
    expect(extractAnthropic).not.toHaveBeenCalled();
  });

  it("la descarga es privada, no interpreta contenido y conserva la sucursal", async () => {
    const { db, controller } = setup();
    const response = { setHeader: vi.fn(), send: vi.fn() };
    await controller.attachment(attachmentId, actor, response as any);
    expect(db.invoiceAttachment.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: attachmentId, branchId: actor.branchId },
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringMatching(/^attachment;/),
    );
  });

  it("los adjuntos antiguos con MIME activo se descargan como binario", async () => {
    const { db, controller } = setup();
    db.invoiceAttachment.findFirstOrThrow.mockResolvedValue({
      data: Buffer.from("<html>documento antiguo</html>"),
      mime: "text/html",
    });
    const response = { setHeader: vi.fn(), send: vi.fn() };
    await controller.attachment(attachmentId, actor, response as any);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/octet-stream",
    );
  });
});
