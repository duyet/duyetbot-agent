import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/middleware";

export const SignOutForm = () => {
  return (
    <form
      action={async () => {
        "use server";

        await clearSessionCookie();
        redirect("/");
      }}
      className="w-full"
    >
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        Sign out
      </button>
    </form>
  );
};
