import { randomUUID } from "node:crypto";

// DIN-01/DIN-02: la API exige operationId en devoluciones y movimientos de caja.
// Las pruebas viejas no lo mandaban; aquí se agrega uno nuevo por envío (mismo
// efecto que antes). Si la prueba pone la clave —aunque sea undefined— se respeta.
const CON_CLAVE = /^\/?(returns|cash-sessions\/[^/]+\/movements)$/;
export function conClave(path: string, data: unknown) {
  if (
    !CON_CLAVE.test(path.split("?")[0]) ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    "operationId" in data
  )
    return data;
  return { ...data, operationId: randomUUID() };
}
