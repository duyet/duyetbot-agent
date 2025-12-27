"use client";

import { logout } from "@/lib/api-client";

export const SignOutForm = () => {
	return (
		<button
			className="w-full px-1 py-0.5 text-left text-red-500"
			onClick={logout}
			type="button"
		>
			Sign out
		</button>
	);
};
