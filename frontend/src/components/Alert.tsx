import type { ReactNode } from "react";

type AlertVariant = "success" | "error" | "warning";

interface AlertProps {
    variant: AlertVariant;
    children: ReactNode;
    className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
    success: "bg-success-50 text-success-800 border-success-200",
    error: "bg-danger-50 text-danger-700 border-danger-200",
    warning: "bg-warning-50 text-warning-900 border-warning-300",
};

function Alert({ variant, children, className = "" }: AlertProps) {
    return (
        <div
            role={variant === "error" ? "alert" : "status"}
            className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${variantClasses[variant]} ${className}`}
        >
            {children}
        </div>
    );
}

export default Alert;
