// TIDDI 로고와 슬로건. 이름 뜻: Tidy files, more space.
export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 로고 한 장이라 next/image 최적화가 필요 없어요 */}
      <img src="/tiddi.png" alt="" className={`rounded-[22%] shadow-sm ${small ? "size-9" : "size-10"}`} />
      <span className="text-left leading-tight">
        <span className={`block font-extrabold tracking-tight ${small ? "text-lg" : "text-xl"}`}>TIDDI</span>
        <span className="block text-[11px] font-semibold text-muted">Tidy files, more space.</span>
      </span>
    </span>
  );
}
