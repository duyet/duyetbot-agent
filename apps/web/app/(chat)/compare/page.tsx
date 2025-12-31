"use client";

import { useRouter } from "next/navigation";
import { ModelComparison } from "@/components/model-comparison";

export default function ComparePage() {
	const router = useRouter();

	return (
		<div className="h-dvh w-full">
			<ModelComparison
				onClose={() => {
					router.push("/");
				}}
			/>
		</div>
	);
}
