import React from 'react';

export function SectionHeader(): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Voice Agent Platform</h1>
        <p style={{ margin: 0, color: "rgba(226,232,240,0.65)" }}>
          Design, test, and analyze agent-based voice workflows
        </p>
      </div>
      <div className="tabs">
        <button className="tab active">Design</button>
        <button className="tab">Test</button>
        <button className="tab">Analytics</button>
      </div>
    </div>
  );
}










