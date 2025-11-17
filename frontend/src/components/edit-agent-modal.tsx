import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Sparkles, Plus, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { OperationSelectorModal } from './operation-selector-modal';
import { OperationConfigPanel } from './operation-config-panel';
import type { Agent, ToolOperation } from '../types/workflow';
import {
  INTEGRATIONS,
  getIntegration,
  type IntegrationDefinition,
  type OperationDefinition,
} from '../config/operations';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useNavigate } from 'react-router-dom';
import { buildIntegrationAuthorizeUrls } from '../lib/utils';

const TEMPLATE_PROMPTS = [
  'Customer support specialist',
  'Appointment specialist',
  'Lead qualification specialist',
];

const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o-nano', label: 'GPT-4o nano' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 nano' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'gpt-5-nano', label: 'GPT-5 nano' },
];

interface EditAgentModalProps {
  agent: Agent;
  onClose: () => void;
  onSave: (agent: Agent) => void | Promise<void>;
}

type ModalState =
  | { type: 'main' }
  | { type: 'operation-selector'; integration: IntegrationDefinition }
  | {
      type: 'operation-config';
      integration: IntegrationDefinition;
      operation: OperationDefinition;
      existingConfig?: ToolOperation;
    };

const EditAgentModal: React.FC<EditAgentModalProps> = ({ agent, onClose, onSave }) => {
  const [agentName, setAgentName] = useState(agent.name || '');
  const [instructions, setInstructions] = useState(agent.instructions || '');
  const [model, setModel] = useState(agent.model || AVAILABLE_MODELS[0].value);
  const [saving, setSaving] = useState(false);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ type: 'main' });
  const navigate = useNavigate();
  const airtableStatus = useIntegrationStatus('airtable');
  const gmailStatus = useIntegrationStatus('gmail');
  const oauthWindowRef = useRef<{ win: Window | null; provider: string | null }>({
    win: null,
    provider: null,
  });
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [connectErrors, setConnectErrors] = useState<Record<string, string | null>>({});
  const expectedOriginsRef = useRef<Record<string, string>>({});
  const closeMonitorRef = useRef<number | null>(null);

  const handleOAuthMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const messageType = data.type;
      if (messageType !== 'integration_oauth_complete' && messageType !== 'airtable_oauth_complete')
        return;

      const provider = typeof data.provider === 'string' ? data.provider : undefined;
      if (!provider) return;

      const expectedOrigin = expectedOriginsRef.current[provider];
      if (expectedOrigin && event.origin !== expectedOrigin) return;

      const currentWindow = oauthWindowRef.current.win;
      if (currentWindow && event.source !== currentWindow) return;

      if (closeMonitorRef.current !== null) {
        window.clearInterval(closeMonitorRef.current);
        closeMonitorRef.current = null;
      }

      if (currentWindow && !currentWindow.closed) {
        currentWindow.close();
      }
      oauthWindowRef.current = { win: null, provider: null };

      setConnectingProvider((prev) => (prev === provider ? null : prev));

      const success = Boolean(data.success);
      const errorMessage =
        typeof data.error === 'string' && data.error.length > 0 ? data.error : undefined;

      setConnectErrors((prev) => ({
        ...prev,
        [provider]: success ? null : errorMessage ?? `${provider} connection was not completed.`,
      }));

      if (success) {
        if (provider === 'airtable') {
          void airtableStatus.refresh();
        } else if (provider === 'gmail') {
          void gmailStatus.refresh();
        }
      }
    },
    [airtableStatus, gmailStatus]
  );

  useEffect(() => {
    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [handleOAuthMessage]);

  useEffect(() => {
    if (!connectingProvider) {
      if (closeMonitorRef.current !== null) {
        window.clearInterval(closeMonitorRef.current);
        closeMonitorRef.current = null;
      }
      return;
    }

    const provider = connectingProvider;

    closeMonitorRef.current = window.setInterval(() => {
      const currentWindow = oauthWindowRef.current.win;
      if (currentWindow && currentWindow.closed) {
        const intervalId = closeMonitorRef.current;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }
        closeMonitorRef.current = null;
        oauthWindowRef.current = { win: null, provider: null };
        setConnectingProvider(null);
        setConnectErrors((prev) => ({
          ...prev,
          [provider]:
            prev[provider] ?? `${provider} connection window was closed before completion.`,
        }));
      }
    }, 500);

    return () => {
      if (closeMonitorRef.current !== null) {
        window.clearInterval(closeMonitorRef.current);
        closeMonitorRef.current = null;
      }
    };
  }, [connectingProvider]);

  // Handle both old format (string[]) and new format (ToolOperation[])
  const [toolOperations, setToolOperations] = useState<ToolOperation[]>(() => {
    if (!agent.tools || agent.tools.length === 0) return [];
    if (typeof agent.tools[0] === 'string') return [];
    return agent.tools as ToolOperation[];
  });

  useEffect(() => {
    setAgentName(agent.name || '');
    setInstructions(agent.instructions || '');
    setModel(agent.model || AVAILABLE_MODELS[0].value);
    setToolOperations(agent.tools ?? []);
  }, [agent]);

  useEffect(() => {
    if (modalState.type !== 'operation-selector') {
      return;
    }

    const provider = modalState.integration.id;
    if (provider === 'airtable') {
      void airtableStatus.refresh();
    } else if (provider === 'gmail') {
      void gmailStatus.refresh();
    }
  }, [airtableStatus, gmailStatus, modalState]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.resolve(
        onSave({
          ...agent,
          name: agentName,
          instructions,
          tools: toolOperations,
          model,
          toolCount: toolOperations.length,
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleIntegrationClick = (integrationId: string) => {
    const integration = getIntegration(integrationId);
    if (!integration) return;

    setToolsPopoverOpen(false);
    setModalState({ type: 'operation-selector', integration });
  };

  const handleConfigureOperation = (operation: OperationDefinition) => {
    if (modalState.type !== 'operation-selector') return;

    setModalState({
      type: 'operation-config',
      integration: modalState.integration,
      operation,
    });
  };

  const handleEditOperation = (toolOp: ToolOperation) => {
    const integration = getIntegration(toolOp.integrationId);
    if (!integration) return;

    const operation = integration.operations.find((op) => op.id === toolOp.operationId);
    if (!operation) return;

    setModalState({
      type: 'operation-config',
      integration,
      operation,
      existingConfig: toolOp,
    });
  };

  const handleSaveOperation = (toolOperation: ToolOperation) => {
    setToolOperations((prev) => {
      // Check if we're editing an existing operation
      const existingIndex = prev.findIndex((op) => op.id === toolOperation.id);
      if (existingIndex >= 0) {
        // Update existing
        return prev.map((op, i) => (i === existingIndex ? toolOperation : op));
      }
      // Add new
      return [...prev, toolOperation];
    });

    // Close modals and return to main
    setModalState({ type: 'main' });
  };

  const handleRemoveOperation = (toolOpId: string) => {
    setToolOperations((prev) => prev.filter((op) => op.id !== toolOpId));
  };

  const handleBackToOperationSelector = () => {
    if (modalState.type === 'operation-config') {
      setModalState({ type: 'operation-selector', integration: modalState.integration });
    }
  };

  const handleCloseModals = () => {
    setModalState({ type: 'main' });
  };

  const handleConnect = (integrationId: string) => {
    if (integrationId !== 'airtable' && integrationId !== 'gmail') {
      return;
    }

    const { authorizeUrl, callbackUrl } = buildIntegrationAuthorizeUrls({
      provider: integrationId,
    });
    const expectedOrigin = new URL(callbackUrl).origin;
    expectedOriginsRef.current[integrationId] = expectedOrigin;
    setConnectErrors((prev) => ({
      ...prev,
      [integrationId]: null,
    }));
    setConnectingProvider(integrationId);
    const popup = window.open(authorizeUrl, `${integrationId}-oauth`, 'width=480,height=720');
    oauthWindowRef.current = { win: popup ?? null, provider: integrationId };
    if (!popup) {
      // Popup blocked, fallback to full redirect
      window.location.href = authorizeUrl;
    }
  };

  const handleManageConnection = () => {
    navigate('/integrations');
  };

  const currentOperationProvider =
    modalState.type === 'operation-selector' ? modalState.integration.id : null;
  const currentIntegrationConnected =
    currentOperationProvider === 'airtable'
      ? Boolean(airtableStatus.status?.connected)
      : currentOperationProvider === 'gmail'
      ? Boolean(gmailStatus.status?.connected)
      : false;
  const currentIntegrationConnecting = currentOperationProvider
    ? connectingProvider === currentOperationProvider
    : false;
  const currentConnectError = currentOperationProvider
    ? connectErrors[currentOperationProvider] ?? null
    : null;

  return (
    <>
      <Dialog.Root open={modalState.type === 'main'} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-[61] flex items-center justify-center px-4 py-8">
            <div className="relative flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
              {/* Header */}
              <div className="flex h-16 items-center justify-between border-b border-border px-6">
                <h2 className="text-lg font-semibold text-text-primary">Edit Agent</h2>
                <Dialog.Close asChild>
                  <button className="rounded p-1 transition-colors hover:bg-background-secondary">
                    <X className="h-5 w-5 text-text-secondary" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Content - Two Column Layout */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left Column (60%) */}
                <div className="flex-1 space-y-6 overflow-y-auto border-r border-border p-6">
                  {/* Agent Name */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-secondary">
                      Agent Name
                    </label>
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Enter agent name"
                      className="mt-2 border-border bg-background-secondary text-text-primary"
                    />
                  </div>

                  {/* Instructions */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase text-text-secondary">
                        Instructions
                      </label>
                      <button className="rounded p-1 transition-colors hover:bg-background-secondary">
                        <Sparkles className="h-4 w-4 text-accent" />
                      </button>
                    </div>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Describe what this agent should do..."
                      className="min-h-32 resize-none border-border bg-background-secondary text-text-primary"
                    />
                  </div>

                  {/* Templates */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text-secondary">TEMPLATES</p>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setInstructions(prompt)}
                          className="rounded-full border border-border bg-background-secondary px-3 py-1 text-xs text-text-primary transition-colors hover:bg-background-tertiary"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column (40%) */}
                <div className="flex w-2/5 flex-col space-y-6 overflow-y-auto bg-background-secondary/60 p-6">
                  {/* Model Selector */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-secondary">
                      Model
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary shadow-sm"
                    >
                      {AVAILABLE_MODELS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tools - Operations Based */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase text-text-secondary">
                        Tools
                      </label>
                      <Popover.Root open={toolsPopoverOpen} onOpenChange={setToolsPopoverOpen}>
                        <Popover.Trigger asChild>
                          <button className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-text-secondary transition-colors hover:border-accent hover:text-accent">
                            <Plus className="h-4 w-4" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            side="left"
                            align="start"
                            className="z-[70] w-64 rounded-lg border border-border bg-background p-2 shadow-lg"
                          >
                            <div className="mb-2 px-2 text-xs font-semibold text-text-secondary">
                              Select Integration
                            </div>
                            <div className="max-h-80 space-y-1 overflow-y-auto">
                              {Object.values(INTEGRATIONS).map((integration) => {
                                const Icon = integration.icon;
                                return (
                                  <button
                                    key={integration.id}
                                    onClick={() => handleIntegrationClick(integration.id)}
                                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-all hover:bg-background-secondary"
                                  >
                                    <Icon className={`h-4 w-4 ${integration.color}`} />
                                    <span className="flex-1 text-sm font-medium text-text-primary">
                                      {integration.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>

                    {/* Selected Operations Display */}
                    {toolOperations.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {toolOperations.map((toolOp) => {
                          const integration = getIntegration(toolOp.integrationId);
                          if (!integration) return null;
                          const Icon = integration.icon;
                          return (
                            <div
                              key={toolOp.id}
                              className="group flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-all"
                            >
                              <Icon className={`h-4 w-4 ${integration.color}`} />
                              <span className="text-xs font-medium text-text-primary">
                                {toolOp.operationName}
                              </span>
                              <button
                                onClick={() => handleEditOperation(toolOp)}
                                className="ml-0.5 rounded p-0.5 opacity-0 transition-all hover:bg-accent/20 group-hover:opacity-100"
                                title="Edit configuration"
                                type="button"
                              >
                                <Settings className="h-3 w-3 text-text-secondary" />
                              </button>
                              <button
                                onClick={() => handleRemoveOperation(toolOp.id)}
                                className="ml-0.5 rounded p-0.5 opacity-0 transition-colors hover:bg-error/20 group-hover:opacity-100"
                                title="Remove operation"
                                type="button"
                              >
                                <X className="h-3 w-3 text-text-tertiary" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-background-secondary/50 px-4 py-6 text-center">
                        <p className="text-xs text-text-tertiary">No tools selected</p>
                        <p className="mt-1 text-xs text-text-secondary">Click + to add tools</p>
                      </div>
                    )}
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-offset-0"
                        defaultChecked
                      />
                      Knowledge Base
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-offset-0"
                      />
                      Buttons
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-offset-0"
                      />
                      Cards
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-offset-0"
                      />
                      Carousels
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-offset-0"
                      />
                      Call Forward
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex h-16 items-center justify-end gap-3 border-t border-border px-6 backdrop-blur">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-border text-text-primary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving}
                  className="bg-button-primary-bg text-button-primary-text transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Agent'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Operation Selector Modal */}
      {modalState.type === 'operation-selector' && (
        <OperationSelectorModal
          integration={modalState.integration}
          open={true}
          onClose={handleCloseModals}
          onConfigure={handleConfigureOperation}
          isConnected={currentIntegrationConnected}
          onConnect={() => handleConnect(modalState.integration.id)}
          onManageConnection={handleManageConnection}
          isConnecting={currentIntegrationConnecting}
          connectError={currentConnectError}
        />
      )}

      {/* Operation Config Panel */}
      {modalState.type === 'operation-config' && (
        <OperationConfigPanel
          integration={modalState.integration}
          operation={modalState.operation}
          open={true}
          onClose={handleCloseModals}
          onBack={handleBackToOperationSelector}
          onSave={handleSaveOperation}
          existingConfig={modalState.existingConfig}
          connectedEmail={
            modalState.integration.id === 'gmail' ? gmailStatus.status?.email ?? null : null
          }
        />
      )}
    </>
  );
};

export default EditAgentModal;
