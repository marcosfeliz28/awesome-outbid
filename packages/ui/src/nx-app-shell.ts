// Regiones de la app con etiquetas en español y enlace para saltar al contenido.
export function regionesApp() {
  return {
    banner: { role: "banner", "aria-label": "Encabezado" },
    navegacion: { role: "navigation", "aria-label": "Navegación principal" },
    principal: {
      role: "main",
      "aria-label": "Contenido principal",
      id: "contenido",
    },
    saltar: { href: "#contenido", texto: "Saltar al contenido" },
  };
}
