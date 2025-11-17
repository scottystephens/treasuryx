'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ConnectionHealthBadge } from '@/components/admin/ConnectionHealthBadge';
import { SyncScheduleSelector } from '@/components/admin/SyncScheduleSelector';
import { Badge } from '@/components/ui/badge';
import { Save, RefreshCw, Activity } from 'lucide-react';

interface Connection {
  connection_id: string;
  tenant_name: string;
  connection_name: string;
  provider: string | null;
  sync_schedule: string;
  sync_enabled: boolean;
  health_score: number;
  consecutive_failures: number;
  jobs_last_24_hours: number;
  total_successful_jobs: number;
  total_failed_jobs: number;
  avg_duration_ms: number;
}

export default function OrchestrationPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const res = await fetch('/api/admin/connections');
      const data = await res.json();
      if (data.success) {
        // Show all connections, but prioritize those with providers
        const allConnections = data.connections || [];
        // Filter to show banking provider connections first, then all others
        setConnections(allConnections);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateSchedule(
    connectionId: string,
    schedule: string,
    enabled: boolean
  ) {
    setSaving(connectionId);
    try {
      const res = await fetch('/api/admin/orchestration/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            connection_id: connectionId,
            sync_schedule: schedule,
            sync_enabled: enabled,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadConnections();
      } else {
        alert(`Failed to update schedule: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Failed to update schedule');
    } finally {
      setSaving(null);
    }
  }

  const getSuccessRate = (conn: Connection) => {
    const total = conn.total_successful_jobs + conn.total_failed_jobs;
    if (total === 0) return 100;
    return Math.round((conn.total_successful_jobs / total) * 100);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Orchestration
          </h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Data Orchestration
          </h1>
          <p className="text-gray-600 mt-2">
            Manage sync schedules and monitor connection health
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Connections</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {connections.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Scheduled</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {
                connections.filter(
                  (c) => c.sync_enabled && c.sync_schedule !== 'manual'
                ).length
              }
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Avg Health Score</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {connections.length > 0
                ? Math.round(
                    connections.reduce((sum, c) => sum + (c.health_score || 100), 0) /
                      connections.length
                  )
                : 100}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">With Failures</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {
                connections.filter((c) => c.consecutive_failures > 0).length
              }
            </div>
          </Card>
        </div>

        {/* Connections List */}
        <Card>
          {connections.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Connections Found
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                There are no connections configured yet. Create connections in the Connections page to manage sync schedules here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enabled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Health
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jobs (24h)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {connections.map((conn) => (
                    <tr key={conn.connection_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {conn.connection_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {conn.tenant_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {conn.provider ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            {conn.provider}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">CSV</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {conn.provider ? (
                          <SyncScheduleSelector
                            value={conn.sync_schedule || 'manual'}
                            onChange={(schedule) =>
                              updateSchedule(
                                conn.connection_id,
                                schedule,
                                conn.sync_enabled
                              )
                            }
                            disabled={saving === conn.connection_id}
                          />
                        ) : (
                          <span className="text-sm text-gray-500">Manual only</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {conn.provider ? (
                          <input
                            type="checkbox"
                            checked={conn.sync_enabled}
                            onChange={(e) =>
                              updateSchedule(
                                conn.connection_id,
                                conn.sync_schedule,
                                e.target.checked
                              )
                            }
                            disabled={saving === conn.connection_id}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ConnectionHealthBadge
                          score={conn.health_score || 100}
                          size="sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {conn.total_successful_jobs !== undefined && conn.total_failed_jobs !== undefined ? (
                          <Badge
                            className={
                              getSuccessRate(conn) >= 90
                                ? 'bg-green-100 text-green-800'
                                : getSuccessRate(conn) >= 70
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                            }
                          >
                            {getSuccessRate(conn)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {conn.jobs_last_24_hours || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {saving === conn.connection_id ? (
                          <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 text-gray-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

