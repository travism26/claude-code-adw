import * as React from "react"
import { createToaster } from "@chakra-ui/react"

export interface ToastProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  variant?: "default" | "destructive"
}

export type ToastActionElement = React.ReactElement

export function Toaster() {
  return null // Placeholder - Chakra v3 has built-in toast
}

export const useToast = () => createToaster({
  placement: "top",
  duration: 5000,
})
