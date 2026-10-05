import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { permissions, categories } from "@fitstore/shared";
config({ path: "../../.env", quiet: true });
const db = new PrismaClient();
async function main() {
  const input = z
    .object({
      email: z.string().email(),
      password: z.string().min(12),
      pin: z.string().regex(/^\d{4,6}$/),
      name: z.string().min(2),
    })
    .parse({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      pin: process.env.ADMIN_PIN,
      name: process.env.ADMIN_NAME || "Administrador",
    });
  if (await db.user.count())
    throw new Error(
      "Ya hay usuarios. Crea o modifica administradores desde Configuración.",
    );
  await db.$transaction(async (tx) => {
    for (const [name, grants] of Object.entries(permissions))
      await tx.role.upsert({
        where: { name },
        create: { name, permissions: grants },
        update: {},
      });
    const role = await tx.role.findUniqueOrThrow({ where: { name: "admin" } });
    await tx.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await hash(input.password, 12),
        pinHash: await hash(input.pin, 12),
        roleId: role.id,
      },
    });
    await tx.settings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        data: {
          name: "FitStore POS",
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
        },
      },
      update: {},
    });
    for (const [index, name] of categories.entries())
      await tx.category.upsert({
        where: { name },
        create: {
          name,
          requiresLot: index === 0 || index === 4,
          requiresExpiry: index === 0 || index === 4,
          color: ["#7C3AED", "#0EA5E9", "#EC4899", "#F97316", "#E11D48"][index],
        },
        update: {},
      });
    for (const name of [
      "Alquiler",
      "Electricidad",
      "Agua",
      "Internet",
      "Nómina",
      "Publicidad",
      "Transporte",
      "Empaques",
      "Otros",
    ])
      await tx.expenseCategory.upsert({
        where: { name },
        create: { name, monthlyBudget: 0 },
        update: {},
      });
  });
  console.log(
    "Administrador creado. Configura los datos del negocio antes de operar.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
