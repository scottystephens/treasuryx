'use client';

import { ReactNode } from 'react';
import { Navigation } from '@/components/navigation';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}

