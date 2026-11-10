import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600",
    secondary:
        "bg-surface text-ink border border-border hover:bg-background focus-visible:outline-primary-600",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
};

function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}

export default Button;
