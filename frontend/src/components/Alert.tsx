import type { ReactNode } from "react";

type AlertVariant = "success" | "error" | "warning";

interface AlertProps {
    variant: AlertVariant;
    children: ReactNode;
    className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
};

function Alert({ variant, children, className = "" }: AlertProps) {
    return (
        <div
            role={variant === "error" ? "alert" : "status"}
            className={`rounded-lg border px-3 py-2 text-sm ${variantClasses[variant]} ${className}`}
        >
            {children}
        </div>
    );
}

export default Alert;
