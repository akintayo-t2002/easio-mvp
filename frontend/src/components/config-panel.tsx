import { X, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import type { Agent, Path } from '../types/workflow';
import React from 'react';

interface ConfigPanelProps {
  agent: Agent;
  onEditAgent: () => void;
  onAddPath: () => void;
  onDeletePath: (pathId: string | number) => void;
  paths: Path[];
  onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  agent,
  onEditAgent,
  onAddPath,
  onDeletePath,
  paths,
  onClose,
}) => {
  return (
    <div className="w-96 bg-background border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6">
        <h2 className="font-semibold text-text-primary">Agent Configuration</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-background-secondary rounded transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Agent Name Section */}
        <div className="pb-4 border-b border-border">
          <label className="text-xs font-semibold text-text-secondary uppercase">Agent Name</label>
          <p className="text-text-primary font-semibold mt-2">{agent.name}</p>
        </div>

        {/* Paths Section */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-text-secondary uppercase">
              Paths ({paths.length})
            </label>
            <button
              onClick={onAddPath}
              className="text-text-secondary hover:text-text-primary text-sm font-semibold"
            >
              +
            </button>
          </div>

          <div className="space-y-0">
            {paths.length === 0 ? (
              <p className="text-xs text-text-tertiary py-2">No paths configured</p>
            ) : (
              paths.map((path) => (
                <div
                  key={path.id}
                  className="h-10 flex items-center gap-3 px-3 hover:bg-background-secondary rounded transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onDeletePath(path.id)}
                    aria-label={`Delete path ${path.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-error text-error text-lg leading-none hover:bg-error/10"
                  >
                    &minus;
                  </button>
                  <span className="text-sm text-text-primary truncate">
                    {path.name}
                    {path.hideEdge ? ' (hidden)' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer - Edit Agent Button */}
      <div className="h-16 border-t border-border flex items-center px-6">
        <Button
          onClick={onEditAgent}
          className="w-full bg-button-primary-bg text-button-primary-text hover:opacity-90"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Agent
        </Button>
      </div>
    </div>
  );
};

export default ConfigPanel;
