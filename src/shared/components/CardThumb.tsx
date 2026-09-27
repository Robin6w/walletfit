import { useState } from "react";
import { CreditCard } from "lucide-react";

interface CardThumbProps {
  imageUrl?: string;
  name: string;
  size?: number;
  /** height / width 비율. 기본값(0.72)은 실물 카드의 가로형 비율이고, 1보다 큰 값을 주면 세로로 길쭉한 박스가 됩니다. */
  ratio?: number;
  /**
   * "contain"(기본값)은 카드 전체가 잘리지 않고 다 보이도록 원본 비율을 유지합니다. 카드
   * 실물 이미지는 가로형(전통적인 카드 비율)과 세로형(요즘 나오는 세로 디자인 카드)이 섞여
   * 있어서, 박스 비율과 다르면 위아래(또는 좌우)에 여백이 생길 수 있지만 카드 디자인 자체는
   * 잘리지 않습니다. "cover"는 여러 장을 겹쳐서 쌓아 보여주는 곳(카드 스택)처럼, 카드 전체가
   * 보이는 것보다 겹쳤을 때 빈 여백 없이 깔끔한 모양이 더 중요한 곳에만 예외적으로 씁니다.
   */
  fit?: "contain" | "cover";
}

/**
 * 추천 목록/조합 결과 등에서 카드 실물 이미지를 작게 보여주는 공용 썸네일.
 * 이미지가 없거나 로드에 실패하면 카드 아이콘으로 대체합니다.
 */
export function CardThumb({ imageUrl, name, size = 28, ratio = 0.72, fit = "contain" }: CardThumbProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(imageUrl) && !imgError;

  return (
    <div
      style={{ width: size, height: size * ratio }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-gradient-to-br from-slate-100 to-slate-200"
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className={fit === "cover" ? "h-full w-full object-cover object-top" : "h-full w-full object-contain"}
        />
      ) : (
        <CreditCard className="h-[55%] w-[55%] text-slate-400" />
      )}
    </div>
  );
}
