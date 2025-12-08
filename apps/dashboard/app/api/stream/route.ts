import { NextRequest } from 'next/server';
import { type Env, getDB } from '@/lib/db';

// Use Node.js runtime for SSE - edge runtime requires separate bundling in OpenNext
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE (Server-Sent Events) stream for real-time dashboard updates.
 *
 * Supports filtering by event types via query params:
 * - ?types=message,event,step (comma-separated)
 *
 * Event format:
 * event: <type>
 * data: <json>
 * id: <event_id>
 */
export async function GET(request: NextRequest) {
  const env = (request as any).cf?.env as Env;
  const searchParams = request.nextUrl.searchParams;
  const eventTypes = searchParams.get('types')?.split(',') ?? ['message', 'event', 'step'];

  // Track last seen timestamps for each event type
  let lastMessageTime = Date.now();
  let lastStepTime = Date.now();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(
          formatSSE({
            event: 'connected',
            data: {
              types: eventTypes,
              timestamp: Date.now(),
            },
          })
        )
      );

      // Polling interval (in ms)
      const POLL_INTERVAL = 2000;
      const HEARTBEAT_INTERVAL = 30000;
      let lastHeartbeat = Date.now();

      const poll = async () => {
        try {
          // Send heartbeat to keep connection alive
          if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL) {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
            lastHeartbeat = Date.now();
          }

          if (!env?.DB) {
            // No DB, send mock events for development
            controller.enqueue(
              encoder.encode(
                formatSSE({
                  event: 'system',
                  data: { status: 'no_database', message: 'Database not configured' },
                })
              )
            );
            return;
          }

          const db = getDB(env);

          // Poll for new messages
          if (eventTypes.includes('message')) {
            try {
              const messages = await db.messages.getRecentMessages({
                limit: 10,
                since: lastMessageTime,
              });

              for (const msg of messages) {
                controller.enqueue(
                  encoder.encode(
                    formatSSE({
                      event: 'message',
                      id: msg.messageId,
                      data: {
                        id: msg.messageId,
                        sessionId: msg.sessionId,
                        role: msg.role,
                        content: msg.content.slice(0, 200), // Truncate for stream
                        platform: msg.platform,
                        userId: msg.userId,
                        inputTokens: msg.inputTokens,
                        outputTokens: msg.outputTokens,
                        createdAt: msg.createdAt,
                      },
                    })
                  )
                );

                if (msg.createdAt > lastMessageTime) {
                  lastMessageTime = msg.createdAt;
                }
              }
            } catch {
              // Ignore errors, continue polling
            }
          }

          // Poll for new agent steps
          if (eventTypes.includes('step') || eventTypes.includes('event')) {
            try {
              const steps = await db.steps.getRecentSteps(10);

              for (const step of steps) {
                if (step.createdAt > lastStepTime) {
                  controller.enqueue(
                    encoder.encode(
                      formatSSE({
                        event: 'step',
                        id: step.stepId,
                        data: {
                          id: step.stepId,
                          eventId: step.eventId,
                          agentName: step.agentName,
                          agentType: step.agentType,
                          status: step.status,
                          durationMs: step.durationMs,
                          inputTokens: step.inputTokens,
                          outputTokens: step.outputTokens,
                          createdAt: step.createdAt,
                        },
                      })
                    )
                  );

                  if (step.createdAt > lastStepTime) {
                    lastStepTime = step.createdAt;
                  }
                }
              }
            } catch {
              // Ignore errors, continue polling
            }
          }
        } catch (error) {
          // Send error event but keep stream alive
          controller.enqueue(
            encoder.encode(
              formatSSE({
                event: 'error',
                data: { message: error instanceof Error ? error.message : 'Unknown error' },
              })
            )
          );
        }
      };

      // Start polling loop
      const intervalId = setInterval(poll, POLL_INTERVAL);

      // Initial poll
      await poll();

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Format data as SSE event
 */
function formatSSE(params: { event?: string; id?: string; data: unknown }): string {
  let result = '';

  if (params.event) {
    result += `event: ${params.event}\n`;
  }

  if (params.id) {
    result += `id: ${params.id}\n`;
  }

  result += `data: ${JSON.stringify(params.data)}\n\n`;

  return result;
}
