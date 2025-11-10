import React, { useMemo, useCallback } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  NodeTypes,
  Connection,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { AgentNodeWrapper } from "../components/nodes/AgentNodeWrapper";
import { StartNodeWrapper } from "../components/nodes/StartNodeWrapper";

interface WorkflowCanvasProps {
  nodes: any[];
  edges: any[];
  onNodesChange: any;
  onEdgesChange: any;
  onNodeClick: (event: React.MouseEvent, node: any) => void;
  onPaneClick: () => void;
  onConnect: (connection: Connection) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
  onConnect,
}: WorkflowCanvasProps): React.JSX.Element {
  const nodeTypes: NodeTypes = useMemo(() => ({
    start: StartNodeWrapper,
    agent: AgentNodeWrapper,
  }), []);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const handlePaneClick = useCallback(() => {
    onPaneClick();
  }, [onPaneClick]);

  return (
    <div className="relative z-0 h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={handlePaneClick}
        onConnect={onConnect}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        panOnScroll
        zoomOnScroll
        minZoom={0.5}
        maxZoom={1.5}
        style={{ width: "100%", height: "100%" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#e5e7eb" />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
