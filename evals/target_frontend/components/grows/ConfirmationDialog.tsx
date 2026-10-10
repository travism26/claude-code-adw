"use client";

import type React from "react";
import {
  Button,
  Text,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
  DialogCloseTrigger,
} from "@chakra-ui/react";

interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when confirm button is clicked */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: React.ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Color palette for confirm button */
  confirmColorPalette?: string;
  /** Whether the confirm action is loading */
  isLoading?: boolean;
  /** Data test id for the dialog */
  testId?: string;
}

/**
 * ConfirmationDialog Component
 *
 * A reusable confirmation dialog for delete/action confirmations.
 * Provides consistent styling and behavior across the application.
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColorPalette = "red",
  isLoading = false,
  testId,
}) => {
  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose()}
      data-testid={testId}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          {typeof message === "string" ? <Text>{message}</Text> : message}
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">{cancelText}</Button>
          </DialogActionTrigger>
          <Button
            colorPalette={confirmColorPalette}
            onClick={onConfirm}
            loading={isLoading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default ConfirmationDialog;
