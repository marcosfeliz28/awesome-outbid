import { Component, type ReactNode } from "react";
import { captureUiError } from "./monitoring";

// EST-03: si una pantalla falla al dibujarse, el menú, el carrito y los avisos
// siguen; solo esa pantalla muestra el mensaje. Cambiar de pantalla la reinicia
// (App la monta con key={page}).
export class PageErrorBoundary extends Component<
  { page: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Solo el nombre de la pantalla: nada de ventas, clientes ni carrito.
    captureUiError(this.props.page);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-panel" role="alert">
        <p>
          <strong>Esta pantalla tuvo un problema.</strong> Tu carrito y tus
          ventas guardadas no se perdieron.
        </p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          Reintentar
        </button>{" "}
        <button
          type="button"
          onClick={() => {
            location.hash = "pos";
            this.setState({ failed: false });
          }}
        >
          Volver a Caja
        </button>
      </div>
    );
  }
}
