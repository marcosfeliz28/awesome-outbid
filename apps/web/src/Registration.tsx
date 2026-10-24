import { useState } from "react";
import { api } from "./api";

const code = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function Registration() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [companyCode, setCompanyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const slug = companyCode.trim().toLowerCase();
    if (!code.test(slug)) { setError("El código usa letras minúsculas, números y guiones (2–63 caracteres)."); return; }
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify({
        businessName, ownerName, email, password, managerPin, businessType, companyCode: slug,
      }) });
      setMessage(result.message);
      setPassword("");
      setManagerPin("");
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError("");
    try {
      const result = await api<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ companyCode: companyCode.trim().toLowerCase(), email }) });
      setMessage(result.message);
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <main className="product-registration">
    <form onSubmit={submit}>
      <a href="/">← Entrar</a>
      <h1>Prueba Nexora POS durante 14 días</h1>
      <p>Crea tu empresa. Confirma el correo antes de entrar y vender.</p>
      <label className="field"><span>Nombre del negocio</span><input required maxLength={120} value={businessName} onChange={e => setBusinessName(e.target.value)} /></label>
      <label className="field"><span>Tu nombre</span><input required maxLength={120} value={ownerName} onChange={e => setOwnerName(e.target.value)} /></label>
      <label className="field"><span>Correo electrónico</span><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="field"><span>Contraseña</span><input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /><small>12 caracteres; incluye mayúscula, minúscula, número y símbolo.</small></label>
      <label className="field"><span>PIN de gerente</span><input required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" value={managerPin} onChange={e => setManagerPin(e.target.value)} /><small>6 números no consecutivos. Lo usarás para autorizaciones; guárdalo en privado.</small></label>
      <label className="field"><span>Tipo de negocio</span><select value={businessType} onChange={e => setBusinessType(e.target.value)}><option value="general">General</option><option value="retail">Tienda</option><option value="beauty">Belleza</option><option value="fitness">Fitness</option><option value="services">Servicios</option></select></label>
      <label className="field"><span>Código de empresa</span><input required autoComplete="organization" placeholder="mi-tienda" value={companyCode} onChange={e => setCompanyCode(e.target.value)} /><small>Lo usarás junto a tu correo para entrar.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="btn primary full-width" disabled={busy}>{busy ? "Procesando…" : "Crear empresa"}</button>
      {message && <button type="button" onClick={resend} disabled={busy}>Reenviar confirmación</button>}
    </form>
  </main>;
}

export function ConfirmEmail() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  const confirm = async () => {
    if (!token) { setError("Falta el enlace de confirmación."); return; }
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
      window.history.replaceState(null, "", "/confirmar-correo");
      setMessage(result.message);
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <main className="product-registration"><section>
    <h1>Confirma tu correo</h1>
    <p>Al confirmar podrás entrar a tu empresa.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!message && <button onClick={confirm} disabled={busy}>{busy ? "Confirmando…" : "Confirmar correo"}</button>}
    <p><a href="/">Ir a iniciar sesión</a></p>
  </section></main>;
}
