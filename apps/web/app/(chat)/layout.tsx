import Script from "next/script";
import { CommandPalette } from "@/components/command-palette";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts";
import { SidebarWrapper } from "@/components/sidebar-wrapper";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<Script
				src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
				strategy="beforeInteractive"
			/>
			<DataStreamProvider>
				<SidebarWrapper>{children}</SidebarWrapper>
				<KeyboardShortcutsDialog />
				<CommandPalette />
			</DataStreamProvider>
		</>
	);
}
