import type { HTMLAttributes, ReactNode } from "react";

type CardTone = "surface" | "lavender" | "peach" | "blush";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
    surface: "bg-surface",
    lavender: "bg-lavender",
    peach: "bg-peach",
    blush: "bg-blush",
};

function Card({ tone = "surface", className = "", children, ...rest }: CardProps) {
    return (
        <div
            className={`rounded-2xl border border-border p-4 shadow-sm sm:p-6 ${toneClasses[tone]} ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

export default Card;
