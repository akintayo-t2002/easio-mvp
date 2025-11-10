import React, { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
};

export function Panel({ title, children }: PanelProps): React.JSX.Element {
  return (
    <section className="inspector">
      <h3>{title}</h3>
      {children}
    </section>
  );
}










