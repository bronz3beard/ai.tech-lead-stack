'use client';

import { cn } from '@/lib/utils';
import {
  BookOpen,
  Globe,
  Hammer,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';

export type NavItem = {
  name: string;
  href: string;
  icon?: React.ElementType;
  description?: string;
  protected?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      { name: 'Global Dashboard', href: '/', icon: Globe, description: 'View the global system overview.' },
      { name: 'How it Works', href: '/onboarding', icon: Sparkles, description: 'Learn about the platform features.' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { name: 'User Dashboard', href: '/dashboard', icon: LayoutDashboard, protected: true, description: 'Your personal workspace and metrics.' },
      { name: 'Agent Chat', href: '/chat', icon: MessageSquare, protected: true, description: 'Interact with AI agents directly.' },
    ],
  },
  {
    title: 'Development',
    items: [
      { name: 'Feature Discovery', href: '/feature-development/discovery', icon: Sparkles, protected: true, description: 'Discover new features.' },
      { name: 'In-Progress Features', href: '/feature-development/in-progress', icon: LayoutDashboard, protected: true, description: 'Track ongoing development.' },
      { name: 'Reflexion Loop ✨', href: '/reflexion', icon: RefreshCw, protected: true, description: 'Review and improve processes.' },
    ],
  },
  {
    title: 'Skills',
    items: [
      { name: 'Interlink Skills', href: '/skills/roles', icon: BookOpen, description: 'Explore available interlink skills.' },
      { name: 'Forge Skill', href: '/skills/new', icon: Hammer, protected: true, description: 'Create and forge new skills.' },
      { name: 'Solutioning', href: '/skills/solutioning', icon: Users, description: 'Facilitate a live, multi-role solutioning session.' },
    ],
  },
];

function avatarFallbackLetter(name?: string | null, email?: string | null) {
  const c = name?.trim()?.[0] ?? email?.trim()?.[0];
  return c ? c.toUpperCase() : '?';
}

function DesktopUserMenu({
  session,
  isAuthenticated,
}: {
  session: any;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/signin"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-3 mr-2">
        <span className="text-sm font-medium text-foreground hidden md:inline">
          {session?.user?.name}
        </span>
        {session?.user?.image ? (
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
            {avatarFallbackLetter(session?.user?.name, session?.user?.email)}
          </div>
        )}
      </div>
      <Link
        href="/settings"
        className="text-muted-foreground hover:text-foreground p-2 rounded-md"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-muted-foreground hover:text-foreground p-2 rounded-md"
        title="Sign Out"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}

function MobileUserMenu({
  session,
  isAuthenticated,
  setMobileMenuOpen,
}: {
  session: any;
  isAuthenticated: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  if (!isAuthenticated) {
    return (
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
    );
  }

  return (
    <div className="space-y-1">
      <div className="px-4 flex items-center mb-3">
        {session?.user?.image ? (
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
            {avatarFallbackLetter(session?.user?.name, session?.user?.email)}
          </div>
        )}
        <div className="ml-3">
          <div className="text-base font-medium text-foreground">
            {session?.user?.name}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {session?.user?.email}
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
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const activeLink = (href: string) => pathname === href;

  if (pathname === '/feature-development/discovery') {
    return null;
  }

  const filteredGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.protected || isAuthenticated),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-max mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-foreground pr-4">
                <span className="text-blue-500">Inter</span>link
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {filteredGroups.map((group) => (
                    <NavigationMenuItem key={group.title}>
                      <NavigationMenuTrigger className="bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50">
                        {group.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                          {group.items.map((item) => (
                            <li key={item.name}>
                              <NavigationMenuLink
                                render={
                                  <Link
                                    href={item.href}
                                    className={cn(
                                      'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted focus:bg-muted',
                                      activeLink(item.href) && 'bg-muted'
                                    )}
                                  />
                                }
                              >
                                <div className="flex items-center text-sm font-medium leading-none">
                                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                                  {item.name}
                                </div>
                                {item.description && (
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-2">
                                    {item.description}
                                  </p>
                                )}
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            <DesktopUserMenu
              session={session}
              isAuthenticated={isAuthenticated}
            />
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
            {filteredGroups.map((group) => (
              <div key={group.title} className="mb-4 last:mb-0">
                <div className="px-4 py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </div>
                {group.items.map((item) => (
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
                      {item.icon && <item.icon className="w-5 h-5 mr-3" />}
                      {item.name}
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-border">
            <MobileUserMenu
              session={session}
              isAuthenticated={isAuthenticated}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          </div>
        </div>
      )}
    </nav>
  );
}
