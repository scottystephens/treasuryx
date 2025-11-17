'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '../ui/card';

interface SystemMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    trend: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    trend: 'text-green-600',
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-600',
    trend: 'text-red-600',
  },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    trend: 'text-amber-600',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    trend: 'text-purple-600',
  },
};

export function SystemMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
}: SystemMetricCardProps) {
  const colors = colorClasses[color];

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center text-sm">
              <span
                className={
                  trend.positive === false ? 'text-red-600' : 'text-green-600'
                }
              >
                {trend.positive === false ? '↓' : '↑'} {Math.abs(trend.value)}%
              </span>
              <span className="ml-2 text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.bg}`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
      </div>
    </Card>
  );
}

