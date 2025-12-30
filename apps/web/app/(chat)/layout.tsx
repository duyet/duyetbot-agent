import { CommandPalette } from "@/components/command-palette";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts";
import { SidebarWrapper } from "@/components/sidebar-wrapper";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<DataStreamProvider>
			<SidebarWrapper>{children}</SidebarWrapper>
			<KeyboardShortcutsDialog />
			<CommandPalette />
		</DataStreamProvider>
	);
}
