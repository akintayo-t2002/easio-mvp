import { Handle, Position, NodeProps } from '@xyflow/react'
import AgentNode from '../agent-node'

export function AgentNodeWrapper({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <AgentNode data={data} selected={selected} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}









