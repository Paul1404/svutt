import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();

  return (
    <div className="min-h-screen">
      {session && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="font-semibold">
                SVUTT Admin
              </Link>
              <nav className="text-sm text-slate-600 flex gap-4">
                <Link href="/admin">Turniere</Link>
                <Link href="/" target="_blank" rel="noreferrer">
                  Public ↗
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>Angemeldet als {session.sub}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
