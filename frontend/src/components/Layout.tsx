import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";
import { APP_NAME } from "../constants/app";

interface LayoutProps {
    children: ReactNode;
}

function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const navLinkClass = (path: string) =>
        `hover:text-primary-600 ${location.pathname.startsWith(path) ? "font-semibold text-primary-700" : ""}`;

    return (
        <div className="flex min-h-svh flex-col bg-background text-ink">
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link to="/documents" className="text-lg font-semibold text-primary-700">
                        {APP_NAME}
                    </Link>
                    <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-ink-muted">
                        <Link to="/documents" className={navLinkClass("/documents")}>
                            เอกสารของฉัน
                        </Link>
                        <Link to="/dashboard" className={navLinkClass("/dashboard")}>
                            Dashboard
                        </Link>
                        <Button variant="secondary" onClick={handleLogout}>
                            ออกจากระบบ
                        </Button>
                    </nav>
                </div>
            </header>
            <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
                {children}
            </main>
        </div>
    );
}

export default Layout;
