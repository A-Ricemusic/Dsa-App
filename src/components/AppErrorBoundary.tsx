import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-6 text-ink">
        <section role="alert" className="max-w-md py-8 text-center">
          <h1 className="text-3xl">Your journal couldn’t load.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Try reloading to reconnect and open your journal.
          </p>
          <button className="button-primary mt-6" onClick={() => window.location.reload()}>
            Reload journal
          </button>
        </section>
      </main>
    );
  }
}
