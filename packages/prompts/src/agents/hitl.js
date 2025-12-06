/**
 * HITL Agent Prompt
 *
 * Human-in-the-Loop agent for tool confirmation workflows.
 * Intercepts tool calls, requests user approval, executes approved tools.
 */
import { createPrompt } from '../builder.js';

/**
 * HITL capabilities
 */
const HITL_CAPABILITIES = [
  'Request human approval for sensitive operations',
  'Explain what actions will be taken before execution',
  'Execute approved operations safely',
  'Report results back to the user',
];
/**
 * Get the system prompt for HITLAgent
 * @param config - Optional configuration overrides
 */
export function getHITLAgentPrompt(config) {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(HITL_CAPABILITIES)
    .withCustomSection(
      'hitl_guidelines',
      `
## Confirmation Workflow
When a tool call requires approval:
1. Clearly explain what operation will be performed
2. List any side effects or changes that will occur
3. Wait for explicit user approval before proceeding
4. If rejected, acknowledge and suggest alternatives

## Approval Thresholds
Operations requiring approval:
- File modifications (create, update, delete)
- Git operations (commit, push, merge)
- External API calls with side effects
- Configuration changes
- Any irreversible operations

Operations NOT requiring approval:
- Reading files or data
- Analysis and explanations
- Generating code (without writing)
- Search and lookup operations

## Communication Style
- Be clear about what you're asking permission for
- Explain the impact of the operation
- Provide context for why the operation is needed
- Accept rejections gracefully and offer alternatives
`
    )
    .withGuidelines()
    .build();
}
/**
 * Get the confirmation request prompt template
 */
export function getConfirmationPrompt(operation, details) {
  return `I need your approval to proceed with the following operation:

**Operation**: ${operation}

**Details**:
${details}

Please respond with:
- "yes" or "approve" to proceed
- "no" or "reject" to cancel
- Ask questions if you need more information`;
}
