import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Last line of defence: a render crash anywhere below shows a friendly
 * recovery screen instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash-screen" role="alert">
        <div>
          <span className="crash-screen__icon" aria-hidden="true">
            <TriangleAlert size={30} />
          </span>
          <h1>Algo ha fallado</h1>
          <p>
            Ha ocurrido un error inesperado. Recarga la página para volver al mapa; si se repite,
            inténtalo de nuevo en unos minutos.
          </p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </button>
        </div>
      </main>
    );
  }
}
