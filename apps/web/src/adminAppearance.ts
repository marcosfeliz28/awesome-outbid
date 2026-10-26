import { useLayoutEffect, useState } from "react";

const STORAGE_KEY = "nexora-admin-contrast";

// Presentación únicamente: no interviene en permisos ni en la sesión.
export function useAdminAppearance(
  role: string | undefined,
  page: string,
  product: boolean,
) {
  const active =
    product &&
    (role === "admin" || role === "manager") &&
    page.split("?")[0] !== "pos";
  const [contrast, setContrast] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "high";
    } catch {
      return false;
    }
  });
  useLayoutEffect(() => {
    if (!active) return;
    document.documentElement.dataset.adminAppearance = contrast
      ? "contrast"
      : "obsidian";
    return () => {
      delete document.documentElement.dataset.adminAppearance;
    };
  }, [active, contrast]);
  const toggleContrast = () => {
    const next = !contrast;
    setContrast(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "high" : "standard");
    } catch {
      // El modo sigue funcionando aunque el navegador no permita persistirlo.
    }
  };
  return { active, contrast, toggleContrast };
}
