import {
  FaDatabase,
  FaTicketAlt,
  FaSalesforce,
  FaGoogle,
  FaHubspot,
  FaPhone,
  FaPlug,
  FaLink,
  FaBolt,
} from "react-icons/fa"
import type { IconType } from "react-icons"

export interface RuntimeParameter {
  name: string
  llmDescription: string
  required: boolean
  dataType: string
}

export interface ConfigField {
  name: string
  label: string
  placeholder: string
  required: boolean
  helperText?: string
}

export interface OperationDefinition {
  id: string
  name: string
  description: string
  defaultLlmDescription: string
  configFields: ConfigField[]
  defaultRuntimeParameters: RuntimeParameter[]
}

export interface IntegrationDefinition {
  id: string
  name: string
  icon: IconType
  color: string
  operations: OperationDefinition[]
}

export const INTEGRATIONS: Record<string, IntegrationDefinition> = {
  airtable: {
    id: "airtable",
    name: "Airtable",
    icon: FaDatabase,
    color: "text-[#FCB400]",
    operations: [
      {
        id: "list_records",
        name: "List Records",
        description: "Get all records from a table",
        defaultLlmDescription:
          "Use this to retrieve all records from an Airtable table. Ask the user which table they want to list records from if not specified.",
        configFields: [
          {
            name: "baseId",
            label: "Base ID",
            placeholder: "app1234567890abcd",
            required: true,
            helperText: "Found in your Airtable base URL",
          },
          {
            name: "tableId",
            label: "Table ID",
            placeholder: "tbl1234567890abcd",
            required: true,
            helperText: "Found in your Airtable table URL",
          },
        ],
        defaultRuntimeParameters: [
          {
            name: "maxRecords",
            llmDescription: "Maximum number of records to return (optional, defaults to 100)",
            required: false,
            dataType: "number",
          },
          {
            name: "view",
            llmDescription: "Name of the view to use (optional)",
            required: false,
            dataType: "string",
          },
        ],
      },
      {
        id: "find_record_by_field",
        name: "Find Record by Field",
        description: "Find a specific record by field value",
        defaultLlmDescription:
          "Use this when the user wants to find a specific record by searching for a value in a known field. Collect the value from the caller before running the lookup.",
        configFields: [
          {
            name: "baseId",
            label: "Base ID",
            placeholder: "app1234567890abcd",
            required: true,
            helperText: "Found in your Airtable base URL",
          },
          {
            name: "tableId",
            label: "Table ID",
            placeholder: "tbl1234567890abcd",
            required: true,
            helperText: "Found in your Airtable table URL",
          },
          {
            name: "fieldName",
            label: "Field Name",
            placeholder: "Email",
            required: true,
            helperText: "Exact column name to match (case-sensitive in Airtable)",
          },
          {
            name: "maxRecords",
            label: "Max Records",
            placeholder: "1",
            required: false,
            helperText: "Optional limit (default 1, capped at 20) for the lookup results.",
          },
        ],
        defaultRuntimeParameters: [
          {
            name: "searchValue",
            llmDescription: "The value to look for in the specified field",
            required: true,
            dataType: "string",
          },
        ],
      },
      {
        id: "create_record",
        name: "Create Record",
        description: "Create a new record in a table",
        defaultLlmDescription:
          "Use this to create a new record in an Airtable table. Collect all required field values from the user before creating the record.",
        configFields: [
          {
            name: "baseId",
            label: "Base ID",
            placeholder: "app1234567890abcd",
            required: true,
            helperText: "Found in your Airtable base URL",
          },
          {
            name: "tableId",
            label: "Table ID",
            placeholder: "tbl1234567890abcd",
            required: true,
            helperText: "Found in your Airtable table URL",
          },
        ],
        defaultRuntimeParameters: [
          {
            name: "fields",
            llmDescription:
              "An object containing field names and values for the new record. Ask the user for all required information.",
            required: true,
            dataType: "object",
          },
        ],
      },
      {
        id: "update_record",
        name: "Update Record",
        description: "Update an existing record",
        defaultLlmDescription:
          "Use this to update an existing record in Airtable. Ask the user for the record ID and the fields they want to update.",
        configFields: [
          {
            name: "baseId",
            label: "Base ID",
            placeholder: "app1234567890abcd",
            required: true,
            helperText: "Found in your Airtable base URL",
          },
          {
            name: "tableId",
            label: "Table ID",
            placeholder: "tbl1234567890abcd",
            required: true,
            helperText: "Found in your Airtable table URL",
          },
        ],
        defaultRuntimeParameters: [
          {
            name: "recordId",
            llmDescription: "The ID of the record to update",
            required: true,
            dataType: "string",
          },
          {
            name: "fields",
            llmDescription: "An object containing the field names and new values to update",
            required: true,
            dataType: "object",
          },
        ],
      },
    ],
  },
  zendesk: {
    id: "zendesk",
    name: "Zendesk",
    icon: FaTicketAlt,
    color: "text-[#03363D]",
    operations: [
      {
        id: "create_ticket",
        name: "Create Ticket",
        description: "Create a new support ticket",
        defaultLlmDescription:
          "Use this to create a new support ticket in Zendesk. Collect the subject, description, and priority from the user.",
        configFields: [],
        defaultRuntimeParameters: [
          {
            name: "subject",
            llmDescription: "The subject line of the ticket",
            required: true,
            dataType: "string",
          },
          {
            name: "description",
            llmDescription: "The detailed description of the issue",
            required: true,
            dataType: "string",
          },
          {
            name: "priority",
            llmDescription: "Priority level: low, normal, high, or urgent",
            required: false,
            dataType: "string",
          },
        ],
      },
    ],
  },
  salesforce: {
    id: "salesforce",
    name: "Salesforce",
    icon: FaSalesforce,
    color: "text-[#00A1E0]",
    operations: [
      {
        id: "update_lead",
        name: "Update Lead",
        description: "Update a lead in Salesforce",
        defaultLlmDescription:
          "Use this to update lead information in Salesforce. Ask for the lead ID and the fields to update.",
        configFields: [],
        defaultRuntimeParameters: [
          {
            name: "leadId",
            llmDescription: "The Salesforce ID of the lead to update",
            required: true,
            dataType: "string",
          },
          {
            name: "fields",
            llmDescription: "An object with field names and values to update",
            required: true,
            dataType: "object",
          },
        ],
      },
    ],
  },
  google_sheets: {
    id: "google_sheets",
    name: "Google Sheets",
    icon: FaGoogle,
    color: "text-[#0F9D58]",
    operations: [],
  },
  gmail: {
    id: "gmail",
    name: "Gmail",
    icon: FaGoogle,
    color: "text-[#EA4335]",
    operations: [
      {
        id: "send_email",
        name: "Send Email",
        description: "Send an email from the connected Gmail account",
        defaultLlmDescription:
          "Use this to send a follow-up email through Gmail. Rely on the conversation to craft the subject and body, and collect the recipient address when it isn't already known.",
        configFields: [
          {
            name: "fromAddress",
            label: "From Address",
            placeholder: "agent@company.com",
            required: false,
            helperText:
              "Optional override. If left blank the connected Gmail account's address will be used.",
          },
          {
            name: "senderName",
            label: "Sender Name",
            placeholder: "Customer Support",
            required: false,
            helperText: "Optional display name shown to recipients.",
          },
          {
            name: "replyTo",
            label: "Reply-To",
            placeholder: "support@company.com",
            required: false,
            helperText: "Optional address to receive replies instead of the sender address.",
          },
          {
            name: "defaultSubject",
            label: "Default Subject",
            placeholder: "Regarding your recent inquiry",
            required: false,
            helperText:
              "Fallback subject used only when the agent cannot determine one from the conversation.",
          },
          {
            name: "defaultBody",
            label: "Default Body",
            placeholder: "Thank you for speaking with us...",
            required: false,
            helperText:
              "Fallback message body in the rare case the agent cannot compose the email during the call.",
          },
          {
            name: "maxRecipients",
            label: "Max Recipients",
            placeholder: "5",
            required: false,
            helperText: "Upper limit for To/CC/BCC combined (defaults to 5, capped at 20).",
          },
          {
            name: "defaultBodyIsHtml",
            label: "Default Body Is HTML",
            placeholder: "false",
            required: false,
            helperText: "Set to true if the fallback body should be treated as HTML.",
          },
        ],
        defaultRuntimeParameters: [
          {
            name: "to",
            llmDescription: "Ask for the recipient email address (or addresses).",
            required: true,
            dataType: "string",
          },
          {
            name: "subject",
            llmDescription: "Ask for the email subject unless a default applies.",
            required: false,
            dataType: "string",
          },
          {
            name: "body",
            llmDescription: "Collect the body of the email to send.",
            required: true,
            dataType: "string",
          },
          {
            name: "cc",
            llmDescription: "Optional list of CC recipients.",
            required: false,
            dataType: "string",
          },
          {
            name: "bcc",
            llmDescription: "Optional list of BCC recipients.",
            required: false,
            dataType: "string",
          },
          {
            name: "bodyIsHtml",
            llmDescription: "Set to true if the caller wants the message sent as HTML.",
            required: false,
            dataType: "boolean",
          },
        ],
      },
    ],
  },
  twilio: {
    id: "twilio",
    name: "Twilio",
    icon: FaPhone,
    color: "text-[#F22F46]",
    operations: [],
  },
  hubspot: {
    id: "hubspot",
    name: "Hubspot",
    icon: FaHubspot,
    color: "text-[#FF7A59]",
    operations: [],
  },
  mcp: {
    id: "mcp",
    name: "MCP",
    icon: FaPlug,
    color: "text-purple-600",
    operations: [],
  },
  api: {
    id: "api",
    name: "API",
    icon: FaLink,
    color: "text-blue-600",
    operations: [],
  },
  function: {
    id: "function",
    name: "Function",
    icon: FaBolt,
    color: "text-yellow-600",
    operations: [],
  },
}

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS[id]
}

export function getOperation(integrationId: string, operationId: string): OperationDefinition | undefined {
  const integration = INTEGRATIONS[integrationId]
  return integration?.operations.find((op) => op.id === operationId)
}




