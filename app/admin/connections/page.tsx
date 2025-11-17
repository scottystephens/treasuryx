'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectionHealthBadge } from '@/components/admin/ConnectionHealthBadge';
import {
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

interface Connection {
  connection_id: string;
  tenant_id: string;
  tenant_name: string;
  connection_name: string;
  provider: string | null;
  status: string;
  sync_schedule: string;
  health_score: number;
  last_sync_at: string | null;
  next_sync_at: string | null;
  consecutive_failures: number;
  jobs_last_24_hours: number;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const res = await fetch('/api/admin/connections');
      const data = await res.json();
      if (data.success) {
        setConnections(data.connections);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  }

  // Debounced filtering effect
  useEffect(() => {
    setFiltering(true);
    const timer = setTimeout(() => {
      setFiltering(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm, filterStatus]);

  async function handleSync(connectionId: string, provider: string, tenantId: string) {
    if (!provider) return;
    
    setSyncing(connectionId);
    try {
      const res = await fetch('/api/admin/orchestration/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, provider, tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Sync triggered successfully!');
        await loadConnections();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      alert('Failed to trigger sync');
    } finally {
      setSyncing(null);
    }
  }

  const filteredConnections = connections.filter((conn) => {
    const matchesSearch =
      conn.connection_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' || conn.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Connections</h1>
          <p className="text-gray-600 mt-2">
            Monitor all data connections across all tenants
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search connections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Connections Table */}
        <Card className="relative">
          {(loading || filtering) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <div className="flex flex-col items-center space-y-2">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">
                  {loading ? 'Loading connections...' : 'Filtering...'}
                </span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Connection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Health
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sync
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredConnections.length === 0 && !loading && !filtering ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No connections found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredConnections.map((conn) => (
                    <tr key={conn.connection_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {conn.connection_name}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {conn.connection_id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {conn.tenant_name}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="bg-blue-100 text-blue-800">
                          {conn.provider || 'csv'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                        {conn.sync_schedule}
                      </td>
                      <td className="px-6 py-4">
                        <ConnectionHealthBadge score={conn.health_score} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {conn.last_sync_at
                          ? new Date(conn.last_sync_at).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {conn.provider && (
                          <button
                            onClick={() => handleSync(conn.connection_id, conn.provider!, conn.tenant_id)}
                            disabled={syncing === conn.connection_id}
                            className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${
                                syncing === conn.connection_id ? 'animate-spin' : ''
                              }`}
                            />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

