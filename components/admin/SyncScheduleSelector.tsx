'use client';

interface SyncScheduleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const scheduleOptions = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'hourly', label: 'Every Hour' },
  { value: '4hours', label: 'Every 4 Hours' },
  { value: '12hours', label: 'Every 12 Hours' },
  { value: 'daily', label: 'Daily (2 AM)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Schedule' },
];

export function SyncScheduleSelector({
  value,
  onChange,
  disabled = false,
}: SyncScheduleSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      {scheduleOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

