/* global document, localStorage */
// Idioma de la portada. La elección se guarda solo en este navegador.
(function () {
  var textos = document.querySelectorAll("[data-es][data-en]");
  function aplicar(idioma) {
    document.documentElement.lang = idioma;
    textos.forEach(function (el) {
      el.textContent = el.getAttribute("data-" + idioma);
    });
    document.querySelectorAll("[data-aria-es][data-aria-en]").forEach(function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-aria-" + idioma));
    });
    document.querySelectorAll("[data-idioma]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-idioma") === idioma));
    });
  }
  document.querySelectorAll("[data-idioma]").forEach(function (b) {
    b.addEventListener("click", function () {
      var idioma = b.getAttribute("data-idioma");
      try {
        localStorage.setItem("norexos-idioma", idioma);
      } catch {
        /* sin almacenamiento: solo cambia en esta carga */
      }
      aplicar(idioma);
    });
  });
  var guardado = null;
  try {
    guardado = localStorage.getItem("norexos-idioma");
  } catch {
    guardado = null;
  }
  if (guardado === "en" || guardado === "es") aplicar(guardado);
})();
