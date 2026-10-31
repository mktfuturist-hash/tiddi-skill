import { thumbUrl } from "./usePairs";

// 내 사진을 작게 보여 줘요. 화면에 보일 때만 불러와요
export default function Thumb({ path, className = "" }: { path: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 내 컴퓨터 파일을 그대로 보여 주는 거라 next/image 최적화가 필요 없어요
    <img src={thumbUrl(path)} alt="" loading="lazy" decoding="async" className={`rounded-lg bg-line object-cover ${className}`} />
  );
}
