import type { ReactNode } from "react";

/**
 * 전체 마크다운 라이브러리를 새로 넣는 대신, 시스템 프롬프트가 모델에게 허용하는 서식
 * (굵게 **텍스트**와 줄바꿈)만 처리하는 가벼운 렌더러입니다. 번들이 커지지 않고, 스트리밍
 * 중에 "**" 가 아직 안 닫힌 상태로 와도 그냥 그 문자 그대로 보여주다가 닫히면 자연스럽게
 * 굵게 바뀌어서 별도의 예외 처리가 필요 없습니다.
 */
export function renderLiteMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={lineIndex}>
      {lineIndex > 0 && <br />}
      {renderBoldSegments(line)}
    </span>
  ));
}

function renderBoldSegments(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((part) => part !== "");
  return parts.map((part, i) => {
    const match = /^\*\*([^*]+)\*\*$/.exec(part);
    return match ? <strong key={i}>{match[1]}</strong> : <span key={i}>{part}</span>;
  });
}
