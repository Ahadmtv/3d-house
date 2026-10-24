"use client";

export type HudStop = { id: string; title: string };

type HudProps = {
  stops: HudStop[];
  active: number;
  inside: boolean;
  onPrev(): void;
  onNext(): void;
  onJump(index: number): void;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export default function Hud({ stops, active, inside, onPrev, onNext, onJump }: HudProps) {
  const total = stops.length;
  const title = stops[active]?.title ?? "";
  const pct = total ? ((active + 1) / total) * 100 : 0;
  const find = (pattern: RegExp) => stops.findIndex((stop) => pattern.test(`${stop.id} ${stop.title}`));
  const nav = [
    { label: "Story", index: find(/story/i) },
    { label: "Work", index: find(/what we do|work/i) },
    { label: "Contact", index: total - 1 },
  ].filter((item, _, all) => item.index >= 0 && all.findIndex((other) => other.index === item.index) === all.indexOf(item));

  return (
    <div className={`hud ${inside ? "hud--in" : "hud--out"}`}>
      <header className="hud__top">
        <button type="button" className="hud__brand" onClick={() => onJump(0)} aria-label="Fieldhouse, back to start">
          <span className="hud__mark" aria-hidden="true">F</span>
          <span className="lbl hud__word">Fieldhouse</span>
        </button>
        <nav className="hud__nav" aria-label="Primary">
          {nav.map((item) => (
            <button key={item.label} type="button" onClick={() => onJump(item.index)}>{item.label}</button>
          ))}
          <button type="button" className="hud__pill" onClick={() => onJump(total - 1)}>Start a project</button>
        </nav>
        <span className="lbl hud__chapter" aria-live="polite">({pad2(active + 1)}) {title}</span>
      </header>

      <section className="hero" aria-hidden={inside}>
        <div className="lbl hero__eyebrow">(01) {stops[0]?.title ?? "The Arrival"}</div>
        <h1>Small studio,<br /><i>room for big ideas.</i></h1>
      </section>
      <p className="intro" aria-hidden={inside}>Step through the door. Each room holds one chapter of our work, hung on the wall like a print.</p>
      <button type="button" className="scroll" onClick={onNext} aria-label="Scroll to enter">
        <span className="scroll__arrow" aria-hidden="true">↓</span>Scroll
      </button>

      <footer className="bar bar--out">
        <span>{pad2(active + 1)}</span>
        <div className="bar__track"><div className="bar__fill" style={{ width: `${pct}%` }} /></div>
        <span className="bar__total">{pad2(total)}</span>
        <span className="bar__est">Est. MMXVI</span>
      </footer>
      <footer className="bar bar--in">
        <div className="bar__title">{title}</div>
        <div className="bar__mid">
          <span>{pad2(active + 1)}</span>
          <div className="bar__track bar__track--wide"><div className="bar__fill" style={{ width: `${pct}%` }} /></div>
          <span>{pad2(total)}</span>
        </div>
        <div className="bar__btns">
          <button type="button" aria-label="Previous chapter" onClick={onPrev} disabled={active === 0}>←</button>
          <button type="button" aria-label="Next chapter" onClick={onNext} disabled={active === total - 1}>→</button>
        </div>
      </footer>
    </div>
  );
}
