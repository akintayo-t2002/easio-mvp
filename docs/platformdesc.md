# Voice Agent Platform - Product Vision

> **Status:** This document outlines the intended end-state experience. It contains roadmap items that are not yet implemented.

## Product Overview

A voice agent platform that enables businesses to create, configure, and deploy intelligent voice agents for customer service. Customers can build custom agent workflows, attach phone numbers, and serve their customers through automated voice interactions.

## Core Concept

The platform uses an **agent-based orchestration architecture** rather than traditional rule-based flows. Instead of creating rigid "if customer says X, then do Y" logic trees, businesses configure intelligent agents that understand context and make decisions based on conversation flow.

All agents in the system are fundamentally the same - they're **agent nodes with configurable properties**. What an agent does and how it behaves is entirely determined by how the customer configures these properties based on their specific use case.

## Key Components

### 1. Workflows Tab

The primary interface where users design and configure their voice agent systems. This is where the agent network is built, tested, and deployed.

### 2. Agent Nodes

The fundamental building blocks of the platform. Every agent is the same type of node with the same set of configurable properties. There are no pre-defined agent types or templates.

**What makes agents different is their configuration:**

An agent node configured with:
- Instructions focused on understanding intent and routing
- Multiple paths connecting to other agents
- No tools

...functions as what we might call a "router" or "orchestrator" - the first point of contact that directs conversations.

The same agent node configured with:
- Instructions focused on a specific domain (e.g., handling payment issues)
- Tools for taking actions (e.g., processing payments)
- Paths for transferring to other agents or back to the orchestrator

...functions as what we might call a "specialist agent" that handles a specific use case.

**The platform doesn't assign these roles - the customer's configuration determines what each agent does.**

### 3. Workflow Editor

A visual, drag-and-drop interface for building agent networks. Users can:
- Drag agent nodes onto a canvas
- Connect agents through paths
- Configure each agent's properties based on their needs
- Test conversations before deployment
- Save and activate workflows

## Agent Node Properties

Every agent node has the same set of properties. Which properties are utilized depends on the customer's use case.

### Agent Name
Each agent node is given a name by the user during configuration. This name helps identify the agent in the workflow and makes the canvas easier to understand.

**Examples**: "Payment Handler", "First Contact", "Order Specialist", "General Support"

The name is purely for organizational purposes - it doesn't determine the agent's behavior. That's defined by the other properties.

### Instructions
Natural language description of what this agent should do, how it should behave, and what it's responsible for.

**Example for an orchestrating agent:**
"You are the first point of contact. Understand what the customer needs, ask clarifying questions, and transfer them to the appropriate specialist once you understand their issue."

**Example for a specialist agent:**
"You handle payment-related issues. Help customers with failed payments, update payment methods, and process refunds when eligible. Use the available tools to take necessary actions."

### Paths
Transfer connections to other agents. Each path defines when and how to transfer the conversation to another agent node.

**Path Properties:**
- **Name**: Clear identifier for the path
- **Description**: Natural language explanation of when to use this path
- **Target Agent**: Which agent node this path connects to
- **Required Variables**: Information that must be collected before the transfer can happen

**All agents can have paths** - whether they use them depends on the workflow design.

### Tools
Actions the agent can perform. Tools are selected from the platform's library of available integrations.

**Examples of tools:**
- Process payment
- Check order status
- Update account information
- Send confirmation email
- Look up customer data

**Not all agents need tools** - an orchestrating agent might only need paths to route conversations, while specialist agents might need specific tools to complete their tasks.

### Required Variables (on Paths)

When defining a path, customers can specify variables that must be collected before the transfer happens.

**Variable Properties:**
- **Name**: Identifier for the variable (e.g., `customer_id`)
- **Description**: What this variable represents
- **Required/Optional**: Whether the conversation can transfer without it

**Purpose**: Ensures smooth handoffs with context, preventing customers from repeating information.

## Workflow Patterns

The platform doesn't enforce specific patterns - customers design workflows based on their needs.

### Pattern 1: Single Agent

For straightforward use cases:

```
Start → Agent Node
```

The single agent node is configured with:
- Instructions for the entire use case
- All necessary tools
- Paths (if escalation or specific routing is needed)

**Example**: A small business handling general customer inquiries with one agent that can access all tools and handle all scenarios.

### Pattern 2: Orchestrator + Specialists

For use cases requiring specialized handling:

```
Start → Agent Node (orchestrator) → Agent Node (specialist 1)
                                  → Agent Node (specialist 2)
                                  → Agent Node (specialist 3)
```

**Orchestrator agent configured with:**
- Instructions to understand and route
- Paths to each specialist
- No tools (just routing)

**Specialist agents configured with:**
- Instructions for their domain
- Tools for their specific actions
- Paths back to orchestrator or to other specialists

**Example**: A company with distinct departments where different teams handle different customer needs.

### Pattern 3: Flexible Network

Agents can be connected in any configuration that makes sense for the business:

```
Start → Agent A → Agent B → Agent C
              ↓           ↑
              → Agent D ←
```

