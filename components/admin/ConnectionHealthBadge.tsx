'use client';

import { Badge } from '../ui/badge';

interface ConnectionHealthBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionHealthBadge({
  score,
  showLabel = true,
  size = 'md',
}: ConnectionHealthBadgeProps) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 50) return 'Warning';
    return 'Critical';
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge className={`${getHealthColor(score)} ${sizeClasses[size]}`}>
      {showLabel ? `${getHealthLabel(score)} (${score})` : score}
    </Badge>
  );
}

