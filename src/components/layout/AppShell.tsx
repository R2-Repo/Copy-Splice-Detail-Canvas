import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1>{title}</h1>
      </header>
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
