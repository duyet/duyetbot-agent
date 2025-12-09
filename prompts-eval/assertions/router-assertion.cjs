/**
 * Custom assertion for router classification
 * Maps JSON classification response to agent name for comparison
 *
 * This assertion:
 * 1. Parses the LLM's JSON response (handles markdown code blocks)
 * 2. Maps classification fields (category, type, complexity) to agent name
 * 3. Compares against expected agent name in context.vars.__expected
 * 4. Returns pass/fail with reason
 */
module.exports = (output, context) => {
  try {
    // Clean JSON from various markdown code block formats
    let cleaned = output;

    // Remove ```json ... ``` blocks (with or without newlines)
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.trim();

    // If still wrapped in backticks, remove them
    if (cleaned.startsWith('`') && cleaned.endsWith('`')) {
      cleaned = cleaned.slice(1, -1);
    }

    const json = JSON.parse(cleaned);

    const category = json.category?.toLowerCase() || '';
    const type = json.type?.toLowerCase() || '';
    const complexity = json.complexity?.toLowerCase() || '';

    // Map to agent name using the same logic as router-provider.ts extractAgentName()
    let agentName;

    if (category === 'duyet') {
      agentName = 'duyet-info-agent';
    } else if (category === 'research') {
      agentName = 'lead-researcher-agent';
    } else if (type === 'complex' || complexity === 'high') {
      agentName = 'orchestrator-agent';
    } else if (category === 'github') {
      agentName = 'orchestrator-agent';
    } else if (category === 'code' && complexity !== 'low') {
      agentName = 'orchestrator-agent';
    } else {
      agentName = 'simple-agent';
    }

    const expected = context.vars.__expected || '';
    const pass = agentName === expected;

    return {
      pass,
      score: pass ? 1 : 0,
      reason: pass
        ? `Correctly classified as ${agentName}`
        : `Classified as ${agentName}, expected ${expected}. JSON: ${JSON.stringify(json)}`,
    };
  } catch (e) {
    return {
      pass: false,
      score: 0,
      reason: `Failed to parse JSON response: ${e.message}. Raw output: ${output.substring(0, 300)}`,
    };
  }
};
