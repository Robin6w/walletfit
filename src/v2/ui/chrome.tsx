import { createContext, useContext, type ComponentType } from "react";
import type { MenuId, StepPill } from "@/v2/ui/TopBar";

/**
 * 화면 머리줄 바꿔 끼우기(2026-11-07, 모바일 사이트).
 * PC 사이트(AppV2)는 아무것도 넣지 않아 지금 머리줄을 그대로 쓰고,
 * 모바일 사이트(src/mobile)는 자기 머리줄을 넣어 같은 화면 본문을 휴대폰 틀로 보여 준다.
 */
export interface Chrome {
  MenuBar?: ComponentType<{ active: MenuId }>;
  WizardBar?: ComponentType<{ sub: string; steps: StepPill[] }>;
  /** 휴대폰용으로 줄을 촘촘하게(카드 목록·지출 입력 한 줄 배치). 모바일 사이트만 켠다 */
  compact?: boolean;
}

export const ChromeContext = createContext<Chrome>({});

export function useChrome(): Chrome {
  return useContext(ChromeContext);
}
