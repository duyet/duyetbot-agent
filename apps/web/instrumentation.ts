import { registerOTel } from "@vercel/otel";

export function register() {
  // Skip OTel registration in development to avoid webpack runtime errors
  // The instrumentation conflicts with Next.js dev mode hot reloading
  if (process.env.NODE_ENV === "development") {
    return;
  }

  registerOTel({
    serviceName: "ai-chatbot",
  });
}
