import React, { useState } from "react";

import { Panel } from "../components/Panel";
import { TextAreaField, TextField } from "../components/Field";

const paths = [
  { name: "Customer Support", description: "General inquiries and routing" },
  { name: "Billing", description: "Invoices, refunds, payment issues" },
  { name: "Appointments", description: "Scheduling and follow-ups" },
];

export function WorkflowSidebar(): React.JSX.Element {
  const [activeNode, setActiveNode] = useState<string>("orchestrator");

  return (
    <div>
      <section>
        <h2>Agents</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {[
            { id: "orchestrator", label: "Orchestrator", description: "Understands intent and routes" },
            { id: "billing", label: "Billing Specialist", description: "Handles invoices, payments" },
            { id: "support", label: "Support Specialist", description: "Product and technical support" },
            { id: "scheduling", label: "Scheduling Specialist", description: "Manages appointments" },
          ].map((node) => (
            <button
              key={node.id}
              onClick={() => setActiveNode(node.id)}
              className={"button"}
              style={{
                justifyContent: "flex-start",
                padding: "0.8rem 1rem",
                background: activeNode === node.id ? "rgba(59, 130, 246, 0.25)" : "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                color: "#e2e8f0",
                boxShadow: activeNode === node.id ? "0 8px 20px rgba(59,130,246,0.25)" : "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{node.label}</div>
                <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{node.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <Panel title="Active Agent">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <TextField label="Agent Name" value="Intake Orchestrator" />
          <TextAreaField
            label="Instructions"
            value="Understand caller intent. Collect required information. Route to the correct specialist based on configured paths."
          />
          <PathList label="Configured Paths" paths={paths} />
        </div>
      </Panel>
    </div>
  );
}

type Path = {
  name: string;
  description: string;
};

type PathListProps = {
  label: string;
  paths: Path[];
};

function PathList({ label, paths }: PathListProps): React.JSX.Element {
  return (
    <div>
      <label>{label}</label>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        {paths.map((path) => (
          <li
            key={path.name}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{path.name}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{path.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

