// Mirrors backend/room-service/src/{room,room-type,room-image}/**
//
// NOTE: GET /rooms and GET /rooms/:id return raw Room entities with NO nested
// roomType — callers must join client-side by roomTypeId (see room.api.ts).

export enum RoomStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Maintenance = 'Maintenance',
  OutOfService = 'OutOfService',
}

export interface Room {
  roomId: number;
  roomTypeId: number;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindAllRoomsParams {
  roomTypeId?: number;
  status?: RoomStatus;
}

export interface CreateRoomRequest {
  roomTypeId: number;
  roomNumber: string;
  floor: number;
  status?: RoomStatus;
}

export type UpdateRoomRequest = Partial<CreateRoomRequest>;

export interface RoomType {
  roomTypeId: number;
  typeName: string;
  pricePerNight: number;
  capacity: number;
  description: string | null;
  packageDetails: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomTypeRequest {
  typeName: string;
  pricePerNight: number;
  capacity: number;
  description?: string;
  packageDetails?: Record<string, unknown>;
}

export type UpdateRoomTypeRequest = Partial<CreateRoomTypeRequest>;

export interface RoomImage {
  imageId: number;
  roomId: number;
  imagePath: string;
  caption: string | null;
  isPrimary: boolean;
  displayOrder: number;
  uploadedAt: string;
}

export interface UploadRoomImageRequest {
  caption?: string;
  isPrimary?: boolean;
}

/** Client-side convenience shape produced by joining a Room to its RoomType (see room.api.ts). */
export interface RoomWithType extends Room {
  roomType: RoomType | undefined;
}
