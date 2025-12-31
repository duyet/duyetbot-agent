import { FileQuestion, Home, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background p-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-20 items-center justify-center rounded-full bg-muted">
					<FileQuestion className="size-10 text-muted-foreground" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">
						Page Not Found
					</h1>
					<p className="max-w-md text-sm text-muted-foreground">
						The page you're looking for doesn't exist or may have been moved.
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button asChild variant="default">
					<Link href="/">
						<Home className="mr-2 size-4" />
						Go home
					</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href="/">
						<MessageSquare className="mr-2 size-4" />
						Start chatting
					</Link>
				</Button>
			</div>
		</div>
	);
}
