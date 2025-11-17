'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Link as LinkIcon,
  Activity,
  FileText,
  Heart,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNav = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Tenants', href: '/admin/tenants', icon: Users },
  { name: 'Connections', href: '/admin/connections', icon: LinkIcon },
  { name: 'Orchestration', href: '/admin/orchestration', icon: Activity },
  { name: 'Logs', href: '/admin/logs', icon: FileText },
  { name: 'Health', href: '/admin/health', icon: Heart },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b bg-amber-50">
          <Shield className="h-6 w-6 text-amber-600 mr-2" />
          <div>
            <h2 className="font-bold text-amber-900">Admin Dashboard</h2>
            <p className="text-xs text-amber-700">Super Admin Access</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {adminNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Back to App */}
        <div className="p-4 border-t">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to App</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

