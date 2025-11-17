'use client';

import { useEffect, useState } from 'react';
import { LogViewer } from '@/components/admin/LogViewer';
import { Card } from '@/components/ui/card';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';

interface LogEntry {
  id: string;
  created_at: string;
  connection_id: string;
  status: string;
  job_type: string;
  records_imported: number;
  records_failed: number;
  error_message?: string;
  summary?: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, [statusFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search filtering
  useEffect(() => {
    if (searchTerm) {
      setFiltering(true);
      const timer = setTimeout(() => {
        setFiltering(false);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setFiltering(false);
    }
  }, [searchTerm]);

  function exportLogs() {
    const csv = [
      ['Time', 'Status', 'Type', 'Imported', 'Failed', 'Error'].join(','),
      ...logs.map((log) =>
        [
          new Date(log.created_at).toISOString(),
          log.status,
          log.job_type,
          log.records_imported,
          log.records_failed,
          (log.error_message || '').replace(/,/g, ';'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.job_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.connection_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.error_message?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
            <p className="text-gray-600 mt-2">
              View and analyze ingestion job logs
            </p>
          </div>
          <button
            onClick={exportLogs}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Logs</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {logs.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {logs.filter((l) => l.status === 'completed').length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {logs.filter((l) => l.status === 'failed').length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {logs.length > 0
                ? Math.round(
                    (logs.filter((l) => l.status === 'completed').length /
                      logs.length) *
                      100
                  )
                : 0}
              %
            </div>
          </Card>
        </div>

        {/* Logs Viewer */}
        <div className="relative">
          {(loading || filtering) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <div className="flex flex-col items-center space-y-2">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">
                  {loading ? 'Loading logs...' : 'Filtering...'}
                </span>
              </div>
            </div>
          )}
          <LogViewer logs={filteredLogs} loading={false} />
        </div>
      </div>
    </div>
  );
}

