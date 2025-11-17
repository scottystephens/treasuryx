'use client';

import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ChevronDown, ChevronRight, Clock, AlertCircle } from 'lucide-react';

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

interface LogViewerProps {
  logs: LogEntry[];
  loading?: boolean;
}

export function LogViewer({ logs, loading = false }: LogViewerProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-500">Loading logs...</p>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No logs found</p>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const isExpanded = expandedLog === log.id;

        return (
          <Card key={log.id} className="overflow-hidden">
            <button
              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4 text-left">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                <span className="text-sm font-medium text-gray-700">
                  {log.job_type}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>✓ {log.records_imported} imported</span>
                {log.records_failed > 0 && (
                  <span className="text-red-600">✗ {log.records_failed} failed</span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-4 border-t bg-gray-50">
                <div className="mt-4 space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Job ID:</span>
                    <p className="text-sm text-gray-900 font-mono">{log.id}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">
                      Connection ID:
                    </span>
                    <p className="text-sm text-gray-900 font-mono">
                      {log.connection_id}
                    </p>
                  </div>
                  {log.error_message && (
                    <div>
                      <span className="text-xs font-medium text-red-600">Error:</span>
                      <p className="text-sm text-red-900 bg-red-50 p-2 rounded mt-1">
                        {log.error_message}
                      </p>
                    </div>
                  )}
                  {log.summary && (
                    <div>
                      <span className="text-xs font-medium text-gray-500">Summary:</span>
                      <pre className="text-xs text-gray-900 bg-white p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(log.summary, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

