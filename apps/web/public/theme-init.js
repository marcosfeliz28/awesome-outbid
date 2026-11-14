// MOD-08: pinta el tema antes del primer dibujo. Es un archivo propio porque la
// política de contenido solo admite scripts de este mismo sitio. Debe coincidir
// con apps/web/src/theme.ts (clave, colores y regla).
(function () {
  var theme = "light";
  try {
    var stored = localStorage.getItem("fitstore-theme");
    if (stored === "light" || stored === "dark") theme = stored;
    else if (matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (e) {}
  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", theme === "dark" ? "#0b0f19" : "#7C3AED");
})();
