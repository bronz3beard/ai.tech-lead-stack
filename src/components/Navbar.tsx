'use client';

import { cn } from '@/lib/utils';
import { Globe, LayoutDashboard, LogIn, LogOut, Menu, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  { name: 'Global Dashboard', href: '/', icon: Globe },
  {
    name: 'User Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    protected: true,
  },
];

function avatarFallbackLetter(name?: string | null, email?: string | null) {
  const c = name?.trim()?.[0] ?? email?.trim()?.[0];
  return c ? c.toUpperCase() : '?';
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const activeLink = (href: string) => pathname === href;

  const filteredNavigation = navigation.filter(
    (item) => !item.protected || isAuthenticated
  );

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-foreground">
                <span className="text-blue-500">Tech</span>Dash
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                    activeLink(item.href)
                      ? 'border-blue-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 mr-2">
                  <span className="text-sm font-medium text-foreground hidden md:inline">
                    {session.user?.name}
                  </span>
                  {session.user?.image ? (
                    <div className="h-8 w-8 rounded-full overflow-hidden border border-border shrink-0">
                      <Image
                        src={session.user.image}
                        alt={session.user.name || session.user.email || 'User'}
                        width={32}
                        height={32}
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-8 w-8 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0"
                      aria-hidden
                    >
                      {avatarFallbackLetter(
                        session.user?.name,
                        session.user?.email
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-muted-foreground hover:text-foreground p-2 rounded-md"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/signin"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card-foreground/10 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-card border-b border-border animate-in slide-in-from-top duration-200">
          <div className="pt-2 pb-3 space-y-1">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block pl-3 pr-4 py-2 border-l-4 text-base font-medium',
                  activeLink(item.href)
                    ? 'bg-blue-500/10 border-blue-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:border-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center">
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-border">
            {isAuthenticated ? (
              <div className="space-y-1">
                <div className="px-4 flex items-center mb-3">
                  {session.user?.image ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-border shrink-0">
                      <Image
                        src={session.user.image}
                        alt={session.user.name || session.user.email || 'User'}
                        width={40}
                        height={40}
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0"
                      aria-hidden
                    >
                      {avatarFallbackLetter(
                        session.user?.name,
                        session.user?.email
                      )}
                    </div>
                  )}
                  <div className="ml-3">
                    <div className="text-base font-medium text-foreground">
                      {session.user?.name}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {session.user?.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                >
                  <div className="flex items-center">
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Link
                  href="/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 text-base font-medium text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                >
                  <div className="flex items-center">
                    <LogIn className="w-5 h-5 mr-3" />
                    Sign In
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
