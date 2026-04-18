"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setError(data.error ?? "Login hat nicht geklappt.");
            return;
          }
          router.push("/admin");
          router.refresh();
        } catch {
          setError("Keine Verbindung. Bitte nochmal versuchen.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="username">
          Benutzername
        </label>
        <input
          id="username"
          className="input"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <div
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700"
          role="alert"
        >
          {error}
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  );
}
