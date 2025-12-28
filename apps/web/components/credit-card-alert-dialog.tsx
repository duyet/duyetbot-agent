import type { ReactNode } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CreditCardAlertDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Alert dialog shown when Vercel AI Gateway requires a valid credit card.
 * Provides a link to activate AI Gateway with a credit card.
 */
export function CreditCardAlertDialog({
	open,
	onOpenChange,
}: CreditCardAlertDialogProps) {
	const handleActivate = () => {
		window.open(
			"https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
			"_blank",
		);
		window.location.href = "/";
	};

	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
					<AlertDialogDescription>
						This application requires{" "}
						{process.env.NODE_ENV === "production" ? "the owner" : "you"} to
						activate Vercel AI Gateway.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleActivate}>
						Activate
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
