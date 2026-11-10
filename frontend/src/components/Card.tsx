import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

function Card({ className = "", children, ...rest }: CardProps) {
    return (
        <div
            className={`rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6 ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

export default Card;
