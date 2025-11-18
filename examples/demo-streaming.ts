/**
 * Streaming demo - shows real-time LLM responses
 *
 * Requirements:
 * - Set ANTHROPIC_API_KEY environment variable
 * - Run: ANTHROPIC_API_KEY=sk-... npm run demo:stream
 */

import { Agent } from '@/agent/core';
import { ClaudeProvider } from '@/providers/claude';
import { FileSessionManager } from '@/storage/file-session-manager';
import { ToolRegistry } from '@/tools/registry';

async function main() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('\nUsage:');
    console.error('  ANTHROPIC_API_KEY=sk-ant-... npm run demo:stream');
    process.exit(1);
  }

  console.log('🤖 Streaming Demo\n');

  // Setup
  const sessionManager = new FileSessionManager();
  const provider = new ClaudeProvider();
  const toolRegistry = new ToolRegistry();

  provider.configure({
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const agent = new Agent({
    provider,
    sessionManager,
    toolRegistry,
  });

  // Create session
  const session = await agent.createSession({
    metadata: { demo: 'streaming', timestamp: new Date().toISOString() },
  });

  console.log(`📝 Session created: ${session.id}\n`);

  // Add user message
  await agent.addMessage(session.id, {
    role: 'user',
    content: 'Write a haiku about coding agents. Be creative!',
  });

  // Get messages for streaming
  const currentSession = await agent.getSession(session.id);
  const messages = currentSession?.messages || [];

  console.log('💬 User: Write a haiku about coding agents. Be creative!\n');
  console.log('🤖 Claude: ');

  // Stream response with real-time output
  let fullResponse = '';
  for await (const chunk of agent.sendMessage(session.id, messages)) {
    if (chunk.content) {
      process.stdout.write(chunk.content);
      fullResponse += chunk.content;
    }
  }

  console.log('\n\n✅ Streaming complete!');
  console.log(`📊 Response length: ${fullResponse.length} characters`);

  // Save assistant response
  await agent.addMessage(session.id, {
    role: 'assistant',
    content: fullResponse,
  });

  // Complete session
  await agent.completeSession(session.id);

  console.log(`\n💾 Session saved to: ~/.duyetbot/sessions/${session.id}.json`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
