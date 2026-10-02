import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as roomApi from '../../api/room.api';
import {
  CreateRoomRequest,
  Room,
  RoomStatus,
  RoomWithType,
  UpdateRoomRequest,
} from '../../api/types/room.types';
import {
  Badge,
  BadgeTone,
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
import { getErrorMessage } from '../../lib/apiError';

const ROOM_STATUS_OPTIONS = Object.values(RoomStatus).map((status) => ({
  value: status,
  label: status,
}));

const ROOM_STATUS_TONE: Record<RoomStatus, BadgeTone> = {
  [RoomStatus.Available]: 'success',
  [RoomStatus.Occupied]: 'info',
  [RoomStatus.Maintenance]: 'warning',
  [RoomStatus.OutOfService]: 'danger',
};

interface RoomFormState {
  roomTypeId: string;
  roomNumber: string;
  floor: string;
  status: RoomStatus;
}

function emptyForm(defaultRoomTypeId: string): RoomFormState {
  return {
    roomTypeId: defaultRoomTypeId,
    roomNumber: '',
    floor: '',
    status: RoomStatus.Available,
  };
}

function formFromRoom(room: Room): RoomFormState {
  return {
    roomTypeId: String(room.roomTypeId),
    roomNumber: room.roomNumber,
    floor: String(room.floor),
    status: room.status,
  };
}

export function RoomsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomFormState>(emptyForm(''));
  const [formError, setFormError] = useState<string | null>(null);
  const [imagesRoomId, setImagesRoomId] = useState<number | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomWithType | null>(null);

  const roomTypesQuery = useQuery({
    queryKey: ['room-types'],
    queryFn: () => roomApi.findAllRoomTypes(),
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomApi.findAllRoomsWithType(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRoomRequest) => roomApi.createRoom(payload),
    onSuccess: () => {
      showToast('Room created.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; payload: UpdateRoomRequest }) =>
      roomApi.updateRoom(input.id, input.payload),
    onSuccess: () => {
      showToast('Room updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => roomApi.deleteRoom(id),
    onSuccess: () => {
      showToast('Room deleted.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDeletingRoom(null);
    },
  });

  function openDeleteModal(room: RoomWithType): void {
    deleteMutation.reset();
    setDeletingRoom(room);
  }

  function openCreateModal(): void {
    const defaultRoomTypeId = roomTypesQuery.data?.[0]
      ? String(roomTypesQuery.data[0].roomTypeId)
      : '';
    setEditingRoom(null);
    setForm(emptyForm(defaultRoomTypeId));
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(room: Room): void {
    setEditingRoom(room);
    setForm(formFromRoom(room));
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    const roomTypeId = Number(form.roomTypeId);
    if (!Number.isInteger(roomTypeId) || roomTypeId < 1) {
      setFormError('Please choose a room type.');
      return;
    }
    const roomNumber = form.roomNumber.trim();
    if (!roomNumber || roomNumber.length > 10) {
      setFormError('Room number is required and must be at most 10 characters.');
      return;
    }
    const floor = Number(form.floor);
    if (!Number.isInteger(floor)) {
      setFormError('Floor must be a whole number.');
      return;
    }

    const payload: CreateRoomRequest = {
      roomTypeId,
      roomNumber,
      floor,
      status: form.status,
    };

    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.roomId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const mutation = editingRoom ? updateMutation : createMutation;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-primary-dark">Rooms</h1>
        <Button onClick={openCreateModal} disabled={roomTypesQuery.isLoading}>
          Add Room
        </Button>
      </div>

      {roomsQuery.isLoading && <LoadingSpinner />}
      {roomsQuery.isError && (
        <ErrorMessage message={getErrorMessage(roomsQuery.error, 'Could not load rooms.')} />
      )}
      {roomsQuery.data && roomsQuery.data.length === 0 && (
        <p className="font-sans text-primary-dark/70">No rooms yet.</p>
      )}
      {roomsQuery.data && roomsQuery.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left font-sans text-sm">
            <thead className="border-b border-sage-gray/15 text-xs uppercase tracking-wide text-sage-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Room Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roomsQuery.data.map((room: RoomWithType) => (
                <tr
                  key={room.roomId}
                  className="border-b border-sage-gray/10 last:border-0 hover:bg-cream/60"
                >
                  <td className="px-4 py-3 font-medium text-primary-dark">{room.roomNumber}</td>
                  <td className="px-4 py-3 text-primary-dark">{room.floor}</td>
                  <td className="px-4 py-3 text-primary-dark">
                    {room.roomType?.typeName ?? `#${room.roomTypeId}`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROOM_STATUS_TONE[room.status]}>{room.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => openEditModal(room)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setImagesRoomId(room.roomId)}>
                        Images
                      </Button>
                      <Button variant="danger" onClick={() => openDeleteModal(room)}>
                        Delete
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoom ? 'Edit Room' : 'Add Room'}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Select
            label="Room type"
            placeholder="Choose a room type"
            options={(roomTypesQuery.data ?? []).map((roomType) => ({
              value: roomType.roomTypeId,
              label: roomType.typeName,
            }))}
            value={form.roomTypeId}
            onChange={(e) => setForm((f) => ({ ...f, roomTypeId: e.target.value }))}
          />
          <Input
            label="Room number"
            required
            maxLength={10}
            value={form.roomNumber}
            onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))}
          />
          <Input
            label="Floor"
            type="number"
            required
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
          />
          <Select
            label="Status"
            options={ROOM_STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}
          />
          {formError && <ErrorMessage message={formError} />}
          {mutation.isError && (
            <ErrorMessage message={getErrorMessage(mutation.error, 'Could not save this room.')} />
          )}
          <Button type="submit" disabled={mutation.isPending} className="self-start">
            {mutation.isPending ? 'Saving...' : 'Save Room'}
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={imagesRoomId !== null}
        onClose={() => setImagesRoomId(null)}
        title="Room Images"
      >
        {imagesRoomId !== null && <RoomImagesPanel roomId={imagesRoomId} />}
      </Modal>

      <ConfirmDeleteModal
        itemLabel={deletingRoom ? `room ${deletingRoom.roomNumber}` : null}
        isPending={deleteMutation.isPending}
        errorMessage={
          deleteMutation.isError
            ? getErrorMessage(deleteMutation.error, 'Could not delete this room.')
            : null
        }
        onConfirm={() => deletingRoom && deleteMutation.mutate(deletingRoom.roomId)}
        onClose={() => setDeletingRoom(null)}
      />
    </div>
  );
}

function RoomImagesPanel({ roomId }: { roomId: number }): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const imagesQuery = useQuery({
    queryKey: ['room-images', roomId],
    queryFn: () => roomApi.findRoomImages(roomId),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) {
        return Promise.reject(new Error('Please choose an image file to upload.'));
      }
      return roomApi.uploadRoomImage(roomId, file, {
        caption: caption.trim() || undefined,
        isPrimary,
      });
    },
    onSuccess: () => {
      showToast('Image uploaded.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['room-images', roomId] });
      setFile(null);
      setCaption('');
      setIsPrimary(false);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);
    if (!file) {
      setFormError('Please choose an image file.');
      return;
    }
    uploadMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-4">
      {imagesQuery.isLoading && <LoadingSpinner />}
      {imagesQuery.isError && (
        <ErrorMessage message={getErrorMessage(imagesQuery.error, 'Could not load images.')} />
      )}
      {imagesQuery.data && imagesQuery.data.length === 0 && (
        <p className="font-sans text-sm text-sage-gray">No images uploaded yet.</p>
      )}
      {imagesQuery.data && imagesQuery.data.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {imagesQuery.data.map((image) => (
            <div key={image.imageId} className="relative">
              <img
                src={image.imagePath}
                alt={image.caption ?? `Room ${roomId} photo`}
                className="h-24 w-full rounded-card border border-sage-gray/15 object-cover"
              />
              {image.isPrimary && (
                <Badge tone="success" className="absolute bottom-1 right-1">
                  Primary
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        className="flex flex-col gap-3 border-t border-sage-gray/15 pt-4"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-1.5">
          <label
            className="font-sans text-sm font-medium text-primary-dark"
            htmlFor="room-image-file"
          >
            New image
          </label>
          <input
            id="room-image-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-sans text-sm text-primary-dark"
          />
        </div>
        <Input
          label="Caption (optional)"
          maxLength={200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <label className="flex items-center gap-2 font-sans text-sm text-primary-dark">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
          />
          Set as primary image
        </label>
        {formError && <ErrorMessage message={formError} />}
        {uploadMutation.isError && (
          <ErrorMessage
            message={getErrorMessage(uploadMutation.error, 'Could not upload this image.')}
          />
        )}
        <Button type="submit" disabled={uploadMutation.isPending} className="self-start">
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Image'}
        </Button>
      </form>
    </div>
  );
}
