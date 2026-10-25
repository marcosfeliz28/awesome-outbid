import { randomUUID } from "node:crypto";

// DIN-01/DIN-02: la API exige operationId en devoluciones y movimientos de caja.
// Las pruebas viejas no lo mandaban; aquí se agrega uno nuevo por envío (mismo
// efecto que antes). Si la prueba pone la clave —aunque sea undefined— se respeta.
const CON_CLAVE = /^\/?(returns|cash-sessions\/[^/]+\/movements)$/;
// CPC-2: el cierre con ventas en tarjeta exige el lote del verifón; las pruebas
// viejas no lo mandaban, así que se agrega uno si no lo traen.
const CIERRE = /^\/?cash-sessions\/[^/]+\/close$/;
export function conClave(path: string, data: unknown) {
  if (
    CIERRE.test(path.split("?")[0]) &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    !("batchNumber" in data)
  )
    return { ...data, batchNumber: "QA-LOTE" };
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
