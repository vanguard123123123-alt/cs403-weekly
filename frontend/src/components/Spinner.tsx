interface SpinnerProps {
    className?: string;
}

function Spinner({ className = "" }: SpinnerProps) {
    return (
        <span
            role="status"
            aria-label="กำลังโหลด"
            className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-primary-600 ${className}`}
        />
    );
}

export default Spinner;
