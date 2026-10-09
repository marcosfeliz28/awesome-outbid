import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { permissions, lineTotals, d, money } from "@fitstore/shared";
config({ path: "../../.env" });
const db = new PrismaClient();
const id = () => randomUUID();
const ago = (days: number) => new Date(Date.now() - days * 86400000);
const future = (days: number) => new Date(Date.now() + days * 86400000);
const names = [
  [
    "Proteína Whey Isolate",
    "Creatina Monohidratada",
    "Pre-entreno Energy",
    "Colágeno Beauty",
    "BCAA Recovery",
    "Proteína Vegan Blend",
    "Omega 3 Essential",
    "Multivitamínico Daily",
    "Glutamina Pure",
    "Magnesio Balance",
    "Proteína Whey Classic",
    "Pre-entreno Berry",
  ],
  [
    "Legging Essential",
    "Top Motion",
    "Short Active",
    "Camiseta Training",
    "Legging Sculpt",
    "Jogger Relax",
    "Top Seamless",
    "Set Power",
    "Biker Short",
    "Chaqueta Warm Up",
    "Body Flex",
    "Tank Fit",
  ],
  [
    "Faja Power Sculpt",
    "Cinturilla Daily",
    "Faja Short Control",
    "Chaleco Posture",
    "Faja Colombian Fit",
    "Cinturón Shape",
    "Faja Comfort",
    "Cinturilla Sport",
    "Faja Invisible",
    "Chaleco Sculpt",
    "Faja Waist Pro",
    "Faja High Support",
  ],
  [
    "Shaker FitStore",
    "Bandas Resistance",
    "Guantes Training",
    "Straps Pro",
    "Cuerda Speed",
    "Botella Hydrate",
    "Cinturón Lifting",
    "Mat Yoga Flow",
    "Tobilleras Cable",
    "Bolso Gym Day",
    "Mini Bands",
    "Toalla Sport",
  ],
  [
    "Base Skin Glow",
    "Labial Velvet",
    "Rubor Bloom",
    "Corrector Soft Touch",
    "Máscara Lash Up",
    "Iluminador Golden",
    "Paleta Nude Days",
    "Gloss Shine",
    "Sérum Vitamin C",
    "Polvo Skin Blur",
    "Lip Tint Berry",
    "Primer Radiance",
  ],
];
function ean(value: number) {
  const digits = ("770" + String(value).padStart(9, "0")).slice(0, 12);
  const checksum =
    (10 -
      ([...digits].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) %
        10)) %
    10;
  return digits + checksum;
}
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("No se permiten datos de demostración en producción.");
  if (await db.user.count()) {
    console.log("La base ya tiene usuarios. Seed omitido sin borrar datos.");
    return;
  }
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Define SEED_DEMO_PASSWORD (mínimo 12 caracteres).");
  const categoryNames = [
    "Suplementos",
    "Ropa deportiva",
    "Fajas",
    "Accesorios de gym",
    "Maquillaje",
  ];
  const colors = ["#7C3AED", "#0EA5E9", "#EC4899", "#F97316", "#E11D48"];
  const roleIds = Object.fromEntries(
    Object.keys(permissions).map((name) => [name, id()]),
  );
  const categoryIds = categoryNames.map(() => id());
  const supplierIds = [id(), id(), id()];
  const users = [
    {
      id: id(),
      name: "Valeria Rivera",
      email: "admin@fitstore.demo",
      role: "admin",
      pin: "123456",
    },
    {
      id: id(),
      name: "Andrea Gómez",
      email: "gerente@fitstore.demo",
      role: "manager",
      pin: "234567",
    },
    {
      id: id(),
      name: "Camila López",
      email: "vendedor@fitstore.demo",
      role: "seller",
      pin: "345678",
    },
    {
      id: id(),
      name: "Daniel Pérez",
      email: "almacen@fitstore.demo",
      role: "warehouse",
      pin: "456789",
    },
  ];
  const passwordHash = await hash(password, 12);
  const userRows = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleId: roleIds[u.role],
      passwordHash,
      pinHash: await hash(u.pin, 12),
    })),
  );
  const customers = [
    "Lucía Méndez",
    "Sofía Martínez",
    "Gabriela Castillo",
    "Paola Fernández",
    "Daniela Pérez",
    "Isabella Cruz",
    "María Jiménez",
    "Valentina Ramos",
    "Laura Santana",
    "Camila Reyes",
    "Adriana Torres",
    "Alejandra Molina",
    "Natalia Rodríguez",
    "Carolina Vargas",
    "Elena Díaz",
    "Sara Núñez",
    "Patricia Álvarez",
    "Rosa Batista",
    "Ana Herrera",
    "Mónica Peña",
  ].map((name, index) => ({
    id: id(),
    name,
    phone: "1809555" + String(index).padStart(4, "0"),
    email: "cliente" + index + "@example.test",
    legalId: "DEMO-" + String(index).padStart(4, "0"),
  }));
  const products: any[] = [],
    variants: any[] = [],
    lots: any[] = [],
    saleRows: any[] = [],
    saleItems: any[] = [],
    paymentRows: any[] = [],
    movements: any[] = [];
  const initialDate = ago(190);
  let index = 0;
  for (let c = 0; c < 5; c++)
    for (let n = 0; n < 12; n++) {
      const productId = id(),
        sku = "FIT-" + String(++index).padStart(4, "0"),
        cost =
          c === 0
            ? 900 + n * 50
            : c === 1
              ? 450 + n * 25
              : c === 2
                ? 600 + n * 35
                : c === 3
                  ? 160 + n * 20
                  : 250 + n * 25,
        price = Math.round((cost * 1.8) / 50) * 50;
      const attrs =
        c === 0
          ? ["Chocolate", "Vainilla"].map((sabor) => ({
              sabor,
              tamaño: "2 lb",
            }))
          : c === 1 || c === 2
            ? ["S", "M", "L"].flatMap((talla) =>
                ["Negro", "Azul"].map((color) => ({ talla, color })),
              )
            : c === 4
              ? ["Natural", "Warm", "Honey"].map((tono) => ({ tono }))
              : ["Lila", "Rosa"].map((color) => ({ color }));
      const image =
        c === 0
          ? "/products/supplements.svg"
          : c === 1
            ? "/products/clothing.svg"
            : c === 2
              ? "/products/shapewear.svg"
              : c === 3
                ? "/products/accessories.svg"
                : "/products/makeup.svg";
      products.push({
        id: productId,
        name: names[c][n],
        sku,
        categoryId: categoryIds[c],
        brand:
          c === 0
            ? "NutriLab"
            : c === 1
              ? "Motion Club"
              : c === 4
                ? "Bloom Beauty"
                : "FitStore",
        supplierId: supplierIds[c % 3],
        imageUrl: image,
        description: "Producto de demostración. " + names[c][n],
        minStock: 5,
        maxStock: 80,
        taxRate: 18,
        createdAt: initialDate,
        createdBy: users[0].id,
      });
      for (const [a, attributes] of attrs.entries())
        variants.push({
          id: id(),
          productId,
          sku: sku + "-" + (a + 1),
          barcode: ean(index * 100 + a),
          attributes,
          costAvg: cost,
          price,
          stock: index % 9 === 0 ? 3 : 12 + ((index + a) % 18),
          createdAt: initialDate,
          createdBy: users[0].id,
          category: c,
          index,
        });
    }
  const sold = new Map<string, number>();
  let saleNumber = 0;
  let state = 4219;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const selling = variants.filter((v) => v.index < 53 && v.index !== 12); // Candidatos sin movimiento intencionales.
  for (let day = 179; day >= 0; day--) {
    const daily = 3 + Math.floor(random() * 5);
    for (let s = 0; s < daily; s++) {
      const saleId = id(),
        createdAt = ago(day);
      createdAt.setUTCHours(
        14 + Math.floor(random() * 9),
        Math.floor(random() * 60),
        0,
        0,
      );
      if (createdAt > new Date()) continue;
      const chosen = [
        selling[Math.floor(random() * selling.length)],
        selling[Math.floor(random() * selling.length)],
      ];
      let total = d(0),
        tax = d(0),
        cost = d(0),
        subtotal = d(0);
      for (const variant of chosen) {
        const qty = random() > 0.85 ? 2 : 1,
          totals = lineTotals(qty, variant.price, 0, 18, true);
        saleItems.push({
          id: id(),
          saleId,
          variantId: variant.id,
          qty,
          unitPrice: variant.price,
          unitCost: variant.costAvg,
          discount: 0,
          tax: totals.tax,
          lineTotal: totals.total,
          stockAllocations: [],
        });
        total = total.plus(totals.total);
        tax = tax.plus(totals.tax);
        subtotal = subtotal.plus(totals.subtotal);
        cost = cost.plus(d(qty).times(variant.costAvg));
        sold.set(variant.id, (sold.get(variant.id) || 0) + qty);
      }
      const number = "FS-" + String(++saleNumber).padStart(7, "0");
      saleRows.push({
        id: saleId,
        number,
        offlineUuid: id(),
        sellerId: users[s % 3].id,
        customerId: customers[Math.floor(random() * customers.length)].id,
        total: money(total),
        taxTotal: money(tax),
        costTotal: money(cost),
        subtotal: money(subtotal),
        discountTotal: 0,
        createdAt,
      });
      const method =
        random() < 0.5 ? "cash" : random() < 0.7 ? "card" : "transfer";
      paymentRows.push({
        id: id(),
        saleId,
        method,
        amount: money(total),
        tendered: money(total),
        feeAmount: method === "card" ? money(total.times(0.025)) : 0,
        status: "ok",
        ...(method === "card"
          ? {
              cardLast4: "4242",
              approvalCode: "DEMO-" + saleNumber,
              cardBrand: "Visa",
              cardType: "credit",
            }
          : method === "transfer"
            ? { bank: "Banco de demostración", reference: "DEMO-" + saleNumber }
            : {}),
      });
    }
  }
  const lotMap = new Map<string, string>();
  for (const variant of variants) {
    const consumed = sold.get(variant.id) || 0,
      opening = variant.stock + consumed;
    movements.push({
      id: id(),
      variantId: variant.id,
      type: "opening",
      qty: opening,
      unitCost: variant.costAvg,
      balanceAfter: opening,
      reason: "Inventario inicial de demostración",
      userId: users[0].id,
      createdAt: initialDate,
    });
    if (variant.category === 0 || variant.category === 4) {
      const firstId = id(),
        secondId = id();
      lotMap.set(variant.id, firstId);
      lots.push(
        {
          id: firstId,
          variantId: variant.id,
          lotNumber: "LT-" + variant.index + "-A",
          expiryDate: future(
            variant.index === 12 ? 45 : 45 + (variant.index % 4) * 40,
          ),
          qty: Math.ceil(variant.stock / 2),
          cost: variant.costAvg,
          createdAt: initialDate,
        },
        {
          id: secondId,
          variantId: variant.id,
          lotNumber: "LT-" + variant.index + "-B",
          expiryDate: future(220),
          qty: Math.floor(variant.stock / 2),
          cost: variant.costAvg,
          createdAt: initialDate,
        },
      );
    }
  }
  const balances = new Map(
    variants.map((v) => [v.id, v.stock + (sold.get(v.id) || 0)]),
  );
  const saleDate = new Map(saleRows.map((s) => [s.id, s.createdAt]));
  for (const item of saleItems) {
    item.lotId = lotMap.get(item.variantId);
    item.stockAllocations = [
      {
        variantId: item.variantId,
        lotId: item.lotId,
        qty: item.qty,
        unitCost: item.unitCost,
      },
    ].map(({ lotId, ...a }) => (lotId ? { ...a, lotId } : a));
    const balance = balances.get(item.variantId)! - item.qty;
    balances.set(item.variantId, balance);
    movements.push({
      id: id(),
      variantId: item.variantId,
      lotId: item.lotId,
      type: "sale",
      qty: -item.qty,
      unitCost: item.unitCost,
      balanceAfter: balance,
      refId: item.saleId,
      reason: "Venta histórica de demostración",
      userId: users[2].id,
      createdAt: saleDate.get(item.saleId),
    });
  }
  await db.$transaction(
    async (tx) => {
      await tx.role.createMany({
        data: Object.keys(permissions).map((name) => ({
          id: roleIds[name],
          name,
          permissions: permissions[name],
        })),
      });
      await tx.user.createMany({ data: userRows });
      await tx.category.createMany({
        data: categoryNames.map((name, c) => ({
          id: categoryIds[c],
          name,
          color: colors[c],
          requiresLot: c === 0 || c === 4,
          requiresExpiry: c === 0 || c === 4,
          attributes:
            c === 0
              ? ["sabor", "tamaño"]
              : c === 1 || c === 2
                ? ["talla", "color"]
                : c === 4
                  ? ["tono"]
                  : ["color"],
        })),
      });
      await tx.brand.createMany({
        data: ["FitStore", "NutriLab", "Motion Club", "Bloom Beauty"].map(
          (name) => ({ name }),
        ),
      });
      await tx.supplier.createMany({
        data: [
          "NutriLab Distribuciones",
          "Motion Active Wholesale",
          "Bloom Cosmetics RD",
        ].map((name, i) => ({
          id: supplierIds[i],
          name,
          legalId: "DEMO-S" + i,
          phone: "18095550" + i + "00",
          email: "proveedor" + i + "@example.test",
          leadTimeDays: 7 + i * 3,
        })),
      });
      await tx.customer.createMany({ data: customers });
      await tx.product.createMany({ data: products });
      await tx.variant.createMany({
        data: variants.map(({ category, index, ...variant }) => {
          void category;
          void index;
          return variant;
        }),
      });
      await tx.lot.createMany({
        data: lots.map((lot) => ({
          ...lot,
          lotNumberNormalized: lot.lotNumber
            .normalize("NFC")
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase(),
        })),
      });
      await tx.sale.createMany({ data: saleRows });
      await tx.saleItem.createMany({ data: saleItems });
      await tx.payment.createMany({ data: paymentRows });
      await tx.inventoryMovement.createMany({ data: movements });
      await tx.counter.create({
        data: { key: "sale:main", value: saleNumber },
      });
      const expenses = [
        { name: "Alquiler", budget: 25000 },
        { name: "Electricidad", budget: 8000 },
        { name: "Publicidad", budget: 6000 },
        { name: "Nómina", budget: 30000 },
        { name: "Transporte", budget: 5000 },
        { name: "Internet", budget: 2500 },
        { name: "Empaques", budget: 3000 },
        { name: "Otros", budget: 10000 },
      ];
      for (const [i, e] of expenses.entries()) {
        const category = await tx.expenseCategory.create({
          data: { name: e.name, monthlyBudget: e.budget },
        });
        await tx.expense.createMany({
          data: Array.from({ length: 6 }, (_, month) => {
            const date = new Date();
            date.setMonth(date.getMonth() - month, 2);
            date.setHours(12, 0, 0, 0);
            return {
              categoryId: category.id,
              description: e.name + " · Demostración",
              amount: e.budget * (i === 2 ? 0.88 : 0.65),
              method: "transfer",
              date,
              recurring: true,
              createdBy: users[0].id,
            };
          }),
        });
      }
      await tx.settings.create({
        data: {
          id: "main",
          data: {
            name: "Nexora POS",
            legalId: "",
            address: "",
            phone: "",
            currency: "DOP",
            taxIncluded: true,
            sellerDiscountLimit: 10,
            cardFeePercent: 2.5,
            returnDays: 30,
            idleDays: 60,
            expiryDays: 60,
            lowMargin: 15,
            cashDifferenceLimit: 100,
            receiptWidth: "80",
            sessionTimeoutMinutes: 30,
            branchName: "",
            // Todas las ventas deben quedar asociadas a un cliente.
            requireCustomer: true,
            // Se conserva la configuración del flujo de ventas offline.
            allowOfflineSales: true,
          },
        },
      });
      await tx.alertRule.createMany({
        data: [
          "low_stock",
          "out_of_stock",
          "overstock",
          "no_movement",
          "expiring",
          "expired",
          "expense_budget",
          "low_margin",
          "cash_difference",
        ].map((type) => ({ type, threshold: {} })),
      });
      const poId = id();
      await tx.purchaseOrder.create({
        data: {
          id: poId,
          number: "OC-000001",
          supplierId: supplierIds[0],
          total: 5400,
          items: {
            create: [{ variantId: variants[0].id, qty: 6, unitCost: 900 }],
          },
          createdBy: users[0].id,
        },
      });
      await tx.counter.create({ data: { key: "purchase", value: 1 } });
    },
    { timeout: 60000 },
  );
  console.log(
    `Seed listo: ${products.length} productos, ${variants.length} variantes, 4 usuarios, 3 proveedores y ${saleRows.length} ventas en 6 meses.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
