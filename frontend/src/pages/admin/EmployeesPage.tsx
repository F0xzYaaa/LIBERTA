import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../../api/auth.api';
import * as mfaApi from '../../api/mfa.api';
import type {
  EmployeeSummary,
  FindAllEmployeesParams,
  RegisterEmployeeRequest,
  RoleSummary,
  UpdateEmployeeRequest,
} from '../../api/types/auth.types';
import type { GenerateMfaResponse } from '../../api/types/mfa.types';
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  Input,
  LoadingSpinner,
  Modal,
  Select,
  useToast,
} from '../../components/ui';
import { ConfirmDeleteModal } from '../../components/admin/ConfirmDeleteModal';
import { getErrorMessage, getStatusCode } from '../../lib/apiError';
import { formatDate } from '../../lib/format';

interface FilterFormState {
  roleId: string;
  isActive: string;
}

const EMPTY_FILTERS: FilterFormState = { roleId: '', isActive: '' };

const ACTIVE_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function toFindAllParams(filters: FilterFormState): FindAllEmployeesParams {
  const params: FindAllEmployeesParams = {};
  if (filters.roleId.trim()) {
    const roleId = Number(filters.roleId);
    if (Number.isInteger(roleId) && roleId > 0) params.roleId = roleId;
  }
  if (filters.isActive) params.isActive = filters.isActive === 'true';
  return params;
}

interface CreateFormState {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  phone: '',
  roleId: '',
};

