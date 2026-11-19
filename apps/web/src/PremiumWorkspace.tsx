import { useEffect, type ReactNode } from "react";
import "./premiumWorkspace.css";
import { useInventoryAppearance } from "./inventoryAppearance";

let owners = 0;
let previousFlag: string | undefined;
/** Visual boundary only. Data, permissions, forms and events stay with their owner. */
export function usePremiumWorkspace() {
  useInventoryAppearance();
  useEffect(() => {
    const root = document.documentElement;
    if (owners === 0) previousFlag = root.dataset.premiumWorkspace;
    owners += 1;
    root.dataset.premiumWorkspace = "true";
    return () => {
      owners -= 1;
      if (owners === 0) {
        if (previousFlag === undefined) delete root.dataset.premiumWorkspace;
        else root.dataset.premiumWorkspace = previousFlag;
      }
    };
  }, []);
}

export function PremiumWorkspace({ children, area }: { children: ReactNode; area: string }) {
  usePremiumWorkspace();
  return <div className="norexos-premium-workspace" data-premium-area={area}>{children}</div>;
}
