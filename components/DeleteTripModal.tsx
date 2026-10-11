"use client";

import { ArchiveTripModal } from "./ArchiveTripModal";

interface Props {
  roomId: string | null;
  roomTitle?: string;
  roomEmoji?: string;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * @deprecated DeleteTripModal is replaced by ArchiveTripModal to prevent permanent data loss.
 */
export function DeleteTripModal({
  roomId,
  roomTitle,
  roomEmoji,
  onClose,
  onDeleted,
}: Props) {
  return (
    <ArchiveTripModal
      roomId={roomId}
      roomTitle={roomTitle}
      roomEmoji={roomEmoji}
      onClose={onClose}
      onArchived={onDeleted}
    />
  );
}
