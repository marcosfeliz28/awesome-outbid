import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  PASSWORD_CHANGE_CONFIRMATION,
  passwordChangeUsernames,
  requirePasswordChange,
} from "../src/require-password-change";

config({ path: "../../.env", quiet: true });
const db = new PrismaClient();

async function main() {
  if (process.env.PASSWORD_CHANGE_CONFIRM !== PASSWORD_CHANGE_CONFIRMATION)
    throw new Error(
      "Confirma la operación con PASSWORD_CHANGE_CONFIRM=ROTATE_TEMPORARY_PASSWORDS.",
    );
  const changedCount = await requirePasswordChange(
    db,
    passwordChangeUsernames(process.env.PASSWORD_CHANGE_USERNAMES),
  );
  console.log(
    `${changedCount} cuenta(s) quedaron marcadas para cambiar su contraseña.`,
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Operación fallida.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
