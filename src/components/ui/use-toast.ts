import * as React from "react"

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { useToast as useToastPrimitive } from "@/hooks/use-toast"

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
}

export function useToast() {
  const { toast, ...rest } = useToastPrimitive()

  return {
    toast: {
      ...toast,
      success: (description: string) =>
        toast({
          title: "Success",
          description,
          variant: "default",
        }),
      error: (description: string) =>
        toast({
          title: "Error",
          description,
          variant: "destructive",
        }),
    },
    ...rest,
  }
}