The platform doesn't restrict how agents connect - it's entirely based on the customer's workflow design.

## How Paths Work

Paths enable agents to transfer conversations. They're the connections between agent nodes in the workflow.

### Path Configuration

When creating a path between two agents, customers define:

**Name**: "Transfer to payment specialist" (or whatever makes sense for their use case)

**Description**: Natural language explanation of when to use this path. The agent uses this to determine when a transfer is appropriate.

*Example*: "Use this when the customer mentions payment issues, failed transactions, or wants to update their payment method"

**Target**: Which agent node this path leads to

**Required Variables**: Information to collect before transferring

### Why Required Variables Matter

Variables ensure context is preserved across transfers, preventing redundant conversations.

**Example Flow:**

Customer calls about a payment issue:
1. First agent asks: "What's your account ID?" and "Can you describe the issue?"
2. Agent collects: `account_id` and `issue_description`
3. Agent transfers to payment specialist agent with these variables
4. Payment specialist agent already has context and doesn't need to re-ask

Without required variables, the second agent would need to ask the same questions again.

### Path Directions

Paths are directional - they define where an agent can transfer to.

**Common configurations:**

An orchestrator agent might have paths going out to multiple specialists, but no incoming paths (it's the entry point).

A specialist agent might have paths going back to the orchestrator and to other related specialists.

How paths are configured depends entirely on the workflow the customer designs.

## Conversation Flow Examples

These examples use generic "Agent A", "Agent B" naming to emphasize that they're just configured nodes, not pre-defined types.

### Example 1: Complete Resolution with One Specialist

Customer calls with a specific need:

1. **Agent A (orchestrator)**: Understands the customer's issue, collects necessary information, transfers to Agent B
2. **Agent B (specialist)**: 
   - Uses tools to check status
   - Uses tools to take action
   - Provides confirmation
   - Ends call

The entire resolution happened with Agent B after the initial routing.

### Example 2: Cross-Specialist Transfer

Customer's issue spans multiple domains:

1. **Agent A (orchestrator)**: Routes to Agent B based on initial understanding
2. **Agent B (specialist)**: Realizes the issue needs Agent C's capabilities
3. **Agent B**: Transfers to Agent C with context
4. **Agent C (specialist)**: Resolves the issue

### Example 3: Variable Collection

Customer doesn't provide complete information upfront:

1. **Agent A**: Identifies which path to use based on customer's request
2. **Agent A**: Checks required variables for that path - some are missing
3. **Agent A**: "I can help with that. I'll need your account number first."
4. **Customer**: Provides information
5. **Agent A**: Transfers to Agent B with complete context

## Agent Configuration in Practice

Since all agents are the same node type with the same properties, here's how customers would actually configure them:

### Configuring an Orchestrating Agent

**Instructions Field:**
"Understand what the customer needs. Ask questions to clarify if unclear. Once you know what they need, transfer them to the appropriate specialist. Be friendly and efficient."

**Paths Field:**
- Path 1: "Transfer to payment specialist" → connects to Agent Node 2
- Path 2: "Transfer to account specialist" → connects to Agent Node 3
- Path 3: "Transfer to order specialist" → connects to Agent Node 4

**Tools Field:**
(Empty - this agent only routes)

### Configuring a Specialist Agent

**Instructions Field:**
"Handle all payment-related issues. Help customers resolve failed payments, update payment methods, and process refunds when appropriate. Use your tools to check payment status and take necessary actions."

**Paths Field:**
- Path 1: "Transfer back to main agent" → connects to Agent Node 1
- Path 2: "Transfer to account specialist" → connects to Agent Node 3

**Tools Field:**
- Check payment status
- Process refund
- Update payment method
- Retrieve transaction history

## Testing Workflows

Before connecting to live phone numbers, workflows can be tested to validate agent behavior and conversation flow.

### Chat Testing
- Text-based conversation simulation
- Shows which agent is currently handling the conversation
- Displays when paths are triggered
- Shows which tools are executed
- Tracks variable collection

### Voice Testing
- Web-based voice chat
- Tests actual voice interaction quality
- Validates conversation flow sounds natural
- Tests latency handling

### Testing Visualization

The testing interface shows:
- Which agent node is currently active (highlighted on the canvas)
- When transfers happen and which path was used
- Which tools are called
- What variables were collected
- The complete conversation path through the workflow

## Handling Edge Cases

### When Agents Are Uncertain

Agents are configured to handle uncertainty gracefully through their instructions:
- If a tool fails: Agent acknowledges and offers alternatives
- If customer intent is unclear: Agent asks clarifying questions
- If outside configured scope: Agent transfers to appropriate agent or acknowledges limitation

### Latency Management

For operations that take time to complete:
- Natural filler phrases during processing
- Status updates for longer operations
- Typing sound effects
- Reduces perceived wait time and silence

### Human Escalation

Paths can connect to human agents:
- When automation cannot resolve the issue
- When customer requests human assistance
- Configured as another agent node with special handling

## Workflow Lifecycle

### 1. Design Phase
- Drag agent nodes onto canvas
- Configure each agent's properties (instructions, tools, paths)
- Define how agents connect
- Name agents based on your use case

### 2. Test Phase
- Run chat-based simulations
- Test voice interactions
- Observe conversation flow
- Iterate on agent instructions and paths

### 3. Save Phase
- Workflow configuration stored in database
- Associated with customer account
- Can be versioned and modified

### 4. Deployment Phase
- Activate workflow
- Associate with phone number(s)
- Workflow goes live

### 5. Runtime Phase
- Call comes in → System loads customer's workflow configuration
- First agent (as defined by the workflow) initiates
- Conversation flows through configured network based on paths
- Call completes

### 6. Analytics Phase
- Review which paths were taken
- Analyze tool usage patterns
- Identify where conversations succeed or struggle
- Iterate on configuration

## Platform Benefits

### For Businesses

**Flexibility**: No pre-defined templates - configure agents exactly for your use case

**Scalability**: Start with one agent, expand to complex networks as needs grow

**Customization**: Every aspect of agent behavior is configurable through natural language

**No Technical Barriers**: Configure through visual interface and natural language, not code

**Iterative Improvement**: Test, analyze, and refine agent behavior based on real conversations

### For Customers

**No Repetition**: Information collected once and passed through transfers

**Contextual Help**: Agents understand the conversation history

**Natural Conversations**: Agents understand intent, not just keywords

**Efficient Resolution**: Get to the right help without navigating menus

**Consistent Experience**: Agents follow configured behavior reliably

## Use Case Examples

These examples show how different businesses would configure the same agent nodes for their specific needs.

### E-commerce Company

**Single Agent Setup:**
- One agent node configured with instructions covering orders, returns, and general questions
- Tools: Order lookup, initiate return, check shipping status
- Paths: Escalate to human if needed

**Multi-Agent Setup:**
- Agent 1: Orchestrator - understands what customer needs
- Agent 2: Order specialist - has tools for order management
- Agent 3: Returns specialist - has tools for processing returns
- Agent 4: Product specialist - helps with product questions

### Financial Services

**Multi-Agent Setup:**
- Agent 1: First contact - routes based on customer need
- Agent 2: Account services - has tools for balance checks, account updates
- Agent 3: Dispute handling - has tools for fraud reports, chargebacks
- Agent 4: Product information - no tools, just provides information

All agents share the same node properties, just configured differently.

### Healthcare Practice

**Single Agent Setup:**
- One agent configured for appointment management
- Tools: Check availability, book appointment, send confirmation
- Instructions cover the entire appointment flow

**Multi-Agent Setup:**
- Agent 1: Intake - collects patient information and understands need
- Agent 2: Scheduling - has tools for appointment booking
- Agent 3: Prescription - has tools for refill requests
- Agent 4: Billing - has tools for payment and insurance questions

### SaaS Company

**Multi-Agent Setup:**
- Agent 1: Triage - understands customer issue type
- Agent 2: Technical support - no tools, collects bug information
- Agent 3: Billing support - has tools for subscription management
- Agent 4: General questions - provides information about features

## Platform Differentiators

### Property-Based Configuration

The platform doesn't limit customers to pre-defined agent types or templates. Every agent is a blank canvas that customers configure for their exact use case.

**This means:**
- No forcing business processes into rigid templates
- Complete flexibility in how workflows are designed
- Easy to iterate - just change the configuration
- Same platform serves vastly different industries and use cases

### Agent-Based vs. Rule-Based Architecture

**Traditional Rule-Based Systems:**
- "Press 1 for billing, 2 for returns..."
- Rigid decision trees that can't adapt
- Cannot understand nuance or context
- Customer experience is frustrating and mechanical

**Our Agent-Based Approach:**
- Natural conversation understanding
- Context-aware decision making
- Flexible conversation flow
- Human-like interaction
- Customers configure behavior through natural language instructions

### Visual Workflow Design

Customers see and understand their entire conversation flow:
- Drag and drop agent nodes
- Draw connections (paths) between agents
- Configure properties in a form
- Test the flow before deployment
- No code or complex rules required

## Getting Started

1. **Create Account**: Sign up for the platform
2. **Access Workflows Tab**: Open the workflow editor
3. **Add Agent Nodes**: Drag agent nodes onto the canvas
4. **Configure First Agent**: 
   - Write instructions for what this agent should do
   - If it's orchestrating, define paths to other agents
   - If it's handling a specific task, add tools
5. **Connect Agents**: Create paths between agents
6. **Configure Path Properties**: Define when each path should be used
7. **Test Your Workflow**: Use chat and voice testing to validate behavior
8. **Iterate**: Refine instructions and paths based on test results
9. **Deploy**: Attach a phone number and activate
10. **Monitor**: Review analytics and continue improving

The platform empowers businesses to create sophisticated voice agent systems through simple, visual configuration, without requiring technical expertise or coding skills.

## Likely Stack (Give insights as to whether something else would be needed to make this possible apart from these)
Front end: React js
Backend: Livekit python agents
DB: Supabase