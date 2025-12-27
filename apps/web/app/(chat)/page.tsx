"use client";

import { Suspense, useState } from "react";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";

export default function Page() {
  const [chatId, _setChatId] = useState(() => generateUUID());

  return (
    <>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center">
            Loading...
          </div>
        }
      >
        <Chat
          autoResume={false}
          id={chatId}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
          initialVisibilityType="private"
          isReadonly={false}
          key={chatId}
        />
      </Suspense>
      <DataStreamHandler />
    </>
  );
}
