import { Handle, Position, NodeProps } from '@xyflow/react';
import AgentNode from '../agent-node';
import React from 'react';

export const AgentNodeWrapper: React.FC<NodeProps> = ({ data, selected }) => {
	return (
		<>
			<Handle
				type="target"
				position={Position.Left}
			/>
			<AgentNode
				data={data}
				selected={selected}
			/>
			<Handle
				type="source"
				position={Position.Right}
			/>
		</>
	);
};
