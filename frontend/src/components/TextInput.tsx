import type { InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

function TextInput({ label, id, name, className = "", ...rest }: TextInputProps) {
    const inputId = id ?? name;

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-ink">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                name={name}
                className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline focus:outline-2 focus:outline-primary-200 ${className}`}
                {...rest}
            />
        </div>
    );
}

export default TextInput;
