import { Children, type ReactNode } from "react";
import { ShoppingBag, Coins, UsersRound } from "lucide-react";
import { usePremiumWorkspace } from "./PremiumWorkspace";
import "./operationsPresentation.css";

/** Only layout and materials. The caller retains queries, permissions and dialogs. */
export function OperationsPresentation({ area, children }: {
  area: "purchases" | "expenses" | "customers";
  children: ReactNode;
}) {
  usePremiumWorkspace();
  const [heading, ...content] = Children.toArray(children);
  const Icon = { purchases: ShoppingBag, expenses: Coins, customers: UsersRound }[area];
  return (
    <section className={`norexos-premium-workspace operations-premium operations-${area}`}>
      <div className="operations-premium-heading">
        <div className="operations-premium-emblem" aria-hidden="true"><Icon size={36} strokeWidth={1.5} /></div>
        {heading}
      </div>
      <div className="operations-premium-content">{content}</div>
    </section>
  );
}
