import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/admin");
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 mb-8"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold shadow-pop">
            S
          </div>
          <span className="font-semibold tracking-tight text-lg">SVUTT</span>
        </Link>

        <div className="card p-7">
          <h1 className="text-xl font-semibold tracking-tight">
            Willkommen zurück
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Melde dich an, um Turniere zu verwalten.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          Zugangsdaten stehen in der .env-Datei.
        </p>
      </div>
    </div>
  );
}
