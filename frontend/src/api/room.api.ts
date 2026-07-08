import { apiClient } from './client';
import type {
  CreateRoomRequest,
  CreateRoomTypeRequest,
  FindAllRoomsParams,
  Room,
  RoomImage,
  RoomType,
  RoomWithType,
  UpdateRoomRequest,
  UpdateRoomTypeRequest,
  UploadRoomImageRequest,
} from './types/room.types';

// ---------- rooms ----------
// GET /rooms and GET /rooms/:id return the raw Room entity with NO nested
// roomType — findAllWithType()/findByIdWithType() below join client-side.

/** List rooms, optionally filtered by roomTypeId/status (public). */
export async function findAllRooms(params: FindAllRoomsParams = {}): Promise<Room[]> {
  const { data } = await apiClient.get<Room[]>('/rooms', { params });
  return data;
}

/** Get a room by id (public). */
export async function findRoomById(id: number): Promise<Room> {
  const { data } = await apiClient.get<Room>(`/rooms/${id}`);
  return data;
}

/** Admin-only: create a new room. */
export async function createRoom(payload: CreateRoomRequest): Promise<Room> {
  const { data } = await apiClient.post<Room>('/rooms', payload);
  return data;
}

/** Admin-only: update a room. */
export async function updateRoom(id: number, payload: UpdateRoomRequest): Promise<Room> {
  const { data } = await apiClient.patch<Room>(`/rooms/${id}`, payload);
  return data;
}

/** Client-side join: fetch all rooms, then attach each room's RoomType by roomTypeId. */
export async function findAllRoomsWithType(
  params: FindAllRoomsParams = {},
): Promise<RoomWithType[]> {
  const [rooms, roomTypes] = await Promise.all([findAllRooms(params), findAllRoomTypes()]);
  const roomTypeById = new Map(roomTypes.map((roomType) => [roomType.roomTypeId, roomType]));
  return rooms.map((room) => ({ ...room, roomType: roomTypeById.get(room.roomTypeId) }));
}

/** Client-side join: fetch one room, then attach its RoomType by roomTypeId. */
export async function findRoomByIdWithType(id: number): Promise<RoomWithType> {
  const room = await findRoomById(id);
  const roomType = await findRoomTypeById(room.roomTypeId);
  return { ...room, roomType };
}

// ---------- room types ----------

/** List all room types (public). */
export async function findAllRoomTypes(): Promise<RoomType[]> {
  const { data } = await apiClient.get<RoomType[]>('/room-types');
  return data;
}

/** Get a room type by id (public). */
export async function findRoomTypeById(id: number): Promise<RoomType> {
  const { data } = await apiClient.get<RoomType>(`/room-types/${id}`);
  return data;
}

/** Admin-only: create a new room type. */
export async function createRoomType(payload: CreateRoomTypeRequest): Promise<RoomType> {
  const { data } = await apiClient.post<RoomType>('/room-types', payload);
  return data;
}

/** Admin-only: update a room type. */
export async function updateRoomType(
  id: number,
  payload: UpdateRoomTypeRequest,
): Promise<RoomType> {
  const { data } = await apiClient.patch<RoomType>(`/room-types/${id}`, payload);
  return data;
}

// ---------- room images ----------

/** Public: list all images for a room, ordered by display order. */
export async function findRoomImages(roomId: number): Promise<RoomImage[]> {
  const { data } = await apiClient.get<RoomImage[]>(`/rooms/${roomId}/images`);
  return data;
}

/** Staff/Admin: upload an image for a room (multipart, field name "file"). */
export async function uploadRoomImage(
  roomId: number,
  file: File,
  meta: UploadRoomImageRequest = {},
): Promise<RoomImage> {
  const formData = new FormData();
  formData.append('file', file);
  if (meta.caption !== undefined) {
    formData.append('caption', meta.caption);
  }
  if (meta.isPrimary !== undefined) {
    formData.append('isPrimary', String(meta.isPrimary));
  }

  const { data } = await apiClient.post<RoomImage>(`/rooms/${roomId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
