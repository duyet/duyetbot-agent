/**
 * Manual API Test Suite
 * Run with: bun run tests/manual/manual-api-test.ts
 */

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message: string, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.cyan}${"=".repeat(50)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${"=".repeat(50)}${colors.reset}\n`);
}

// Simple cookie storage
let sessionCookie = "";
let testChatId = "";
let testMessageId = "";

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    log(`✓ ${name}`, "green");
  } catch (error) {
    log(`✗ ${name}`, "red");
    log(`  Error: ${error}`, "red");
  }
}

// Helper to get HTTP status from fetch Response
function getStatusCode(response: Response): number {
  return response.status;
}

// Helper to parse JSON safely
async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  section("Chat API Manual Test Suite");

  // ========================================
  // Test 1: Create Chat as Guest
  // ========================================
  await test("POST /api/chat - Create guest chat", async () => {
    testChatId = crypto.randomUUID();
    testMessageId = crypto.randomUUID();

    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: testChatId,
        message: {
          id: testMessageId,
          role: "user",
          parts: [{ type: "text", text: "Hello! What is the capital of France?" }],
        },
        selectedChatModel: "xiaomi/mimo-v2-flash:free",
        selectedVisibilityType: "private",
      }),
    });

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    // Extract session cookie
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (match) sessionCookie = `session=${match[1]}`;
    }

    log(`  Created chat ID: ${testChatId}`, "blue");
    log(`  Session cookie: ${sessionCookie ? "Set" : "Not set"}`, "blue");
  });

  // ========================================
  // Test 2: Get Chat History
  // ========================================
  await test("GET /api/history - Fetch chat history", async () => {
    await new Promise((r) => setTimeout(r, 1000)); // Wait for DB

    const response = await fetch(`${API_URL}/api/history`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    if (data.error && data.code === "unauthorized") {
      throw new Error("Unauthorized");
    }

    log(`  Found ${data.chats?.length || 0} chats`, "blue");
  });

  // ========================================
  // Test 3: Get Specific Chat
  // ========================================
  await test(`GET /api/chat/:id - Fetch specific chat`, async () => {
    const response = await fetch(`${API_URL}/api/chat/${testChatId}`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    if (data.error) throw new Error(data.error);

    log(`  Chat title: "${data.title}"`, "blue");
    log(`  Messages: ${data.messages?.length || 0}`, "blue");
  });

  // ========================================
  // Test 4: Generate Title
  // ========================================
  await test("POST /api/chat/title - Generate AI title", async () => {
    const response = await fetch(`${API_URL}/api/chat/title`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        chatId: testChatId,
        message: "What is the capital of France?",
      }),
    });

    const data = await parseJson(response);
    if (data.error) throw new Error(data.error);

    log(`  Generated title: "${data.title}"`, "blue");
  });

  // ========================================
  // Test 5: Send Second Message
  // ========================================
  await test("POST /api/chat - Send second message", async () => {
    const secondMessageId = crypto.randomUUID();

    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        id: testChatId,
        message: {
          id: secondMessageId,
          role: "user",
          parts: [{ type: "text", text: "What about Germany?" }],
        },
        selectedChatModel: "xiaomi/mimo-v2-flash:free",
        selectedVisibilityType: "private",
      }),
    });

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    // Read some of the stream
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let chunks = 0;
      for (let i = 0; i < 5; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        if (text.length > 0) chunks++;
      }
      reader.releaseLock();
      log(`  Stream chunks received: ${chunks}`, "blue");
    }
  });

  // ========================================
  // Test 6: Verify Chat Updated
  // ========================================
  await test("GET /api/chat/:id - Verify messages added", async () => {
    await new Promise((r) => setTimeout(r, 2000)); // Wait for processing

    const response = await fetch(`${API_URL}/api/chat/${testChatId}`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    log(`  Total messages: ${data.messages?.length || 0}`, "blue");

    // List messages
    if (data.messages) {
      data.messages.forEach((m: any, i: number) => {
        const text = m.parts?.[0]?.text || "(no text)";
        log(`    [${i + 1}] ${m.role}: "${text.substring(0, 50)}..."`, "blue");
      });
    }
  });

  // ========================================
  // Test 7: Change Visibility
  // ========================================
  await test("PATCH /api/chat/visibility - Change to public", async () => {
    const response = await fetch(`${API_URL}/api/chat/visibility`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        chatId: testChatId,
        visibility: "public",
      }),
    });

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    const data = await parseJson(response);
    log(`  New visibility: ${data.visibility}`, "blue");
  });

  // ========================================
  // Test 8: Delete Trailing Messages
  // ========================================
  await test("DELETE /api/chat/messages/trailing - Remove trailing", async () => {
    // First get the first message ID to delete after it
    const chatResponse = await fetch(`${API_URL}/api/chat/${testChatId}`, {
      headers: { Cookie: sessionCookie },
    });
    const chatData = await parseJson(chatResponse);
    const firstMessage = chatData.messages?.[0];
    if (!firstMessage) throw new Error("No messages found");

    const response = await fetch(`${API_URL}/api/chat/messages/trailing`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        messageId: firstMessage.id,
      }),
    });

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    log(`  Deleted messages after messageId: ${firstMessage.id}`, "blue");
  });

  // ========================================
  // Test 9: Verify Deletion
  // ========================================
  await test("GET /api/chat/:id - Verify deletion", async () => {
    const response = await fetch(`${API_URL}/api/chat/${testChatId}`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    log(`  Remaining messages: ${data.messages?.length || 0}`, "blue");
  });

  // ========================================
  // Test 10: Create Another Chat
  // ========================================
  await test("POST /api/chat - Create second chat", async () => {
    const chatId2 = crypto.randomUUID();
    const messageId2 = crypto.randomUUID();

    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        id: chatId2,
        message: {
          id: messageId2,
          role: "user",
          parts: [{ type: "text", text: "Tell me about Python programming" }],
        },
        selectedChatModel: "xiaomi/mimo-v2-flash:free",
        selectedVisibilityType: "private",
      }),
    });

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    log(`  Created chat 2 ID: ${chatId2}`, "blue");
  });

  // ========================================
  // Test 11: Get History Again
  // ========================================
  await test("GET /api/history - Verify multiple chats", async () => {
    await new Promise((r) => setTimeout(r, 1000));

    const response = await fetch(`${API_URL}/api/history`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    const count = data.chats?.length || 0;
    log(`  Total chats in history: ${count}`, "blue");

    // List all chats
    data.chats?.forEach((c: any) => {
      log(`    - ${c.id}: "${c.title}" (${c.visibility})`, "blue");
    });
  });

  // ========================================
  // Test 12: Delete Chat
  // ========================================
  await test("DELETE /api/chat - Delete chat", async () => {
    const response = await fetch(
      `${API_URL}/api/chat?id=${testChatId}`,
      {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }
    );

    const status = getStatusCode(response);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    log(`  Deleted chat ${testChatId}`, "blue");
  });

  // ========================================
  // Test 13: Verify Deletion in History
  // ========================================
  await test("GET /api/history - Verify chat removed", async () => {
    await new Promise((r) => setTimeout(r, 500));

    const response = await fetch(`${API_URL}/api/history`, {
      headers: { Cookie: sessionCookie },
    });

    const data = await parseJson(response);
    const remaining = data.chats?.length || 0;
    log(`  Remaining chats: ${remaining}`, "blue");

    // Verify our deleted chat is not in the list
    const deletedExists = data.chats?.some((c: any) => c.id === testChatId);
    if (deletedExists) {
      throw new Error("Deleted chat still in history!");
    }
  });

  section("Test Complete");
}

main().catch((error) => {
  log(`Fatal error: ${error}`, "red");
  process.exit(1);
});
