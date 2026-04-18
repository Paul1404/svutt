"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-sm font-medium text-ink-600 hover:text-brand-600 transition-colors"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/admin/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Abmelden..." : "Abmelden"}
    </button>
  );
}
