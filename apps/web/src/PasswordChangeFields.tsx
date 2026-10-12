import {
  isCashierPasswordRole,
  passwordRules,
  type PasswordPolicy,
} from "./passwordChange";
import "./passwordChange.css";

type Props = {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
  intro?: string;
  policy?: PasswordPolicy;
};
export function PasswordChangeFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
  intro = "Este paso es obligatorio antes de entrar a la tienda. Crea una clave personal; no la compartas.",
  policy = "strong",
}: Props) {
  const cashier = isCashierPasswordRole(policy);
  const rules = passwordRules(password, policy);
  const complete = rules.filter((rule) => rule.met).length;
  const strength =
    complete === 5
      ? "Cumple las reglas"
      : complete >= 3
        ? "Casi lista"
        : "Necesita más seguridad";
  return (
    <div className="password-change-fields">
      <p>{intro}</p>
      <label className="field">
        <span>Nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          inputMode={cashier ? "numeric" : "text"}
          required
          minLength={cashier ? 6 : 12}
          maxLength={cashier ? 6 : 128}
          pattern={cashier ? "[0-9]{6}" : undefined}
          title={cashier ? "Escribe exactamente 6 números." : undefined}
          aria-describedby={
            cashier
              ? "password-rules cashier-password-guidance"
              : "password-rules password-strength"
          }
          value={password}
          onChange={(event) => onPassword(event.target.value)}
        />
      </label>
      {!cashier && (
        <div id="password-strength" role="status" aria-live="polite">
          Fortaleza: {password ? strength : "Escribe tu nueva contraseña"} (
          {complete}/5 reglas)
        </div>
      )}
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
      <small id={cashier ? "cashier-password-guidance" : undefined}>
        {cashier
          ? "Usa exactamente 6 números. Evita secuencias y números repetidos."
          : "Usa las teclas de mayúsculas y números/símbolos del teclado. No uses solo un PIN. Si la clave es demasiado larga, acórtala."}
      </small>
      <label className="field">
        <span>Confirma la nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          inputMode={cashier ? "numeric" : "text"}
          required
          minLength={cashier ? 6 : 12}
          maxLength={cashier ? 6 : 128}
          pattern={cashier ? "[0-9]{6}" : undefined}
          title={cashier ? "Escribe exactamente 6 números." : undefined}
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
        />
      </label>
    </div>
  );
}
