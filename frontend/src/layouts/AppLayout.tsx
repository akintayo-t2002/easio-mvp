import React, { ReactNode } from "react";

type AppLayoutProps = {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppLayout({ header, sidebar, children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">{header}</header>
      <aside className="sidebar">{sidebar}</aside>
      <main className="canvas-area">{children}</main>
    </div>
  );
}










