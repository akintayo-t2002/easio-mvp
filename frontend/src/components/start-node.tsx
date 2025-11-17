import React from 'react';

import { Play } from 'lucide-react';

type StartNodeProps = {
  data: any;
  selected: any;
};

const StartNode: React.FC<StartNodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`px-4 py-2 rounded-full bg-success text-white font-semibold flex items-center gap-2 shadow-lg transition-all whitespace-nowrap ${
        selected ? 'ring-2 ring-accent ring-offset-2' : ''
      }`}
    >
      <Play className="w-4 h-4" />
      {data.label}
    </div>
  );
};

export default StartNode;
