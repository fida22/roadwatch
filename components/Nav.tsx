'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/auth-context';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/lib/theme';
import NotificationBell from './NotificationBell';

const NAV_LINKS = [
  { href: '/',              label: 'Map',             exact: true },
  { href: '/dashboard',     label: 'Dashboard'                    },
  { href: '/planner',       label: 'Route planner'                },
  { href: '/complaints/new', label: 'Report issue'                },
  { href: '/complaints/track', label: 'Track complaint'              },
  { href: '/follows',       label: 'My works'                     },
  { href: '/saved-routes',  label: 'Saved routes'                 },
  { href: '/dept',          label: 'Dept portal'                  },
  { href: '/admin',         label: 'Admin'                        },
];

export default function Nav() {
  const { user, logout } = useApp();
  const { signOut } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    logout();
    await signOut();
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href : path === href || path.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur dark:bg-[#0f1923]/95 dark:border-[#2a3a4a]">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-brand font-bold text-lg shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3"/>
          </svg>
          RoadWatch
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-1 items-center gap-1">
          {NAV_LINKS.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Dark mode toggle */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-ink/50 dark:text-[#e8edf2]/50 select-none">
              ☀︎
            </span>
            <ThemeToggle />
            <span className="hidden sm:block text-xs text-ink/50 dark:text-[#e8edf2]/50 select-none">
              ☽
            </span>
          </div>

          <NotificationBell />

          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-ink/60 dark:text-[#e8edf2]/60 max-w-[120px] truncate">
                {user.name}
              </span>
              <button
                onClick={handleSignOut}
                className="btn-secondary !min-h-[36px] !px-3 !text-xs"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden md:block btn-primary !min-h-[36px] !px-4 !text-xs">
              Sign in
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="md:hidden btn-ghost !min-h-[36px] !px-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-line dark:border-[#2a3a4a] bg-white dark:bg-[#0f1923] px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block nav-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-line dark:border-[#2a3a4a]">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/60 dark:text-[#e8edf2]/60 truncate">{user.name}</span>
                <button onClick={async () => { await handleSignOut(); setOpen(false); }} className="btn-secondary !min-h-[36px] !px-3 !text-xs">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="btn-primary block text-center">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
