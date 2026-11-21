/* global document, window, localStorage, IntersectionObserver */
// Revelado de secciones al hacer scroll (una vez). Sin JavaScript o con movimiento reducido,
// todo el contenido ya es visible.
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var secciones = document.querySelectorAll("main > section:not(.hero)");
  secciones.forEach(function (s) {
    s.classList.add("reveal");
  });
  var observador = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          observador.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  secciones.forEach(function (s) {
    observador.observe(s);
  });
})();
