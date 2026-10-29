import { useSyncExternalStore } from "react";
import type { ChatMsg } from "@/v2/chat/chatModel";
import { readSession, writeSession } from "@/v2/app/storage";

/**
 * 상담 창 상태. 앱 맨 바깥 창 하나를 모든 화면이 같이 쓴다.
 *  - 열림 여부와 대화는 sessionStorage에 저장해서 화면을 넘어가거나 새로고침해도 이어진다(탭을 닫으면 처음 상태)
 *  - ask(질문): 창을 열고 질문을 바로 보낸다(결과 화면 '물어보기' 버튼 등)
 */
const OPEN_KEY = "walletfit:v2:chat-open";
const MSG_KEY = "walletfit:v2:chat-msgs";

export interface ChatState {
  open: boolean;
  msgs: ChatMsg[];
  pending: string | null;
}

let state: ChatState = {
  open: readSession<boolean>(OPEN_KEY, false),
  msgs: readSession<ChatMsg[]>(MSG_KEY, []),
  pending: null,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(next: Partial<ChatState>) {
  state = { ...state, ...next };
  emit();
}

export const chatStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setOpen(open: boolean) {
    writeSession(OPEN_KEY, open);
    setState({ open });
  },
  toggle() {
    chatStore.setOpen(!state.open);
  },
  /** 창을 열고 질문을 보낸다. 질문이 없으면 열기만 한다 */
  ask(question?: string) {
    writeSession(OPEN_KEY, true);
    setState({ open: true, pending: question?.trim() ? question.trim() : state.pending });
  },
  takePending(): string | null {
    const q = state.pending;
    if (q !== null) setState({ pending: null });
    return q;
  },
  /** persist=false: 답을 받아 쓰는 동안(스트리밍)에는 화면만 바꾸고 저장은 끝날 때 한 번 */
  setMsgs(updater: (prev: ChatMsg[]) => ChatMsg[], persist = true) {
    const msgs = updater(state.msgs);
    if (persist) writeSession(MSG_KEY, msgs);
    setState({ msgs });
  },
  reset() {
    writeSession(MSG_KEY, []);
    setState({ msgs: [], pending: null });
  },
};

export function useChatState(): ChatState {
  return useSyncExternalStore(chatStore.subscribe, chatStore.get, chatStore.get);
}
