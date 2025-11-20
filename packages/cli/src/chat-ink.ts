/**
 * Ink-based Chat
 *
 * Terminal UI chat using Ink
 */

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import type { ChatOptions } from './chat.js';

/**
 * Start Ink-based chat interface
 */
export async function startInkChat(options: ChatOptions): Promise<void> {
  const appProps: Parameters<typeof App>[0] = {
    mode: options.mode,
    sessionsDir: options.sessionsDir,
  };
  if (options.sessionId) {
    appProps.sessionId = options.sessionId;
  }
  if (options.mcpServerUrl) {
    appProps.mcpServerUrl = options.mcpServerUrl;
  }

  const { waitUntilExit } = render(React.createElement(App, appProps));

  await waitUntilExit();
}
