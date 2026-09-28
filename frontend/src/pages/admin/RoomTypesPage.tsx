import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as roomApi from '../../api/room.api';
import type {
  CreateRoomTypeRequest,
  RoomType,
  UpdateRoomTypeRequest,
} from '../../api/types/room.types';
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  LoadingSpinner,
  Modal,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../components/ui';
import {
  createEmptyPair,
  KeyValuePair,
  pairsToRecord,
  PackageDetailsEditor,
  recordToPairs,
} from '../../components/admin/PackageDetailsEditor';
import { getErrorMessage } from '../../lib/apiError';
import { formatCurrency } from '../../lib/format';

interface RoomTypeFormState {
  typeName: string;
  pricePerNight: string;
  capacity: string;
  description: string;
  packageDetails: KeyValuePair[];
}

function emptyForm(): RoomTypeFormState {
  return {
    typeName: '',
    pricePerNight: '',
    capacity: '',
    description: '',
    packageDetails: [createEmptyPair()],
  };
}

function formFromRoomType(roomType: RoomType): RoomTypeFormState {
  return {
    typeName: roomType.typeName,
    pricePerNight: String(roomType.pricePerNight),
    capacity: String(roomType.capacity),
    description: roomType.description ?? '',
    packageDetails: recordToPairs(roomType.packageDetails),
  };
}

export function RoomTypesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [form, setForm] = useState<RoomTypeFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const roomTypesQuery = useQuery({
    queryKey: ['room-types'],
    queryFn: () => roomApi.findAllRoomTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRoomTypeRequest) => roomApi.createRoomType(payload),
    onSuccess: () => {
      showToast('Room type created.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['room-types'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; payload: UpdateRoomTypeRequest }) =>
      roomApi.updateRoomType(input.id, input.payload),
    onSuccess: () => {
      showToast('Room type updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['room-types'] });
      setIsModalOpen(false);
    },
  });

  function openCreateModal(): void {
    setEditingRoomType(null);
    setForm(emptyForm());
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(roomType: RoomType): void {
    setEditingRoomType(roomType);
    setForm(formFromRoomType(roomType));
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    const typeName = form.typeName.trim();
    if (!typeName || typeName.length > 50) {
      setFormError('Type name is required and must be at most 50 characters.');
      return;
    }
    const pricePerNight = Number(form.pricePerNight);
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) {
      setFormError('Price per night must be a number of 0 or more.');
      return;
    }
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setFormError('Capacity must be a whole number of 1 or more.');
      return;
    }

    const payload: CreateRoomTypeRequest = {
      typeName,
      pricePerNight,
      capacity,
      description: form.description.trim() || undefined,
      packageDetails: pairsToRecord(form.packageDetails),
    };

    if (editingRoomType) {
      updateMutation.mutate({ id: editingRoomType.roomTypeId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const mutation = editingRoomType ? updateMutation : createMutation;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-primary-dark">Room Types</h1>
        <Button onClick={openCreateModal}>Add Room Type</Button>
      </div>

      {roomTypesQuery.isLoading && <LoadingSpinner />}
      {roomTypesQuery.isError && (
        <ErrorMessage
          message={getErrorMessage(roomTypesQuery.error, 'Could not load room types.')}
        />
      )}
      {roomTypesQuery.data && roomTypesQuery.data.length === 0 && (
        <p className="font-sans text-primary-dark/70">No room types yet.</p>
      )}
      {roomTypesQuery.data && roomTypesQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypesQuery.data.map((roomType) => (
            <Card key={roomType.roomTypeId} className="flex flex-col">
              <h2 className="font-serif text-lg font-semibold text-primary-dark">
                {roomType.typeName}
              </h2>
              <p className="mt-1 font-sans text-sm text-sage-gray">
                {formatCurrency(roomType.pricePerNight)} / night &middot; up to {roomType.capacity}{' '}
                guests
              </p>
              {roomType.description && (
                <p className="mt-2 line-clamp-2 font-sans text-sm text-primary-dark/80">
                  {roomType.description}
                </p>
              )}
              <Button
                variant="ghost"
                className="mt-4 self-start"
                onClick={() => openEditModal(roomType)}
              >
                Edit
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoomType ? 'Edit Room Type' : 'Add Room Type'}
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Type name"
            required
            maxLength={50}
            value={form.typeName}
            onChange={(e) => setForm((f) => ({ ...f, typeName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price per night (THB)"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.pricePerNight}
              onChange={(e) => setForm((f) => ({ ...f, pricePerNight: e.target.value }))}
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <PackageDetailsEditor
            pairs={form.packageDetails}
            onChange={(pairs) => setForm((f) => ({ ...f, packageDetails: pairs }))}
          />
          {formError && <ErrorMessage message={formError} />}
          {mutation.isError && (
            <ErrorMessage
              message={getErrorMessage(mutation.error, 'Could not save this room type.')}
            />
          )}
          <Button type="submit" disabled={mutation.isPending} className="self-start">
            {mutation.isPending ? 'Saving...' : 'Save Room Type'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
