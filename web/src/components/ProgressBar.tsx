type Frame = "hero" | "about" | "building" | "ready" | "done";

const FRAMES: Frame[] = ["hero", "about", "building", "ready", "done"];

export function ProgressBar({ frame }: { frame: Frame }) {
  const pct = (FRAMES.indexOf(frame) / (FRAMES.length - 1)) * 100;

  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}