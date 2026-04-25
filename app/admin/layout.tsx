import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { AdminAutoRefresh } from "@/components/admin/AdminAutoRefresh";
import { ClubMark } from "@/components/ClubMark";
import { ExternalLink } from "@/components/Icon";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();

  return (
    <ToastProvider>
    <ConfirmProvider>
    <div className="min-h-screen bg-page-2">
      {session && <AdminAutoRefresh />}
      {session && (
        <header className="sticky top-0 z-20 border-b border-ink-200/80 bg-surface/80 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-8 min-w-0">
              <Link
                href="/admin"
                className="flex items-center gap-2.5 font-semibold tracking-tight min-w-0"
              >
                <ClubMark size="sm" showLabel={false} />
                <span className="truncate">SV Untereuerheim</span>
                <span className="text-xs font-medium text-ink-400 px-1.5 py-0.5 rounded bg-ink-100 shrink-0">
                  Admin
                </span>
              </Link>
              <nav aria-label="Admin-Navigation" className="hidden md:flex text-sm text-ink-600 gap-5 font-medium">
                <Link
                  href="/admin"
                  className="hover:text-brand-600 transition-colors"
                >
                  Turniere
                </Link>
                <Link
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-brand-600 transition-colors inline-flex items-center gap-1"
                >
                  Öffentliche Ansicht
                  <ExternalLink size={12} />
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 text-sm">
              <span className="hidden sm:inline text-ink-500 truncate max-w-[12ch]">
                {session.sub}
              </span>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>
      )}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
        {children}
      </main>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}
