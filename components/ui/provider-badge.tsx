'use client';

import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProviderBadgeProps {
  provider: string; // e.g., "tink", "bunq"
  connectionName?: string;
  connectionId?: string;
  showLink?: boolean;
  className?: string;
}

// Provider color mapping based on banking_providers table
const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  tink: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
  },
  plaid: {
    bg: 'bg-green-100',
    text: 'text-green-800',
  },
  // Default fallback
  default: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
  },
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  tink: 'Tink',
  plaid: 'Plaid',
};

export function ProviderBadge({
  provider,
  connectionName,
  connectionId,
  showLink = true,
  className,
}: ProviderBadgeProps) {
  const providerKey = provider?.toLowerCase() || 'default';
  const colors = PROVIDER_COLORS[providerKey] || PROVIDER_COLORS.default;
  const displayName = PROVIDER_NAMES[providerKey] || provider || 'Provider';

  const badgeContent = (
    <Badge
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1',
        colors.bg,
        colors.text,
        'border-0 font-medium',
        className
      )}
    >
      <LinkIcon className="h-3 w-3" />
      <span>{displayName}</span>
    </Badge>
  );

  if (showLink && connectionId) {
    return (
      <Link
        href={`/connections/${connectionId}`}
        className="hover:opacity-80 transition-opacity"
        title={connectionName ? `View connection: ${connectionName}` : 'View connection'}
      >
        {badgeContent}
      </Link>
    );
  }

  return badgeContent;
}

