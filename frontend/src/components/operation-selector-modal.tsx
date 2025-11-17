import * as Dialog from '@radix-ui/react-dialog';
import { X, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import type { IntegrationDefinition, OperationDefinition } from '../config/operations';
import React from 'react';

interface OperationSelectorModalProps {
  integration: IntegrationDefinition;
  open: boolean;
  onClose: () => void;
  onConfigure: (operation: OperationDefinition) => void;
  isConnected?: boolean;
  onConnect?: () => void;
  onManageConnection?: () => void;
  isConnecting?: boolean;
  connectError?: string | null;
}

export const OperationSelectorModal: React.FC<OperationSelectorModalProps> = ({
  integration,
  open,
  onClose,
  onConfigure,
  isConnected = false,
  onConnect = () => {},
  onManageConnection = () => {},
  isConnecting = false,
  connectError = null,
}) => {
  const Icon = integration.icon;

  if (integration.operations.length === 0) {
    return (
      <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-[71] flex items-center justify-center px-4 py-8">
            <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
              {/* Header */}
              <div className="flex h-16 items-center justify-between border-b border-border px-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="rounded p-1 transition-colors hover:bg-background-secondary"
                  >
                    <ArrowLeft className="h-5 w-5 text-text-secondary" />
                  </button>
                  <Icon className={`h-5 w-5 ${integration.color}`} />
                  <h2 className="text-lg font-semibold text-text-primary">{integration.name}</h2>
                </div>
                <Dialog.Close asChild>
                  <button className="rounded p-1 transition-colors hover:bg-background-secondary">
                    <X className="h-5 w-5 text-text-secondary" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-base font-medium text-text-primary">No operations available</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Operations for {integration.name} are coming soon.
                </p>
                <Button onClick={onClose} variant="outline" className="mt-6">
                  Close
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[71] flex items-center justify-center px-4 py-8">
          <div className="relative flex h-full max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-border px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="rounded p-1 transition-colors hover:bg-background-secondary"
                >
                  <ArrowLeft className="h-5 w-5 text-text-secondary" />
                </button>
                <Icon className={`h-5 w-5 ${integration.color}`} />
                <h2 className="text-lg font-semibold text-text-primary">
                  Add {integration.name} Operations
                </h2>
              </div>
              <Dialog.Close asChild>
                <button className="rounded p-1 transition-colors hover:bg-background-secondary">
                  <X className="h-5 w-5 text-text-secondary" />
                </button>
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="mb-6 text-sm text-text-secondary">
                Select an operation to configure for this agent
              </p>

              <div className="space-y-3">
                {integration.operations.map((operation) => (
                  <div
                    key={operation.id}
                    className="rounded-lg border border-border bg-background p-4 transition-all hover:border-accent"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-text-primary">
                          {operation.name}
                        </h3>
                        <p className="mt-1 text-sm text-text-secondary">{operation.description}</p>
                      </div>
                      <Button
                        onClick={() => onConfigure(operation)}
                        size="sm"
                        className="bg-accent text-white hover:opacity-90"
                      >
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection Status Banner */}
            <div className="border-t border-border bg-background-secondary/50 px-6 py-4">
              {isConnected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-text-primary">
                      {integration.name} is connected.
                    </span>
                  </div>
                  <button
                    onClick={onManageConnection}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-900">
                      {integration.name} is not connected.
                    </span>
                  </div>
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {isConnecting ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              )}
              {connectError ? <p className="mt-2 text-xs text-red-600">{connectError}</p> : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
