'use client';

import { Badge } from '@/components/ui/badge';
import { Link, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountSourceIndicatorProps {
  isSynced: boolean;
  className?: string;
}

export function AccountSourceIndicator({
  isSynced,
  className,
}: AccountSourceIndicatorProps) {
  if (isSynced) {
    return (
      <Badge
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1',
          'bg-green-100 text-green-800 border-0 font-medium',
          className
        )}
        title="This account is synced from a banking provider"
      >
        <Link className="h-3 w-3" />
        <span>Synced</span>
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1',
        'bg-gray-100 text-gray-800 border-0 font-medium',
        className
      )}
      title="This account was created manually"
    >
      <Edit className="h-3 w-3" />
      <span>Manual</span>
    </Badge>
  );
}

