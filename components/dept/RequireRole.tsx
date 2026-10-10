"use client";
// Client-side role routing (A1). The real protection is P1's API check; this keeps residents out of the screens.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Loading } from "./ui";

export default function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);

  if (loading || !user) return <Loading label="Checking your session" />;

  if (!roles.includes(user.role))
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="panel" role="alert">
          <h1 className="text-lg font-semibold">This area is for department staff</h1>
          <p className="mt-1 text-sm text-ink/70">Your account is a {user.role} account and can&apos;t open this page.</p>
          <Link className="btn-primary mt-4" href="/">Back to the map</Link>
        </div>
      </main>
    );

  if (user.role === "department" && user.department && !user.department.approved)
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="panel" role="status">
          <h1 className="text-lg font-semibold">Waiting for approval</h1>
          <p className="mt-1 text-sm text-ink/70">An admin needs to approve {user.department.name} before you can add or edit work.</p>
        </div>
      </main>
    );

  return <>{children}</>;
}
