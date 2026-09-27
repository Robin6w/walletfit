import { createContext } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const fallbackToastContext: ToastContextType = {
  toasts: [],
  showToast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
  dismissToast: () => {},
  clearToasts: () => {},
};

export const ToastContext = createContext<ToastContextType>(fallbackToastContext);
