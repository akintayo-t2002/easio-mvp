import { Handle, Position, NodeProps } from '@xyflow/react'
import StartNode from '../start-node'

export function StartNodeWrapper({ data, selected }: NodeProps) {
  return (
    <>
      <StartNode data={data} selected={selected} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}









