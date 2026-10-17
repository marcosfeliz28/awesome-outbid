// Ejecuta el componente real y sus onClick sin navegador. El servidor falso
// acepta la consulta únicamente si dateRange real de la API la valida.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateRange } from "../apps/api/src/reports";
import { DayReports } from "../apps/web/src/Tienda";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  api: vi.fn(),
  toast: vi.fn(),
  day: new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  }),
  user: { id: "admin", permissions: ["*"], branchId: "main" },
}));
vi.mock("../apps/web/node_modules/react", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useState: () => [fixture.states[fixture.cursor++], vi.fn()],
}));
vi.mock("../apps/web/node_modules/@tanstack/react-query", () => ({
  useQuery: () => ({ data: [{ id: "cashier", name: "Cajera de prueba" }] }),
  useQueryClient: vi.fn(),
}));
vi.mock("../apps/web/src/api", () => ({
  api: fixture.api,
  apiBlob: vi.fn(),
  post: vi.fn(),
  localDB: {},
  useStore: (selector: (state: { user: typeof fixture.user }) => unknown) =>
    selector({ user: fixture.user }),
}));
vi.mock("../apps/web/src/helpers", () => ({
  FormModal: () => null,
  QueryState: () => null,
  toast: fixture.toast,
  mutate: vi.fn(),
  today: () => fixture.day,
}));

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== "object") return [];
  return [element, ...nodes(element.props?.children)];
}
function text(element: any): string {
  if (Array.isArray(element)) return element.map(text).join("");
  if (typeof element === "string") return element;
  return element?.props ? text(element.props.children) : "";
}

beforeEach(() => {
  fixture.api.mockReset();
  fixture.toast.mockClear();
  fixture.cursor = 0;
});

describe("3ag · contrato de impresión de reportes diarios", () => {
  for (const [kind, endpoint, label] of [
    ["daily", "venta-diaria-usuario", "Venta diaria del día"],
    ["method", "venta-por-forma-pago", "Por forma de pago del día"],
  ] as const) {
    it.each(["", "c84ed8d8-fb39-4577-a324-7d5cf8ee8142"])(
      `${kind} imprime el día entero de RD y conserva el filtro de usuario %j`,
      async (userId) => {
        fixture.states = [fixture.day, userId];
        const start = new Date(fixture.day + "T00:00:00-04:00");
        const end = new Date(+start + 86400000 - 1);
        const report = { title: kind, total: 118 };
        fixture.api.mockImplementation(async (path: string) => {
          const url = new URL(path, "https://app.example.invalid");
          expect(url.pathname).toBe("/reports/" + endpoint);
          const query = Object.fromEntries(url.searchParams);
          const range = dateRange(query);
          expect(range.gte.toISOString()).toBe(start.toISOString());
          expect(range.lte.toISOString()).toBe(end.toISOString());
          expect(query.userId).toBe(userId || undefined);
          return report;
        });
        const onPrint = vi.fn();
        const component = DayReports({ onPrint });
        const button = nodes(component).find(
          (node) =>
            typeof node.props?.onClick === "function" && text(node) === label,
        );
        expect(button, `Botón ${label}`).toBeDefined();
        await button.props.onClick();
        expect(fixture.toast.mock.calls).toEqual([]);
        expect(fixture.api).toHaveBeenCalledTimes(1);
        expect(onPrint).toHaveBeenCalledExactlyOnceWith({ kind, data: report });
      },
    );
  }
});
