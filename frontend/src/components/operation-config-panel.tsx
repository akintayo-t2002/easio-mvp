import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect, useState } from 'react';
import { X, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import type { IntegrationDefinition, OperationDefinition } from '../config/operations';
import type { ToolOperation, RuntimeParameter, ToolConfiguration } from '../types/workflow';

const GMAIL_OVERRIDE_KEYS = [
  'fromAddress',
  'senderName',
  'replyTo',
  'defaultSubject',
  'defaultBody',
  'defaultBodyIsHtml',
  'maxRecipients',
] as const;

interface OperationConfigPanelProps {
  integration: IntegrationDefinition;
  operation: OperationDefinition;
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onSave: (toolOperation: ToolOperation) => void;
  existingConfig?: ToolOperation | null;
  connectedEmail?: string | null;
}

export const OperationConfigPanel: React.FC<OperationConfigPanelProps> = ({
  integration,
  operation,
  open,
  onClose,
  onBack,
  onSave,
  existingConfig,
  connectedEmail,
}) => {
  const Icon = integration.icon;

  // Initialize state from existing config or defaults
  const [llmDescription, setLlmDescription] = useState(
    existingConfig?.llmDescription || operation.defaultLlmDescription
  );
  const [configValues, setConfigValues] = useState<ToolConfiguration>(existingConfig?.config || {});
  const isAirtableFindRecord =
    integration.id === 'airtable' && operation.id === 'find_record_by_field';
  const isGmailSendEmail = integration.id === 'gmail' && operation.id === 'send_email';

  const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(() => !isGmailSendEmail);

  const [runtimeParameters, setRuntimeParameters] = useState<RuntimeParameter[]>(() => {
    const baseParams =
      existingConfig?.runtimeParameters && existingConfig.runtimeParameters.length > 0
        ? existingConfig.runtimeParameters
        : operation.defaultRuntimeParameters;

    const cloned = baseParams.map((param) => ({
      name: param.name,
      llmDescription: param.llmDescription,
      required: param.required,
      dataType: param.dataType,
    }));

    if (isAirtableFindRecord) {
      const ensured = cloned.length ? cloned : [];
      if (ensured.length === 0) {
        ensured.push({
          name: 'searchValue',
          llmDescription: 'Ask the caller for the value to look up.',
          required: true,
          dataType: 'string',
        });
      } else {
        ensured[0] = {
          name: 'searchValue',
          llmDescription: ensured[0].llmDescription || 'Ask the caller for the value to look up.',
          required: true,
          dataType: 'string',
        };
      }
      return ensured;
    }

    return cloned;
  });

  useEffect(() => {
    if (!isGmailSendEmail) {
      return;
    }

    const hasOverrides = GMAIL_OVERRIDE_KEYS.some((key) => {
      const value = configValues[key];
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return Boolean(value);
    });

    if (hasOverrides) {
      setShowAdvancedOverrides(true);
    }
  }, [configValues, isGmailSendEmail]);

  const handleConfigChange = (fieldName: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleBooleanConfigChange = (fieldName: string, value: boolean) => {
    setConfigValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const getStringConfigValue = (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  };

  const handleAddParameter = () => {
    setRuntimeParameters((prev) => [
      ...prev,
      {
        name: '',
        llmDescription: '',
        required: false,
        dataType: 'string',
      },
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    setRuntimeParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParameterChange = (
    index: number,
    field: keyof RuntimeParameter,
    value: string | boolean
  ) => {
    setRuntimeParameters((prev) =>
      prev.map((param, i) => (i === index ? { ...param, [field]: value } : param))
    );
  };

  const handleSave = () => {
    // Validate required config fields
    const missingFields = operation.configFields
      .filter((field) => field.required && !configValues[field.name])
      .map((field) => field.label);

    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    const toolOperation: ToolOperation = {
      id: existingConfig?.id || `${integration.id}_${operation.id}_${Date.now()}`,
      integrationId: integration.id,
      operationId: operation.id,
      operationName: operation.name,
      llmDescription,
      config: configValues,
      runtimeParameters,
    };

    onSave(toolOperation);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[71] flex items-center justify-center px-4 py-8">
          <div className="relative flex h-full max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-border px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="rounded p-1 transition-colors hover:bg-background-secondary"
                >
                  <ArrowLeft className="h-5 w-5 text-text-secondary" />
                </button>
                <Icon className={`h-5 w-5 ${integration.color}`} />
                <h2 className="text-lg font-semibold text-text-primary">{operation.name}</h2>
              </div>
              <Dialog.Close asChild>
                <button className="rounded p-1 transition-colors hover:bg-background-secondary">
                  <X className="h-5 w-5 text-text-secondary" />
                </button>
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* LLM Description */}
                <div>
                  <label className="text-xs font-semibold uppercase text-text-secondary">
                    Operation Description (for LLM)
                  </label>
                  <Textarea
                    value={llmDescription}
                    onChange={(e) => setLlmDescription(e.target.value)}
                    placeholder="Describe when the agent should use this operation..."
                    className="mt-2 min-h-24 resize-none border-border bg-background-secondary text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">
                    💡 This helps the agent understand when to use this operation
                  </p>
                </div>

                {/* Configuration Variables */}
                {isGmailSendEmail ? (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase text-text-secondary">
                      Sender Settings
                    </h3>
                    <div className="space-y-4 rounded-lg border border-border bg-background-secondary p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase text-text-secondary">
                          Connected Gmail
                        </p>
                        <p className="mt-1 text-sm text-text-primary">
                          {connectedEmail ? connectedEmail : 'Email address unavailable'}
                        </p>
                        <p className="mt-1 text-xs text-text-tertiary">
                          Emails are sent from this account unless you provide overrides.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAdvancedOverrides((prev) => !prev)}
                        className="text-xs font-medium text-accent transition-colors hover:underline"
                      >
                        {showAdvancedOverrides
                          ? 'Hide advanced overrides'
                          : 'Show advanced overrides'}
                      </button>

                      {showAdvancedOverrides && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-text-primary">
                              From Address Override
                            </label>
                            <Input
                              value={getStringConfigValue(configValues.fromAddress)}
                              onChange={(event) =>
                                handleConfigChange('fromAddress', event.target.value)
                              }
                              placeholder="Use connected Gmail address"
                              className="mt-1 border-border bg-background text-text-primary"
                            />
                            <p className="mt-1 text-xs text-text-tertiary">
                              Leave blank to always use the connected Gmail account.
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-text-primary">
                              Display Name
                            </label>
                            <Input
                              value={getStringConfigValue(configValues.senderName)}
                              onChange={(event) =>
                                handleConfigChange('senderName', event.target.value)
                              }
                              placeholder="Customer Support"
                              className="mt-1 border-border bg-background text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-text-primary">
                              Reply-To Address
                            </label>
                            <Input
                              value={getStringConfigValue(configValues.replyTo)}
                              onChange={(event) =>
                                handleConfigChange('replyTo', event.target.value)
                              }
                              placeholder="support@company.com"
                              className="mt-1 border-border bg-background text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-text-primary">
                              Fallback Subject
                            </label>
                            <Input
                              value={getStringConfigValue(configValues.defaultSubject)}
                              onChange={(event) =>
                                handleConfigChange('defaultSubject', event.target.value)
                              }
                              placeholder="Used only if the agent cannot infer a subject"
                              className="mt-1 border-border bg-background text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-text-primary">
                              Fallback Body
                            </label>
                            <Textarea
                              value={getStringConfigValue(configValues.defaultBody)}
                              onChange={(event) =>
                                handleConfigChange('defaultBody', event.target.value)
                              }
                              placeholder="Used only if the agent cannot compose the email during the call"
                              className="mt-1 min-h-24 resize-none border-border bg-background text-text-primary"
                            />
                          </div>

                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm text-text-primary">
                              <input
                                type="checkbox"
                                checked={
                                  configValues.defaultBodyIsHtml === true ||
                                  configValues.defaultBodyIsHtml === 'true'
                                }
                                onChange={(event) =>
                                  handleBooleanConfigChange(
                                    'defaultBodyIsHtml',
                                    event.target.checked
                                  )
                                }
                                className="rounded border-border text-accent focus:ring-offset-0"
                              />
                              Fallback body is HTML
                            </label>

                            <div className="flex flex-1 flex-col">
                              <label className="text-sm font-medium text-text-primary">
                                Max Recipients
                              </label>
                              <Input
                                value={getStringConfigValue(configValues.maxRecipients)}
                                onChange={(event) =>
                                  handleConfigChange('maxRecipients', event.target.value)
                                }
                                placeholder="Defaults to 5"
                                className="mt-1 border-border bg-background text-text-primary"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setConfigValues((prev) => {
                                const next = { ...prev };
                                GMAIL_OVERRIDE_KEYS.forEach((key) => {
                                  delete next[key];
                                });
                                return next;
                              })
                            }
                            className="text-xs text-text-tertiary transition-colors hover:text-error"
                          >
                            Clear overrides
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : operation.configFields.length > 0 ? (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase text-text-secondary">
                      Base Configuration
                    </h3>
                    <div className="space-y-4">
                      {operation.configFields.map((field) => (
                        <div key={field.name}>
                          <label className="text-sm font-medium text-text-primary">
                            {field.label}
                            {field.required && <span className="ml-1 text-error">*</span>}
                          </label>
                          <Input
                            value={getStringConfigValue(configValues[field.name])}
                            onChange={(e) => handleConfigChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 border-border bg-background-secondary text-text-primary"
                          />
                          {field.helperText && (
                            <p className="mt-1 text-xs text-text-tertiary">💡 {field.helperText}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Runtime Parameters */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase text-text-secondary">
                      Runtime Parameters (Agent collects during call)
                    </h3>
                    {!(isAirtableFindRecord || isGmailSendEmail) && (
                      <Button
                        onClick={handleAddParameter}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Parameter
                      </Button>
                    )}
                  </div>

                  {isGmailSendEmail && (
                    <div className="mb-3 rounded-lg border border-border bg-background-secondary p-4 text-xs text-text-secondary">
                      Guide the agent on how to gather or infer the recipient, subject, and body
                      from the conversation. These prompts help the voice agent compose the email
                      automatically.
                    </div>
                  )}

                  {isAirtableFindRecord ? (
                    <div className="rounded-lg border border-border bg-background-secondary p-4">
                      <p className="text-xs text-text-secondary">
                        The agent will collect this value during the conversation and pass it as
                        <code className="ml-1 font-mono">searchValue</code> to the Airtable lookup.
                      </p>
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-semibold uppercase text-text-secondary">
                          What should the agent ask for?
                        </label>
                        <Textarea
                          value={runtimeParameters[0]?.llmDescription ?? ''}
                          onChange={(event) =>
                            setRuntimeParameters((prev) => {
                              const next = prev.length
                                ? [...prev]
                                : [
                                    {
                                      name: 'searchValue',
                                      llmDescription: '',
                                      required: true,
                                      dataType: 'string',
                                    },
                                  ];

                              next[0] = {
                                ...next[0],
                                name: 'searchValue',
                                required: true,
                                dataType: 'string',
                                llmDescription: event.target.value,
                              };

                              return next;
                            })
                          }
                          placeholder="Ask the caller for the value to look up."
                          className="min-h-16 resize-none border-border bg-background text-sm text-text-primary"
                        />
                      </div>
                    </div>
                  ) : runtimeParameters.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-background-secondary/50 px-4 py-8 text-center">
                      <p className="text-xs text-text-tertiary">No runtime parameters</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Add parameters that the agent should collect during the call
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {runtimeParameters.map((param, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border bg-background-secondary p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <Input
                              value={param.name}
                              onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                              placeholder="Parameter name (e.g., fieldName)"
                              className="flex-1 border-border bg-background text-sm text-text-primary"
                              readOnly={isGmailSendEmail}
                            />
                            {!isGmailSendEmail && (
                              <button
                                onClick={() => handleRemoveParameter(index)}
                                className="ml-2 rounded p-1 text-text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                                title="Remove parameter"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-text-secondary">LLM Description</label>
                              <Textarea
                                value={param.llmDescription}
                                onChange={(e) =>
                                  handleParameterChange(index, 'llmDescription', e.target.value)
                                }
                                placeholder="What should the agent ask the user for?"
                                className="mt-1 min-h-16 resize-none border-border bg-background text-sm text-text-primary"
                              />
                            </div>

                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm text-text-primary">
                                <input
                                  type="checkbox"
                                  checked={param.required}
                                  onChange={(e) =>
                                    handleParameterChange(index, 'required', e.target.checked)
                                  }
                                  className="rounded border-border text-accent focus:ring-offset-0"
                                  disabled={isGmailSendEmail}
                                />
                                Required
                              </label>

                              <div className="flex items-center gap-2">
                                <label className="text-xs text-text-secondary">Type:</label>
                                <select
                                  value={param.dataType}
                                  onChange={(e) =>
                                    handleParameterChange(index, 'dataType', e.target.value)
                                  }
                                  className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary"
                                  disabled={isGmailSendEmail}
                                >
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="object">Object</option>
                                  <option value="array">Array</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex h-16 items-center justify-end gap-3 border-t border-border px-6 backdrop-blur">
              <Button
                variant="outline"
                onClick={onBack}
                className="border-border text-text-primary"
              >
                Back
              </Button>
              <Button
                onClick={handleSave}
                className="bg-button-primary-bg text-button-primary-text transition-opacity hover:opacity-90"
              >
                {existingConfig ? 'Update Operation' : 'Add to Agent'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
