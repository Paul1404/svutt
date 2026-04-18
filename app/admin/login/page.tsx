import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";
import { ClubMark } from "@/components/ClubMark";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/admin");
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="flex flex-col items-center gap-3 mb-8"
        >
          <ClubMark size="lg" showLabel={false} />
          <div className="text-center">
            <div className="font-semibold tracking-tight text-lg">
              SV Untereuerheim
            </div>
            <div className="text-xs text-ink-500">Tischtennis-Turniere</div>
          </div>
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