export function EmployeesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [filters, setFilters] = useState<FilterFormState>(EMPTY_FILTERS);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [mfaResetResult, setMfaResetResult] = useState<GenerateMfaResponse | null>(null);
  const [mfaResetTargetName, setMfaResetTargetName] = useState<string | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeSummary | null>(null);

  const employeesQuery = useQuery({
    queryKey: ['employees', filters],
    queryFn: () => authApi.findAllEmployees(toFindAllParams(filters)),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => authApi.findAllRoles(),
  });

  // Fetches a fresh copy of the employee-under-edit by id (rather than reusing
  // the list row) so the edit modal always reflects GET /auth/employees/:id.
  const editingEmployeeQuery = useQuery({
    queryKey: ['employee', editingEmployeeId],
    queryFn: () => authApi.findEmployeeById(editingEmployeeId as number),
    enabled: editingEmployeeId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (payload: RegisterEmployeeRequest) => authApi.registerEmployee(payload),
    onSuccess: (created) => {
      showToast(`Employee "${created.username}" created.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsCreateModalOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; payload: UpdateEmployeeRequest }) =>
      authApi.updateEmployee(input.id, input.payload),
    onSuccess: () => {
      showToast('Employee updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: ['employee'] });
      setEditingEmployeeId(null);
    },
  });

  const mfaResetMutation = useMutation({
    mutationFn: (employeeId: number) => mfaApi.adminReset({ employeeId }),
    onSuccess: (data, employeeId) => {
      const employee = employeesQuery.data?.find((e) => e.employeeId === employeeId);
      setMfaResetTargetName(employee?.username ?? `employee #${employeeId}`);
      setMfaResetResult(data);
      showToast('MFA reset — share the new setup with the employee securely.', 'info');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authApi.deleteEmployee(id),
    onSuccess: () => {
      showToast('Employee deleted.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDeletingEmployee(null);
    },
  });

  function openDeleteModal(employee: EmployeeSummary): void {
    deleteMutation.reset();
    setDeletingEmployee(employee);
  }

  const deleteErrorMessage = deleteMutation.isError
    ? getStatusCode(deleteMutation.error) === 403
      ? 'You cannot delete your own employee account (self-lockout protection).'
      : getErrorMessage(deleteMutation.error, 'Could not delete this employee.')
    : null;

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCreateFormError(null);

    const username = createForm.username.trim();
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      setCreateFormError(
        'Username must be 3-50 characters and contain only letters, numbers, and underscores.',
      );
      return;
    }
    if (createForm.password.length < 8) {
      setCreateFormError('Password must be at least 8 characters.');
      return;
    }
    const fullName = createForm.fullName.trim();
    if (!fullName || fullName.length > 100) {
      setCreateFormError('Full name is required and must be at most 100 characters.');
      return;
    }
    const email = createForm.email.trim();
    if (!email) {
      setCreateFormError('Email is required.');
      return;
    }
    const roleId = Number(createForm.roleId);
    if (!Number.isInteger(roleId) || roleId < 1) {
      setCreateFormError('Please enter a valid role id.');
      return;
    }

    createMutation.mutate({
      username,
      password: createForm.password,
      fullName,
      email,
      phone: createForm.phone.trim() || undefined,
      roleId,
    });
  }

  const updateErrorMessage = updateMutation.isError
    ? getStatusCode(updateMutation.error) === 403
      ? 'You cannot modify your own employee account (self-lockout protection).'
      : getErrorMessage(updateMutation.error, 'Could not update this employee.')
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-primary-dark">Employees</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>Add Employee</Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Role ID"
            type="number"
            min={1}
            placeholder="e.g. 2"
            value={filters.roleId}
            onChange={(e) => setFilters((f) => ({ ...f, roleId: e.target.value }))}
          />
          <Select
            label="Active status"
            placeholder="All"
            options={ACTIVE_FILTER_OPTIONS}
            value={filters.isActive}
            onChange={(e) => setFilters((f) => ({ ...f, isActive: e.target.value }))}
          />
        </div>
      </Card>

      {mfaResetMutation.isError && (
        <ErrorMessage
          message={getErrorMessage(
            mfaResetMutation.error,
            'Could not reset MFA for this employee.',
          )}
        />
      )}

      {employeesQuery.isLoading && <LoadingSpinner />}
      {employeesQuery.isError && (
        <ErrorMessage
          message={getErrorMessage(employeesQuery.error, 'Could not load employees.')}
        />
      )}
      {employeesQuery.data && employeesQuery.data.length === 0 && (
        <p className="font-sans text-primary-dark/70">No employees match these filters.</p>
      )}
      {employeesQuery.data && employeesQuery.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left font-sans text-sm">
            <thead className="border-b border-sage-gray/15 text-xs uppercase tracking-wide text-sage-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Full name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">MFA</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.data.map((employee) => (
                <tr
                  key={employee.employeeId}
                  className="border-b border-sage-gray/10 last:border-0 hover:bg-cream/60"
                >
                  <td className="px-4 py-3 font-medium text-primary-dark">{employee.username}</td>
                  <td className="px-4 py-3 text-primary-dark">{employee.fullName}</td>
                  <td className="px-4 py-3 text-primary-dark">{employee.roleName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={employee.mfaEnabled ? 'success' : 'neutral'}>
                      {employee.mfaEnabled ? 'Enabled' : 'Not set up'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={employee.isActive ? 'success' : 'danger'}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-primary-dark">
                    {employee.lastLoginAt ? formatDate(employee.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setEditingEmployeeId(employee.employeeId)}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => openDeleteModal(employee)}>
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={mfaResetMutation.isPending}
                        onClick={() => mfaResetMutation.mutate(employee.employeeId)}
                      >
                        Reset MFA
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Employee"
      >
        <form className="flex flex-col gap-4" onSubmit={handleCreateSubmit}>
          <Input
            label="Username"
            required
            value={createForm.username}
            onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            required
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
          />
          <Input
            label="Full name"
            required
            value={createForm.fullName}
            onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Phone (optional)"
            value={createForm.phone}
            onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Role ID"
            type="number"
            min={1}
            required
            placeholder="e.g. 1 = Staff, 2 = Admin (per seed data)"
            value={createForm.roleId}
            onChange={(e) => setCreateForm((f) => ({ ...f, roleId: e.target.value }))}
          />
          {createFormError && <ErrorMessage message={createFormError} />}
          {createMutation.isError && (
            <ErrorMessage
              message={getErrorMessage(createMutation.error, 'Could not create this employee.')}
            />
          )}
          <Button type="submit" disabled={createMutation.isPending} className="self-start">
            {createMutation.isPending ? 'Creating...' : 'Create Employee'}
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={editingEmployeeId !== null}
        onClose={() => {
          setEditingEmployeeId(null);
          updateMutation.reset();
        }}
        title={
          editingEmployeeQuery.data ? `Edit ${editingEmployeeQuery.data.username}` : 'Edit Employee'
        }
      >
        {editingEmployeeQuery.isLoading && <LoadingSpinner />}
        {editingEmployeeQuery.isError && (
          <ErrorMessage
            message={getErrorMessage(editingEmployeeQuery.error, 'Could not load this employee.')}
          />
        )}
        {editingEmployeeQuery.data && (
          <EditEmployeePanel
            key={editingEmployeeQuery.data.employeeId}
            employee={editingEmployeeQuery.data}
            roles={rolesQuery.data ?? []}
            isPending={updateMutation.isPending}
            errorMessage={updateErrorMessage}
            onSave={(payload) =>
              updateMutation.mutate({ id: editingEmployeeQuery.data.employeeId, payload })
            }
            onCancel={() => setEditingEmployeeId(null)}
          />
        )}
      </Modal>

      <ConfirmDeleteModal
        itemLabel={deletingEmployee ? `employee "${deletingEmployee.username}"` : null}
        isPending={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        onConfirm={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.employeeId)}
        onClose={() => setDeletingEmployee(null)}
      />

      <Modal
        isOpen={mfaResetResult !== null}
        onClose={() => setMfaResetResult(null)}
        title={`MFA Reset for ${mfaResetTargetName ?? ''}`}
      >
        {mfaResetResult && (
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-accent/50 bg-accent/10 px-4 py-3 font-sans text-sm text-primary-dark">
              <strong>Share this securely and only once</strong> — these codes will not be shown
              again. The employee must re-enroll their authenticator app.
            </div>
            <div className="flex flex-col items-center gap-3">
              <img
                src={mfaResetResult.qrCodeDataUri}
                alt="New MFA QR code"
                className="h-48 w-48 rounded-card border border-sage-gray/20"
              />
              <code className="rounded-card bg-cream px-3 py-1.5 font-mono text-sm text-primary-dark">
                {mfaResetResult.manualEntryKey}
              </code>
            </div>
            <div>
              <p className="font-sans text-sm font-medium text-primary-dark">Backup codes</p>
              <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm text-primary-dark">
                {mfaResetResult.backupCodes.map((code) => (
                  <li key={code} className="rounded-card bg-cream px-3 py-1.5 text-center">
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface EditEmployeePanelProps {
  employee: EmployeeSummary;
  roles: RoleSummary[];
  isPending: boolean;
  errorMessage: string | null;
  onSave: (payload: UpdateEmployeeRequest) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive (cannot log in)' },
];

function EditEmployeePanel({
  employee,
  roles,
  isPending,
  errorMessage,
  onSave,
  onCancel,
}: EditEmployeePanelProps): JSX.Element {
  const [fullName, setFullName] = useState(employee.fullName);
  const [email, setEmail] = useState(employee.email);
  const [phone, setPhone] = useState(employee.phone ?? '');
  const [roleId, setRoleId] = useState(String(employee.roleId));
  const [status, setStatus] = useState(employee.isActive ? 'active' : 'inactive');
  const [formError, setFormError] = useState<string | null>(null);

  // Keep the current role selectable even before the roles list has loaded.
  const roleOptions = roles.length
    ? roles.map((role) => ({ value: role.roleId, label: role.roleName }))
    : [{ value: employee.roleId, label: employee.roleName ?? `Role #${employee.roleId}` }];

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setFormError('Full name is required and must be at most 100 characters.');
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Email is required.');
      return;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone && (trimmedPhone.length < 9 || trimmedPhone.length > 20)) {
      setFormError('Phone must be 9-20 characters, or empty.');
      return;
    }

    // Send only what changed, so an unchanged field never trips a validation rule.
    const payload: UpdateEmployeeRequest = {};
    if (trimmedName !== employee.fullName) payload.fullName = trimmedName;
    if (trimmedEmail !== employee.email) payload.email = trimmedEmail;
    if (trimmedPhone !== (employee.phone ?? '')) payload.phone = trimmedPhone || null;
    if (Number(roleId) !== employee.roleId) payload.roleId = Number(roleId);
    if ((status === 'active') !== employee.isActive) payload.isActive = status === 'active';

    if (Object.keys(payload).length === 0) {
      setFormError('No changes to save.');
      return;
    }
    onSave(payload);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="font-sans text-sm text-sage-gray">
        Username: <span className="font-medium text-primary-dark">{employee.username}</span> (cannot
        be changed)
      </p>
      <Input
        label="Full name"
        required
        maxLength={100}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Phone (optional)"
        maxLength={20}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Role"
          options={roleOptions}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
      {formError && <ErrorMessage message={formError} />}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
