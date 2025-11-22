/**
 * Cloudflare Workers entry point for Telegram Bot
 *
 * Uses OpenRouter via Cloudflare AI Gateway (OpenAI-compatible format).
 */

export interface Env {
  // Required
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  // AI Gateway (Cloudflare) - OpenRouter endpoint, no auth needed
  AI_GATEWAY_URL: string;

  // Optional
  ALLOWED_USERS?: string;
  MODEL?: string;
}

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

const SYSTEM_PROMPT = `You are @duyetbot, a helpful AI assistant on Telegram.

You help users with:
- Answering questions clearly and concisely
- Writing, explaining, and debugging code
- Research and analysis
- Task planning and organization

Guidelines:
- Keep responses concise for mobile reading
- Use markdown formatting when helpful
- Be friendly and helpful

Current conversation is via Telegram chat.`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify webhook secret
    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (
      env.TELEGRAM_WEBHOOK_SECRET &&
      secretHeader !== env.TELEGRAM_WEBHOOK_SECRET
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const update = (await request.json()) as TelegramUpdate;

      const message = update.message;
      if (!message?.text || !message.from) {
        return new Response("OK", { status: 200 });
      }

      const userId = message.from.id;
      const chatId = message.chat.id;
      const text = message.text;

      // Check allowed users
      if (env.ALLOWED_USERS) {
        const allowed = env.ALLOWED_USERS.split(",")
          .map((id) => Number.parseInt(id.trim(), 10))
          .filter((id) => !Number.isNaN(id));
        if (allowed.length > 0 && !allowed.includes(userId)) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Sorry, you are not authorized.",
          );
          return new Response("OK", { status: 200 });
        }
      }

      // Handle commands
      if (text.startsWith("/start")) {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Hello! I'm @duyetbot. Send me a message and I'll help you out.",
        );
        return new Response("OK", { status: 200 });
      }

      if (text.startsWith("/help")) {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Commands:\n/start - Start bot\n/help - Show help\n\nJust send me any message!",
        );
        return new Response("OK", { status: 200 });
      }

      // Send typing indicator
      await sendChatAction(env.TELEGRAM_BOT_TOKEN, chatId, "typing");

      // Call OpenRouter via AI Gateway (OpenAI-compatible format)
      const response = await fetch(env.AI_GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.MODEL || "anthropic/claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("AI Gateway error:", error);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      // Extract response text
      const responseText =
        data.choices?.[0]?.message?.content ||
        "Sorry, I could not generate a response.";

      // Send response
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  },
};

async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

async function sendChatAction(
  token: string,
  chatId: number,
  action: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action,
    }),
  });
}
