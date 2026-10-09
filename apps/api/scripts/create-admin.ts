import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { permissions, categories } from "@fitstore/shared";
config({ path: "../../.env", quiet: true });
const db = new PrismaClient();
async function main() {
  const input = z
    .object({
      email: z.string().email(),
      password: z
        .string()
        .min(12)
        .max(128)
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
      pin: z.string().regex(/^\d{4,6}$/),
      name: z.string().min(2).max(100).optional(),
      mode: z.enum(["bootstrap", "repair"]).default("bootstrap"),
    })
    .parse({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      pin: process.env.ADMIN_PIN,
      name: process.env.ADMIN_NAME || undefined,
      mode: process.env.ADMIN_MODE,
    });
  const email = input.email.toLowerCase();
  await db.$transaction(async (tx) => {
    if (input.mode === "bootstrap")
      for (const [name, grants] of Object.entries(permissions))
        await tx.role.upsert({
          where: { name },
          create: { name, permissions: grants },
          update: {},
        });
    const role = await tx.role.findUnique({ where: { name: "admin" } });
    if (!role) throw new Error("No existe el rol administrador.");
    const matches = await tx.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      take: 2,
    });
    if (matches.length > 1)
      throw new Error("Hay más de una cuenta con el correo administrador.");
    let existing = matches[0];
    if (existing) {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${existing.id}::uuid FOR UPDATE`;
      existing = await tx.user.findUniqueOrThrow({
        where: { id: existing.id },
      });
    }
    if (existing) {
      if (input.mode === "repair" && existing.roleId !== role.id)
        throw new Error("La cuenta indicada no es administradora.");
      const [passwordMatches, pinMatches] = await Promise.all([
        compare(input.password, existing.passwordHash),
        compare(input.pin, existing.pinHash),
      ]);
      const hasAuthAttempts =
        (await tx.authAttempt.count({
          where: { key: { startsWith: `login:${existing.id}:` } },
        })) > 0;
      const needsUpdate =
        existing.email !== email ||
        (input.name !== undefined && existing.name !== input.name) ||
        existing.roleId !== role.id ||
        !existing.active ||
        existing.failedAttempts !== 0 ||
        existing.lockedUntil !== null ||
        !passwordMatches ||
        !pinMatches ||
        hasAuthAttempts;
      if (needsUpdate) {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            email,
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(!passwordMatches
              ? { passwordHash: await hash(input.password, 12) }
              : {}),
            ...(!pinMatches ? { pinHash: await hash(input.pin, 12) } : {}),
            roleId: role.id,
            active: true,
            failedAttempts: 0,
            lockedUntil: null,
            authVersion: { increment: 1 },
          },
        });
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.authSession.deleteMany({ where: { userId: user.id } });
        await tx.authAttempt.deleteMany({
          where: { key: { startsWith: `login:${user.id}:` } },
        });
        await tx.auditLog.create({
          data: {
            userId:
              input.mode === "repair" ? "system:recovery" : "system:installer",
            action:
              input.mode === "repair"
                ? "admin_credentials_repaired"
                : "admin_bootstrap_synchronized",
            entity: "user",
            entityId: user.id,
            before: {
              email: existing.email,
              active: existing.active,
              roleId: existing.roleId,
              authVersion: existing.authVersion,
            },
            after: {
              email: user.email,
              active: user.active,
              roleId: user.roleId,
              authVersion: user.authVersion,
            },
            branchId: user.branchId,
          },
        });
      }
    } else {
      if (input.mode === "repair")
        throw new Error("No existe una cuenta propietaria con ese correo.");
      if ((await tx.user.count()) > 0)
        throw new Error(
          "La base ya contiene usuarios y no se puede crear otro propietario.",
        );
      const user = await tx.user.create({
        data: {
          name: input.name || "Administrador",
          email,
          passwordHash: await hash(input.password, 12),
          pinHash: await hash(input.pin, 12),
          roleId: role.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: "system:installer",
          action: "admin_bootstrap_created",
          entity: "user",
          entityId: user.id,
          after: {
            email: user.email,
            active: user.active,
            roleId: user.roleId,
            authVersion: user.authVersion,
          },
          branchId: user.branchId,
        },
      });
    }
    if (input.mode === "bootstrap")
      await tx.settings.upsert({
        where: { id: "main" },
        create: {
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
            requireCustomer: true,
          },
        },
        update: {},
      });
    if (input.mode === "bootstrap")
      for (const [index, name] of categories.entries())
        await tx.category.upsert({
          where: { name },
          create: {
            name,
            requiresLot: index === 0 || index === 4,
            requiresExpiry: index === 0 || index === 4,
            color: ["#7C3AED", "#0EA5E9", "#EC4899", "#F97316", "#E11D48"][
              index
            ],
          },
          update: {},
        });
    if (input.mode === "bootstrap")
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
  const verified = await db.user.findUnique({
    where: { email },
    include: { role: true },
  });
  if (
    !verified?.active ||
    verified.role.name !== "admin" ||
    !(await compare(input.password, verified.passwordHash)) ||
    !(await compare(input.pin, verified.pinHash))
  )
    throw new Error("No se pudo verificar la cuenta administradora.");
  console.log("Administrador creado o sincronizado correctamente.");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
