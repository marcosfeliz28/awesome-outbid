(() => {
  const result = document.getElementById("service-result");
  const time = document.getElementById("service-time");
  const button = document.getElementById("check-again");
  async function check() {
    button.disabled = true;
    result.textContent = "Comprobando…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("/api/health/ready", { cache: "no-store", credentials: "omit", signal: controller.signal });
      const body = response.ok ? await response.json() : null;
      result.textContent = response.ok && body?.status === "ok"
        ? "Disponible desde este dispositivo"
        : "No se pudo confirmar la disponibilidad desde este dispositivo";
    } catch {
      result.textContent = "No se pudo confirmar la disponibilidad desde este dispositivo";
    } finally {
      clearTimeout(timeout);
      time.textContent = "Última comprobación: " + new Date().toLocaleString("es-DO");
      button.disabled = false;
    }
  }
  button.addEventListener("click", check);
  check();
  setInterval(check, 60000);
})();
