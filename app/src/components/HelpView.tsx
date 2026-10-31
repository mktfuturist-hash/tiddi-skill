const STEPS = [
  "시작 메뉴에서 「캡처 도구」를 열어요",
  "오른쪽 위 … 을 눌러 「설정」으로 들어가요",
  "「스크린샷 자동 저장」을 꺼요",
];

const PROMISES = [
  ["👀", "읽기부터", "처음엔 보여 주기만 해요. 확인하신 뒤에만 휴지통 버튼이 생겨요."],
  ["🗑️", "휴지통으로만", "영구 삭제는 없어요. 언제든 되살릴 수 있어요."],
  ["☑️", "고른 것만", "자동으로 지우는 일은 없어요. 체크한 것만 움직여요."],
  ["🖼️", "사본은 그대로", "짝이 있으면 스크린샷 원본만 지우고, 내가 저장한 사본은 안 건드려요."],
  ["🔒", "인터넷 안 씀", "이 컴퓨터에서만 열리고, 아무것도 밖으로 보내지 않아요."],
];

export default function HelpView() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-card p-6 ring-1 ring-line">
        <h2 className="text-lg font-bold">스크린샷이 다시 안 쌓이게 하기</h2>
        <p className="mt-1 text-sm text-muted">캡처할 때마다 원본이 스크린샷 폴더에 자동으로 한 장 더 저장되는 설정이에요. 끄면 내가 저장한 것만 남아요.</p>
        <ol className="mt-4 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-key font-bold">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-3xl bg-card p-6 ring-1 ring-line">
        <h2 className="text-lg font-bold">TIDDI가 지키는 약속</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROMISES.map(([icon, title, body]) => (
            <li key={title} className="flex gap-3 rounded-2xl bg-cream p-3 text-sm">
              <span className="text-xl">{icon}</span>
              <span>
                <b className="block">{title}</b>
                <span className="text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
