'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Wallet, Globe, Mail, Phone, Edit, Trash2, Plus, X } from 'lucide-react';
import { useEntity, useUpdateEntity, useDeleteEntity, useEntities } from '@/lib/hooks/use-entities';
import { useAccounts } from '@/lib/hooks/use-accounts';
import { useUpdateAccountEntity } from '@/lib/hooks/use-update-account-entity';
import { toast } from 'sonner';
import Link from 'next/link';
import type { EntityType, EntityStatus, UpdateEntityInput } from '@/lib/types/entity';

export default function EntityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentTenant, userRole } = useTenant();
  const { user } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);

  const entityId = params.id as string;

  // Use React Query hooks
  const { data: entity, isLoading: entityLoading } = useEntity(currentTenant?.id, entityId);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(currentTenant?.id);
  const { data: allEntities = [] } = useEntities(currentTenant?.id);
  const updateAccountEntityMutation = useUpdateAccountEntity();
  const updateEntityMutation = useUpdateEntity();
  const deleteEntityMutation = useDeleteEntity();

  const loading = entityLoading || accountsLoading;

  // Filter accounts for this entity
  const entityAccounts = useMemo(() => {
    return accounts.filter(acc => acc.entity_id === entityId);
  }, [accounts, entityId]);

  // Accounts not associated with any entity
  const unassociatedAccounts = useMemo(() => {
    return accounts.filter(acc => !acc.entity_id);
  }, [accounts]);

  // Calculate statistics
  const totalBalance = useMemo(() => {
    return entityAccounts.reduce((sum, acc) => {
      const balance = acc.balance ?? acc.current_balance ?? acc.available_balance ?? 0;
      return sum + balance;
    }, 0);
  }, [entityAccounts]);

  const currencies = useMemo(() => {
    return [...new Set(entityAccounts.map(acc => acc.currency || 'USD').filter(Boolean))];
  }, [entityAccounts]);

  const canEdit = userRole ? ['owner', 'admin'].includes(userRole) : false;

  async function handleAssociateAccount(accountId: string) {
    if (!currentTenant) return;

    // Account ID could be UUID (id) or TEXT (account_id)
    const account = accounts.find(acc => 
      (acc.account_id && acc.account_id === accountId) || 
      (acc.id && acc.id === accountId)
    );

    if (!account) {
      toast.error('Account not found');
      return;
    }

    updateAccountEntityMutation.mutate({
      accountId: account.account_id || account.id!,
      tenantId: currentTenant.id,
      entityId: entityId,
    });
  }

  async function handleRemoveAccount(accountId: string) {
    if (!currentTenant) return;

    updateAccountEntityMutation.mutate({
      accountId,
      tenantId: currentTenant.id,
      entityId: null,
    });
  }

  async function handleUpdateEntity(data: UpdateEntityInput) {
    if (!currentTenant || !entity) return;

    updateEntityMutation.mutate({
      entityId: entity.entity_id,
      tenantId: currentTenant.id,
      updates: data,
    }, {
      onSuccess: () => {
        setShowEditModal(false);
        toast.success('Entity updated successfully');
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update entity');
      },
    });
  }

  async function handleDelete() {
    if (!currentTenant || !entity) return;
    
    if (!confirm(`Are you sure you want to delete "${entity.entity_name}"? This action cannot be undone.`)) {
      return;
    }

    deleteEntityMutation.mutate({
      entityId: entity.entity_id,
      tenantId: currentTenant.id,
    }, {
      onSuccess: () => {
        router.push('/entities');
      },
    });
  }

  if (!currentTenant) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">No Organization Selected</h2>
        <p className="text-muted-foreground">
          Please select an organization from the sidebar.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!entity) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Entity Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The entity you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.push('/entities')}>
          Back to Entities
        </Button>
      </Card>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/entities">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{entity.entity_name}</h1>
              <p className="text-muted-foreground">{entity.entity_id}</p>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEntityMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Entity Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Badge 
              variant={entity.status === 'Active' ? 'default' : 'secondary'}
              className={
                entity.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : entity.status === 'Inactive'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-red-100 text-red-800'
              }
            >
              {entity.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <p className="text-2xl font-bold">{entity.status}</p>
        </Card>

        <Card className="p-6">
          <Wallet className="h-5 w-5 text-blue-600 mb-2" />
          <p className="text-xs text-muted-foreground mb-1">Accounts</p>
          <p className="text-2xl font-bold">{entityAccounts.length}</p>
        </Card>

        <Card className="p-6">
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencies[0] || 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(totalBalance)}
          </p>
          {currencies.length > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{currencies.length - 1} more {currencies.length - 1 === 1 ? 'currency' : 'currencies'}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <Globe className="h-5 w-5 text-blue-600 mb-2" />
          <p className="text-xs text-muted-foreground mb-1">Jurisdiction</p>
          <p className="text-lg font-semibold">{entity.jurisdiction}</p>
        </Card>
      </div>

      {/* Entity Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Entity Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium">{entity.type}</p>
            </div>
            {entity.tax_id && (
              <div>
                <p className="text-sm text-muted-foreground">Tax ID / EIN</p>
                <p className="font-medium">{entity.tax_id}</p>
              </div>
            )}
            {entity.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{entity.contact_email}</p>
                </div>
              </div>
            )}
            {entity.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{entity.phone}</p>
                </div>
              </div>
            )}
            {entity.address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium whitespace-pre-line">{entity.address}</p>
              </div>
            )}
            {entity.website && (
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a 
                  href={entity.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {entity.website}
                </a>
              </div>
            )}
            {entity.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{entity.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Associated Accounts */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Associated Accounts</h2>
            {canEdit && unassociatedAccounts.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {unassociatedAccounts.length} available
              </Badge>
            )}
          </div>

          {entityAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No accounts associated with this entity</p>
              {canEdit && unassociatedAccounts.length > 0 && (
                <p className="text-sm mt-2">
                  {unassociatedAccounts.length} unassociated account{unassociatedAccounts.length !== 1 ? 's' : ''} available
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {entityAccounts.map((account) => (
                <div
                  key={account.account_id || account.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <Link
                      href={`/accounts/${account.account_id || account.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {account.account_name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {account.account_type} • {account.currency || 'USD'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: account.currency || 'USD',
                      }).format(account.balance ?? account.current_balance ?? 0)}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAccount(account.account_id || account.id!)}
                      className="ml-2 text-red-600 hover:text-red-700"
                      disabled={updateAccountEntityMutation.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick Associate Unassociated Accounts */}
          {canEdit && unassociatedAccounts.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-3">Associate Accounts</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Associate unlinked accounts with this entity
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unassociatedAccounts.slice(0, 10).map((account) => (
                  <div
                    key={account.account_id || account.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <Link
                        href={`/accounts/${account.account_id || account.id}`}
                        className="text-sm font-medium hover:text-blue-600"
                      >
                        {account.account_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {account.account_type} • {account.currency || 'USD'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const accId = account.account_id || account.id;
                        if (accId) {
                          handleAssociateAccount(accId);
                        }
                      }}
                      disabled={updateAccountEntityMutation.isPending}
                    >
                      Associate
                    </Button>
                  </div>
                ))}
                {unassociatedAccounts.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{unassociatedAccounts.length - 10} more accounts
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Entity Modal */}
      {showEditModal && entity && (
        <EditEntityModal
          entity={entity}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateEntity}
          isLoading={updateEntityMutation.isPending}
        />
      )}
    </div>
  );
}

// Edit Entity Modal Component
interface EditEntityModalProps {
  entity: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateEntityInput) => void;
  isLoading: boolean;
}

function EditEntityModal({ entity, isOpen, onClose, onSubmit, isLoading }: EditEntityModalProps) {
  const [formData, setFormData] = useState<UpdateEntityInput>({
    entity_name: entity.entity_name,
    type: entity.type as EntityType,
    jurisdiction: entity.jurisdiction,
    status: entity.status as EntityStatus,
    tax_id: entity.tax_id || '',
    contact_email: entity.contact_email || '',
    phone: entity.phone || '',
    address: entity.address || '',
    website: entity.website || '',
    description: entity.description || '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(formData);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Entity</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Entity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.entity_name}
                onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EntityType })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                >
                  <option value="Corporation">Corporation</option>
                  <option value="LLC">LLC</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Trust">Trust</option>
                  <option value="Non-Profit">Non-Profit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Dissolved">Dissolved</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Jurisdiction <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                placeholder="e.g., Delaware, UK, Singapore"
                className="w-full border rounded-lg px-4 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tax ID / EIN</label>
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="e.g., 12-3456789"
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact Information</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contact@example.com"
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Website</label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Address</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the entity"
                rows={3}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

