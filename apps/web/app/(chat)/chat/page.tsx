import { Suspense } from "react";

import { ChatSkeleton } from "@/components/chat-skeleton";
import { ChatPage } from "./chat-page";

// Force static export
export const dynamic = "force-static";

export default function Page() {
	return (
		<Suspense fallback={<ChatSkeleton />}>
			<ChatPage />
		</Suspense>
	);
}
