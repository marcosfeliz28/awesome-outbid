import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { permissions } from "@fitstore/shared";

const db = new PrismaClient();

function credential() {
  return `Nx-${randomBytes(18).toString("hex")}aA7!`;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.NEXORA_AUDIT_SANDBOX !== "1" ||
    process.env.RENDER_DATABASE_URL ||
    url.hostname !== "db" ||
    url.pathname !== "/nexora_audit" ||
    process.env.NODE_ENV !== "test"
  )
    throw new Error(
      "Seed cancelado: el destino no es la base aislada autorizada.",
    );

  const existing = await db.user.count();
  if (existing) {
    console.log(
      "La base aislada ya tiene usuarios; no se regeneraron credenciales.",
    );
    return;
  }

  const adminRole = await db.role.upsert({
    where: { name: "admin" },
    create: { name: "admin", permissions: permissions.admin },
    update: { permissions: permissions.admin },
  });
  const sellerRole = await db.role.upsert({
    where: { name: "seller" },
    create: { name: "seller", permissions: permissions.seller },
    update: { permissions: permissions.seller },
  });
  const accounts = [
    {
      username: "audit-admin",
      name: "Auditor administrador",
      roleId: adminRole.id,
    },
    {
      username: "audit-cashier",
      name: "Auditor cajero",
      roleId: sellerRole.id,
    },
  ];
  const credentials: string[] = [];
  for (const account of accounts) {
    const password = credential();
    credentials.push(`${account.username}: ${password}`);
    await db.user.create({
      data: {
        username: account.username,
        usernameKey: account.username,
        email: `${account.username}@audit.nexora.invalid`,
        name: account.name,
        passwordHash: await hash(password, 12),
        mustChangePassword: false,
        pinHash: await hash("0000", 12),
        roleId: account.roleId,
        branchId: "main",
      },
    });
  }
  console.log(
    "Credenciales aleatorias de la base local aislada (no reutilizar):",
  );
  for (const line of credentials) console.log(line);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Seed aislado fallido.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
