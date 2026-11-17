import {
  Boxes,
  ChartNoAxesCombined,
  ChevronRight,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { can } from "@fitstore/shared";
import { t } from "./inicioLanguage";

/** Same destination/permission pairs as the existing navigation. No writes. */
export const overviewShortcuts = [
  {
    page: "pos",
    label: "Punto de venta",
    permission: "sale:write",
    icon: ShoppingBag,
  },
  {
    page: "inventory",
    label: "Inventario",
    permission: "inventory:write",
    icon: Boxes,
  },
  {
    page: "reports",
    label: "Reportes",
    permission: "reports:read",
    icon: ChartNoAxesCombined,
  },
] as const;
export function QuickAccessOverview({
  permissions,
  go,
}: {
  permissions: string[];
  go: (page: string) => void;
}) {
  const visible = overviewShortcuts.filter((item) =>
    can(permissions, item.permission),
  );
  if (!visible.length) return null;
  return (
    <section
      className="panel fi-quick-access"
      aria-label={t("Accesos rápidos")}
    >
      <div className="panel-heading">
        <div>
          <h2>
            <span className="fi-section-emblem" aria-hidden="true">
              <Zap />
            </span>
            {t("Accesos rápidos")}
          </h2>
          <p>{t("Tus herramientas, a un clic.")}</p>
        </div>
      </div>
      <div className="fi-shortcuts">
        {visible.map(({ page, label, icon: Icon }) => (
          <button
            type="button"
            key={page}
            className="fi-shortcut"
            onClick={() => go(page)}
          >
            <span className="fi-shortcut-icon" aria-hidden="true">
              <Icon />
            </span>
            <span>{t(label)}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
