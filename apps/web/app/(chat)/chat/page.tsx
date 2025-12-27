import { Suspense } from "react";

import { ChatPage } from "./chat-page";

// Force static export
export const dynamic = "force-static";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatPage />
    </Suspense>
  );
}
