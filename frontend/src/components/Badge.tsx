import type { ReactNode } from "react";

type BadgeVariant = "primary" | "neutral" | "success" | "warning";

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
    primary: "bg-primary-50 text-primary-700",
    neutral: "bg-background text-ink-muted",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-800",
};

function Badge({ variant = "neutral", children }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
        >
            {children}
        </span>
    );
}

export default Badge;
