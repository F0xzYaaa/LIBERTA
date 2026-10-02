import { Button, ErrorMessage, Modal } from '../ui';

interface ConfirmDeleteModalProps {
  /** Name of the thing being deleted, e.g. `room 305`; null keeps the modal closed. */
  itemLabel: string | null;
  isPending: boolean;
  /** Server error to show inline (e.g. the 409 "has bookings" message). */
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared confirm step for the admin Delete buttons — deletes are permanent. */
export function ConfirmDeleteModal({
  itemLabel,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps): JSX.Element {
  return (
    <Modal isOpen={itemLabel !== null} onClose={onClose} title="Confirm delete">
      <div className="flex flex-col gap-4">
        <p className="font-sans text-sm text-primary-dark">
          Permanently delete <strong>{itemLabel}</strong>? This cannot be undone.
        </p>
        {errorMessage && <ErrorMessage message={errorMessage} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
