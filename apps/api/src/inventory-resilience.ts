import { businessDate } from "@fitstore/shared";
import { HttpException } from "@nestjs/common";

/** Código canónico para identificar un lote sin depender de mayúsculas o espacios. */
export function normalizeLotNumber(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * La identidad física del lote es su código dentro de una variante. El
 * vencimiento se valida aparte: puede completar un dato antes ausente, pero no
 * crear otro lote con el mismo código.
 */
export function lotIdentity(
  lotNumber: string,
  expiryDate?: string | Date | null,
) {
  const normalized = normalizeLotNumber(lotNumber);
  const expiry = expiryDate ? new Date(expiryDate) : null;
  return {
    lotNumber: normalized,
    lotNumberNormalized: normalized,
    expiryDate: expiry,
  };
}

/** Une el vencimiento recibido con el guardado y detecta códigos ambiguos. */
export function reconcileLotExpiry(
  current: Date | string | null | undefined,
  incoming: Date | string | null | undefined,
) {
  const existing = current ? new Date(current) : null;
  const received = incoming ? new Date(incoming) : null;
  return {
    conflict:
      !!existing &&
      !!received &&
      businessDate(existing) !== businessDate(received),
    expiryDate: existing ?? received,
  };
}

/** Prisma puede envolver SQLSTATE 40001 como P2010 o traducirlo a P2034. */
export function isSerializationConflict(error: any) {
  const detail = String(
    error?.meta?.code ?? error?.meta?.message ?? error?.message ?? "",
  );
  return (
    error?.code === "40001" ||
    error?.code === "P2034" ||
    (error?.code === "P2010" && detail.includes("40001"))
  );
}

/** Cinco intentos como máximo; otros errores nunca se ocultan ni se reintentan. */
export async function retrySerializable<T>(
  operation: () => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt >= maxAttempts)
        throw new HttpException(
          "Otra operación modificó el inventario. Reintenta.",
          409,
          { cause: error },
        );
      // Cede el turno y evita que dos solicitudes vuelvan a chocar en el mismo
      // instante. El jitter evita que una ráfaga completa se resincronice; aun
      // así el plazo total de espera sigue acotado a menos de 150 ms.
      await new Promise((resolve) =>
        setTimeout(resolve, attempt * 10 + Math.floor(Math.random() * 10)),
      );
    }
  }
}
