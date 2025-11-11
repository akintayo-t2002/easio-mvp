import React from 'react';

type PanelProps = {
  title: string;
};

export const Panel: React.FC<React.PropsWithChildren<PanelProps>> = ({ title, children }) => {
  return (
    <section className="inspector">
      <h3>{title}</h3>
      {children}
    </section>
  );
};
