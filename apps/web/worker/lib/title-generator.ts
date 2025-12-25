import { generateText } from 'ai';

export async function generateTitleFromMessage(env: any, message: string): Promise<string> {
  const { text } = await generateText({
    model: env.AI('xiaomi/mimo-v2-flash:free'),
    prompt: `Generate a concise, descriptive title (max 50 characters) for a chat that starts with this message:\n\n"${message.slice(0, 500)}"\n\nRespond with ONLY the title, no quotes or extra text.`,
  });

  return text.slice(0, 50) || 'New Chat';
}
