"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/auth-context";
import type { Role } from "@/lib/types";
import RequireRole from "./RequireRole";
import { DeptChip } from "./ui";

const NAV = [
  { href: "/dept", label: "My projects", exact: true },
  { href: "/dept/projects/new", label: "Add work" },
  { href: "/dept/complaints", label: "Complaints" },
  { href: "/dept/calendar", label: "Calendar" },
];

export default function DeptShell({ children, roles = ["department", "admin"] }: { children: React.ReactNode; roles?: Role[] }) {
  return (
    <RequireRole roles={roles}>
      <Frame>{children}</Frame>
    </RequireRole>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { logout } = useApp();
  const path = usePathname();
  const router = useRouter();
  const items = user?.role === "admin" ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-semibold text-brand">RoadWatch</Link>
          <div className="flex items-center gap-3 text-sm">
            {user?.department ? <DeptChip name={user.department.name} color={user.department.color} /> : <span className="text-xs font-medium">Admin</span>}
            <button className="btn-secondary !min-h-[36px] !px-3" onClick={async () => { logout(); await signOut(); router.replace("/login"); }}>Sign out</button>
          </div>
        </div>
        <nav aria-label="Department" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3">
          {items.map((i) => {
            const active = "exact" in i && i.exact ? path === i.href : path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${active ? "border-brand font-medium text-brand" : "border-transparent text-ink/70 hover:text-ink"}`}>
                {i.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
