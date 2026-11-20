import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600",
    secondary:
        "bg-surface text-ink border border-border hover:bg-background focus-visible:outline-primary-600",
    danger: "bg-danger-700 text-white hover:bg-danger-800 focus-visible:outline-danger-700",
};

// Shared with any element that should look like a Button (e.g. a react-router Link
// used for page navigation instead of form submission).
export function buttonClasses(variant: ButtonVariant = "primary", className = "") {
    return `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm leading-normal font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`;
}

function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
    return (
        <button className={buttonClasses(variant, className)} {...rest}>
            {children}
        </button>
    );
}

export default Button;
