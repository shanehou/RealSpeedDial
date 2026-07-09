interface Props { onOpenOptions: () => void; }
export function Guidance({ onOpenOptions }: Props) {
  return (
    <div className="guidance">
      <h1>Real Speed Dial</h1>
      <p>请先选择一个书签目录作为首页内容来源。</p>
      <button className="btn btn--primary" onClick={onOpenOptions}>选择目录</button>
    </div>
  );
}
