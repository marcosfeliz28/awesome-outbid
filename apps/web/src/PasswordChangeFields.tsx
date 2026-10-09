import { passwordRules } from "./passwordChange";
import "./passwordChange.css";

type Props = {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
};
export function PasswordChangeFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
}: Props) {
  const rules = passwordRules(password);
  const complete = rules.filter((rule) => rule.met).length;
  const strength =
    complete === 5
      ? "Cumple las reglas"
      : complete >= 3
        ? "Casi lista"
        : "Necesita más seguridad";
  return (
    <div className="password-change-fields">
      <p>
        Este paso es obligatorio antes de entrar a la tienda. Crea una clave
        personal; no la compartas.
      </p>
      <label className="field">
        <span>Nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          required
          minLength={12}
          maxLength={128}
          aria-describedby="password-rules password-strength"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
        />
      </label>
      <div id="password-strength" role="status" aria-live="polite">
        Fortaleza: {password ? strength : "Escribe tu nueva contraseña"} (
        {complete}/5 reglas)
      </div>
      <ul id="password-rules" className="password-rules">
        {rules.map((rule) => (
          <li key={rule.label}>
            <span aria-hidden="true">{rule.met ? "✓" : "○"}</span> {rule.label}
            <span className="password-rule-result">
              {" "}
              — {rule.met ? "Cumplida" : "Pendiente"}
            </span>
          </li>
        ))}
      </ul>
      <small>
        Usa las teclas de mayúsculas y números/símbolos del teclado. No uses
        solo un PIN. Si la clave es demasiado larga, acórtala.
      </small>
      <label className="field">
        <span>Confirma la nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          required
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
        />
      </label>
    </div>
  );
}
