import { Handle, Position, NodeProps } from '@xyflow/react';
import StartNode from '../start-node';
import React from 'react';

export const StartNodeWrapper: React.FC<NodeProps> = ({ data, selected }) => {
	return (
		<>
			<StartNode
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
