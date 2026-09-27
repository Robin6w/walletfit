/**
 * lucide-react 패키지에 타입 선언 파일이 포함되어 있지 않아(v1.33.0 배포본 확인됨)
 * `tsc -b` 빌드가 실패하는 문제를 막기 위한 최소 선언입니다.
 * 아이콘은 모두 React 컴포넌트이므로 범용 컴포넌트 타입으로 선언합니다.
 */
declare module "lucide-react" {
  import type { FC, SVGProps } from "react";
  export type LucideIcon = FC<SVGProps<SVGSVGElement> & { size?: number | string }>;
  const icon: LucideIcon;
  export default icon;
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const CreditCard: LucideIcon;
  export const FileText: LucideIcon;
  export const Home: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const Info: LucideIcon;
  export const Key: LucideIcon;
  export const LayoutGrid: LucideIcon;
  export const MessageCircle: LucideIcon;
  export const Plus: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const Receipt: LucideIcon;
  export const Send: LucideIcon;
  export const Settings: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Tag: LucideIcon;
  export const Trash2: LucideIcon;
  export const Upload: LucideIcon;
  export const Wallet: LucideIcon;
  export const X: LucideIcon;
  export const Zap: LucideIcon;
}
