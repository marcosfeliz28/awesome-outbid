import { useEffect } from "react";
import { useStore } from "./api";

export function readInventoryAppearance(storage: Pick<Storage, "getItem">) {
  try {
    return {
      accent:
        storage.getItem("noxeros-visual-accent") === "blue" ? "blue" : "green",
      black: storage.getItem("noxeros-overview-black") === "true",
    };
  } catch {
    return { accent: "green", black: false };
  }
}

/** Restore visual preferences on direct navigation, without touching business state. */
export function useInventoryAppearance() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const preference = readInventoryAppearance(localStorage);
    document.documentElement.dataset.accent = preference.accent;
    document.documentElement.dataset.overviewSurface =
      theme === "dark" && preference.black ? "black" : "standard";
  }, [theme]);
}
