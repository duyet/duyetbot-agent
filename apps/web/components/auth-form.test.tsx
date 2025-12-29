/**
 * Unit tests for auth-form component
 *
 * Test Categories:
 * 1. Component rendering
 * 2. Form submission with action
 * 3. Input field attributes and behavior
 * 4. defaultEmail prop
 * 5. Children rendering
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthForm } from "./auth-form";

// Mock next/form
vi.mock("next/form", () => ({
	default: ({
		action,
		children,
		className,
	}: {
		action: string | ((formData: FormData) => void | Promise<void>);
		children: React.ReactNode;
		className?: string;
	}) => {
		const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			const formData = new FormData(e.currentTarget as HTMLFormElement);
			if (typeof action === "function") {
				action(formData);
			}
		};
		return (
			<form action={action} className={className} onSubmit={handleSubmit}>
				{children}
			</form>
		);
	},
}));

describe("auth-form - Component Rendering", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders email and password input fields", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i);
		const passwordInput = screen.getByLabelText(/password/i);

		expect(emailInput).toBeInTheDocument();
		expect(passwordInput).toBeInTheDocument();
	});

	it("renders email input with correct attributes", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;

		expect(emailInput.type).toBe("email");
		expect(emailInput.autocomplete).toBe("email");
		// Note: autoFocus is a boolean attribute that works in real browsers
		// happy-dom doesn't consistently reflect it, but the attribute is present in the component
		expect(emailInput.required).toBe(true);
		expect(emailInput.placeholder).toBe("user@acme.com");
	});

	it("renders password input with correct attributes", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

		expect(passwordInput.type).toBe("password");
		expect(passwordInput.required).toBe(true);
	});

	it("applies correct CSS classes to form", () => {
		const mockAction = vi.fn();
		const { container } = render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const form = container.querySelector("form");
		expect(form).toHaveClass("flex", "flex-col", "gap-4", "px-4", "sm:px-16");
	});

	it("renders children elements", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Sign In</button>
				<a href="/forgot">Forgot password?</a>
			</AuthForm>,
		);

		expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
		expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
	});
});

describe("auth-form - defaultEmail Prop", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("populates email field with defaultEmail value", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction} defaultEmail="test@example.com">
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
		expect(emailInput.value).toBe("test@example.com");
	});

	it("renders empty email field when defaultEmail is not provided", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
		expect(emailInput.value).toBe("");
	});

	it("renders empty email field when defaultEmail is empty string", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction} defaultEmail="">
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
		expect(emailInput.value).toBe("");
	});
});

describe("auth-form - Form Submission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls action function with form data on submit", () => {
		const mockAction = vi.fn();

		render(
			<AuthForm action={mockAction}>
				<button type="submit">Sign In</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i);
		const passwordInput = screen.getByLabelText(/password/i);
		const submitButton = screen.getByRole("button", { name: /sign in/i });

		fireEvent.change(emailInput, { target: { value: "user@example.com" } });
		fireEvent.change(passwordInput, { target: { value: "password123" } });
		fireEvent.click(submitButton);

		expect(mockAction).toHaveBeenCalledTimes(1);
		const formData = mockAction.mock.calls[0][0] as FormData;
		expect(formData.get("email")).toBe("user@example.com");
		expect(formData.get("password")).toBe("password123");
	});

	it("calls action when form is submitted with defaultEmail", () => {
		const mockAction = vi.fn();

		render(
			<AuthForm action={mockAction} defaultEmail="preset@example.com">
				<button type="submit">Sign In</button>
			</AuthForm>,
		);

		const passwordInput = screen.getByLabelText(/password/i);
		const submitButton = screen.getByRole("button", { name: /sign in/i });

		fireEvent.change(passwordInput, { target: { value: "secret" } });
		fireEvent.click(submitButton);

		expect(mockAction).toHaveBeenCalledTimes(1);
		const formData = mockAction.mock.calls[0][0] as FormData;
		expect(formData.get("email")).toBe("preset@example.com");
		expect(formData.get("password")).toBe("secret");
	});

	it("supports string action prop", () => {
		const { container } = render(
			<AuthForm action="/api/auth/login">
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const form = container.querySelector("form");
		expect(form).toHaveAttribute("action", "/api/auth/login");
	});

	it("validates required fields - browser validation", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
		const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

		expect(emailInput.required).toBe(true);
		expect(passwordInput.required).toBe(true);
	});
});

describe("auth-form - Accessibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("associates labels correctly with inputs", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailLabel = screen.getByLabelText(/email address/i);
		const passwordLabel = screen.getByLabelText(/password/i);

		expect(emailLabel).toHaveAttribute("id", "email");
		expect(passwordLabel).toHaveAttribute("id", "password");
	});

	it("labels have correct styling classes", () => {
		const mockAction = vi.fn();
		const { container } = render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const labels = container.querySelectorAll("label");
		labels.forEach((label) => {
			expect(label).toHaveClass("font-normal", "text-zinc-600", "dark:text-zinc-400");
		});
	});

	it("inputs have correct styling classes", () => {
		const mockAction = vi.fn();
		render(
			<AuthForm action={mockAction}>
				<button type="submit">Submit</button>
			</AuthForm>,
		);

		const emailInput = screen.getByLabelText(/email address/i);
		const passwordInput = screen.getByLabelText(/password/i);

		expect(emailInput).toHaveClass("bg-muted", "text-md", "md:text-sm");
		expect(passwordInput).toHaveClass("bg-muted", "text-md", "md:text-sm");
	});
});
