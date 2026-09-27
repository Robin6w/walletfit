import { useContext } from "react";
import { ToastContext } from "@/shared/contexts/toastContextDef";
import type { ToastContextType } from "@/shared/contexts/toastContextDef";

export function useToast(): ToastContextType {
  return useContext(ToastContext);
}
