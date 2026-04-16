import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/admin");
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold mb-1">Admin-Login</h1>
        <p className="text-sm text-slate-500 mb-6">
          Melde dich mit den Zugangsdaten aus der .env-Datei an.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
