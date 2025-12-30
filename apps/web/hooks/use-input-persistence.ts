import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "usehooks-ts";

interface UseInputPersistenceOptions {
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	onInputChange: (value: string) => void;
	adjustHeight: () => void;
	input: string;
}

interface UseInputPersistenceReturn {
	setLocalStorageInput: (value: string) => void;
	handleInputPersistence: () => void;
}

/**
 * Hook for managing chat input persistence across page refreshes.
 * Handles localStorage synchronization and hydration.
 */
export function useInputPersistence({
	textareaRef,
	onInputChange,
	adjustHeight,
	input,
}: UseInputPersistenceOptions): UseInputPersistenceReturn {
	const [, setLocalStorageInput] = useLocalStorage("input", "");

	// Track if we've hydrated from localStorage to prevent overwriting user input
	const hasHydrated = useRef(false);
	const localStorageInputRef = useRef<string>("");

	const handleInputPersistence = useCallback(() => {
		if (!hasHydrated.current && textareaRef.current) {
			const domValue = textareaRef.current.value;
			// Prefer DOM value over localStorage to handle hydration
			const finalValue = domValue || localStorageInputRef.current || "";
			onInputChange(finalValue);
			adjustHeight();
			hasHydrated.current = true;
		}
	}, [adjustHeight, onInputChange, textareaRef]);

	// Sync input changes to localStorage whenever input value changes
	useEffect(() => {
		if (hasHydrated.current) {
			setLocalStorageInput(input);
		}
	}, [input, setLocalStorageInput]);

	return {
		setLocalStorageInput,
		handleInputPersistence,
	};
}
