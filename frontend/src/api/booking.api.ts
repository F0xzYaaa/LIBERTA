import { apiClient } from './client';
import type {
  AvailableRoomResponse,
  BookingResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  CreateDraftBookingRequest,
  CreateDraftResponse,
  FindAllBookingsParams,
  FindAvailableRoomParams,
  LookupBookingRequest,
  LookupBookingResponse,
} from './types/booking.types';

/** Create a Draft booking with a 15-minute concurrency-safe lock. */
export async function createDraft(
  payload: CreateDraftBookingRequest,
): Promise<CreateDraftResponse> {
  const { data } = await apiClient.post<CreateDraftResponse>('/bookings/draft', payload);
  return data;
}

/** Public: look up a booking by reference + phone/email (two-factor). */
export async function lookup(payload: LookupBookingRequest): Promise<LookupBookingResponse> {
  const { data } = await apiClient.post<LookupBookingResponse>('/bookings/lookup', payload);
  return data;
}

/**
 * Public: resolve the lowest-numbered available room of a room type for the
 * given dates (preview only, does not lock).
 */
export async function findAvailableRoom(
  params: FindAvailableRoomParams,
): Promise<AvailableRoomResponse> {
  const { data } = await apiClient.get<AvailableRoomResponse>('/bookings/available-room', {
    params,
  });
  return data;
}

/** Staff/Admin: list bookings with filters. */
export async function findAll(filters: FindAllBookingsParams = {}): Promise<BookingResponse[]> {
  const { data } = await apiClient.get<BookingResponse[]>('/bookings', { params: filters });
  return data;
}

/** Staff/Admin: get full booking details by id. */
export async function findById(id: number): Promise<BookingResponse> {
  const { data } = await apiClient.get<BookingResponse>(`/bookings/${id}`);
  return data;
}

/** Staff/Admin: confirm payment for a Draft booking with a slip upload (multipart, field name "file"). */
export async function confirmPayment(
  id: number,
  file: File,
  payload: ConfirmPaymentRequest,
): Promise<ConfirmPaymentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('paymentNote', payload.paymentNote);

  const { data } = await apiClient.post<ConfirmPaymentResponse>(
    `/bookings/${id}/confirm-payment`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/** Staff/Admin: fetch the uploaded payment slip image as a Blob for local rendering. */
export async function getSlip(id: number): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/bookings/${id}/slip`, { responseType: 'blob' });
  return data;
}
