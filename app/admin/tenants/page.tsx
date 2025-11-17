'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectionHealthBadge } from '@/components/admin/ConnectionHealthBadge';
import {
  Building2,
  Users,
  Link as LinkIcon,
  ArrowRight,
  Search,
  RefreshCw,
} from 'lucide-react';

interface TenantStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  user_count: number;
  connection_count: number;
  account_count: number;
  last_activity: string | null;
  health_score: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    try {
      const res = await fetch('/api/admin/tenants');
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  // Debounced filtering effect
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

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-600 mt-2">
            Manage all organizations on the platform
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Tenants</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {loading ? '...' : tenants.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {loading ? '...' : tenants.reduce((sum, t) => sum + t.user_count, 0)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Connections</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {loading ? '...' : tenants.reduce((sum, t) => sum + t.connection_count, 0)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Accounts</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {loading ? '...' : tenants.reduce((sum, t) => sum + t.account_count, 0)}
            </div>
          </Card>
        </div>

        {/* Tenants Table */}
        <Card className="relative">
          {(loading || filtering) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <div className="flex flex-col items-center space-y-2">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">
                  {loading ? 'Loading tenants...' : 'Filtering...'}
                </span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Connections
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Health
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTenants.length === 0 && !loading && !filtering ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No tenants found matching your search
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {tenant.name}
                            </div>
                            <div className="text-xs text-gray-500">{tenant.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getPlanColor(tenant.plan)}>
                          {tenant.plan}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                          {tenant.user_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <LinkIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {tenant.connection_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {tenant.account_count}
                      </td>
                      <td className="px-6 py-4">
                        <ConnectionHealthBadge score={tenant.health_score} showLabel={false} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center ml-auto">
                          View
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </button>
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

