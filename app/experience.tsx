"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Hud from "./hud";

const HouseScene = dynamic(
  () => import("./house-scene").then((module) => module.HouseScene),
  { ssr: false },
);

export const SCENE_STAGES = [
  { progress: 0, label: "The arrival", number: "01" },
  { progress: 0.14, label: "The threshold", number: "02" },
  { progress: 0.28, label: "Welcome", number: "03" },
  { progress: 0.43, label: "Our story", number: "04" },
  { progress: 0.58, label: "What we do", number: "05" },
  { progress: 0.73, label: "Selected work", number: "06" },
  { progress: 0.88, label: "Come say hello", number: "07" },
] as const;

export function HouseExperience() {
  const progressRef = useRef(0);
  const stageVariablesRef = useRef<Record<string, number>>({});
  const [activeStage, setActiveStage] = useState(0);
  const [inside, setInside] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);

  const scrollToProgress = useCallback((progress: number) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: progress * maxScroll, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);
  const jumpTo = useCallback((index: number) => {
    scrollToProgress(SCENE_STAGES[index]?.progress ?? 0);
  }, [scrollToProgress]);
  const onPrev = useCallback(() => jumpTo(Math.max(0, activeStage - 1)), [activeStage, jumpTo]);
  const onNext = useCallback(() => jumpTo(Math.min(SCENE_STAGES.length - 1, activeStage + 1)), [activeStage, jumpTo]);
  const updateSceneState = useCallback((nextStage: number, nextInside: boolean) => {
    setActiveStage((current) => current === nextStage ? current : nextStage);
    setInside((current) => current === nextInside ? current : nextInside);
  }, []);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebglAvailable(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      setWebglAvailable(false);
    }
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollableDistance =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollableDistance > 0 ? window.scrollY / scrollableDistance : 0;
        const nextProgress = Math.min(1, Math.max(0, progress));
        progressRef.current = nextProgress;
        if (!webglAvailable) {
          let nearest = 0;
          for (let index = 1; index < SCENE_STAGES.length; index += 1) {
            if (Math.abs(nextProgress - SCENE_STAGES[index].progress) < Math.abs(nextProgress - SCENE_STAGES[nearest].progress)) nearest = index;
          }
          const nextInside = nextProgress > 0.2;
          setActiveStage((current) => current === nearest ? current : nearest);
          setInside((current) => current === nextInside ? current : nextInside);
          const t0 = Math.min(1, Math.max(0, nextProgress / 0.09));
          const ease = (value: number) => value * value * (3 - 2 * value);
          const smoothProgress = ease(t0);
          const values = {
            "--hero-o": 1 - ease(Math.min(1, Math.max(0, (t0 - 0.05) / 0.45))),
            "--wm-o": 1 - ease(Math.min(1, Math.max(0, (t0 - 0.2) / 0.6))),
            "--wm-y": -60 * smoothProgress,
            "--wm-s": 1 + 0.06 * smoothProgress,
          };
          for (const [name, value] of Object.entries(values)) {
            if (stageVariablesRef.current[name] === undefined || Math.abs(value - stageVariablesRef.current[name]) > 0.01) {
              document.documentElement.style.setProperty(name, name === "--wm-y" ? `${value.toFixed(1)}px` : String(value));
              stageVariablesRef.current[name] = value;
            }
          }
        }
      });
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [webglAvailable]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && event.target.isContentEditable) return;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes((event.target as HTMLElement)?.tagName ?? "")) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrev]);

  return (
    <>
      <a className="skip-link" href="#story-content">
        Skip the 3D experience
      </a>
      <main id="story-content">
        {!reducedMotion && (
          <div className="immersive-journey">
            <div className={`stage${inside ? " stage--in" : ""}${webglAvailable ? "" : " stage--no-webgl"}`}>
              <div className="stage__bg" aria-hidden="true" />
              <div className="stage__wordmark" aria-hidden="true">Fieldhouse</div>
              <div className="stage__canvas">
                {webglAvailable && (
                  <HouseScene
                    progressRef={progressRef}
                    activeStage={activeStage}
                    inside={inside}
                    reducedMotion={reducedMotion}
                    onState={updateSceneState}
                  />
                )}
              </div>
              {!webglAvailable && (
                <div className="stage__fallback-model" aria-hidden="true">
                  <div className="fallback__plinth">
                    <div className="fallback__house">
                      <div className="fallback__roof" />
                      <div className="fallback__body">
                        <span className="fallback__window" />
                        <span className="fallback__door" />
                        <span className="fallback__window" />
                      </div>
                    </div>
                    <span className="fallback__tree fallback__tree--left" />
                    <span className="fallback__tree fallback__tree--right" />
                  </div>
                </div>
              )}
              <div className="fx fx-grain" aria-hidden="true" />
              <div className="fx fx-vig-out" aria-hidden="true" />
              <div className="fx fx-vig-in" aria-hidden="true" />
            </div>
            <Hud
              stops={SCENE_STAGES.map((stop) => ({ id: stop.label, title: stop.label }))}
              active={activeStage}
              inside={inside}
              onPrev={onPrev}
              onNext={onNext}
              onJump={jumpTo}
            />
            <header className="experience-header">
              <a className="wordmark" href="#story-content" aria-label="Fieldhouse home">
                <span className="wordmark-symbol" aria-hidden="true">F</span>
                <span>FIELDHOUSE</span>
              </a>
              <p className="chapter-status" aria-live="polite">
                <span>{SCENE_STAGES[activeStage].number}</span>
                <span className="chapter-divider" aria-hidden="true">/</span>
                {SCENE_STAGES[activeStage].label}
              </p>
            </header>
            <div className={`landing-copy${activeStage > 1 ? " landing-copy-hidden" : ""}`}>
              <p className="eyebrow">Independent creative studio · Est. 2016</p>
              <h1>A home for<br />good ideas.</h1>
              <p className="landing-description">
                Thoughtful places, identities, and digital experiences — made to feel like they belong.
              </p>
            </div>
            <div
              className={`scroll-cue${activeStage > 0 ? " scroll-cue-hidden" : ""}`}
              aria-hidden="true"
            >
              <span className="scroll-cue-line" />
              <span>SCROLL TO EXPLORE</span>
            </div>
            <div className="journey-progress" aria-hidden="true">
              <span className={`journey-progress-fill journey-progress-fill-${activeStage}`} />
            </div>
            <div className="scroll-track" aria-hidden="true">
              {SCENE_STAGES.map((item) => (
                <div className="scroll-beat" key={item.number} />
              ))}
            </div>
            <div className="seo-story" aria-label="About Fieldhouse">
              <h2>A home for good ideas.</h2>
              <p>
                Fieldhouse is an independent creative studio shaping thoughtful places,
                identities, and digital experiences.
              </p>
              <h2>Our story</h2>
              <p>
                We bring strategy, design, and craft together to make work with a sense
                of place and a lasting point of view.
              </p>
              <h2>What we do</h2>
              <p>Brand identity, spatial design, and digital experiences — considered from the first sketch to the final detail.</p>
              <h2>Selected work</h2>
              <p>From quiet neighborhood landmarks to ambitious digital homes, we make the useful feel unforgettable.</p>
              <h2>Come say hello</h2>
              <p>Tell us what you’re imagining at hello@fieldhouse.studio.</p>
            </div>
          </div>
        )}
        <div className="reduced-journey">
          <header className="reduced-header">
            <a className="wordmark" href="#story-content" aria-label="Fieldhouse home">
              <span className="wordmark-symbol" aria-hidden="true">F</span>
              <span>FIELDHOUSE</span>
            </a>
            <span className="reduced-label">Independent creative studio</span>
          </header>
          <section className="reduced-hero">
            <div className="reduced-house" aria-hidden="true">
              <span className="reduced-roof" />
              <span className="reduced-house-body">
                <span className="reduced-window reduced-window-left" />
                <span className="reduced-door" />
                <span className="reduced-window reduced-window-right" />
              </span>
            </div>
            <p className="eyebrow">Independent creative studio · Est. 2016</p>
            <h1>A home for<br />good ideas.</h1>
            <p>Thoughtful places, identities, and digital experiences — made to feel like they belong.</p>
          </section>
          <section className="reading-section reading-section-welcome">
            <p className="eyebrow">01 / Welcome</p>
            <h2>Good work starts with a feeling.</h2>
            <p>We create places, identities, and digital experiences with warmth, purpose, and a clear point of view.</p>
          </section>
          <section className="reading-section reading-section-about">
            <p className="eyebrow">02 / Our story</p>
            <h2>Small studio.<br />Room for big ideas.</h2>
            <p>Fieldhouse brings strategy, design, and craft together to make work with a sense of place and a lasting point of view.</p>
          </section>
          <section className="reading-section reading-section-services">
            <p className="eyebrow">03 / What we do</p>
            <h2>From first sketch<br />to final detail.</h2>
            <p>Brand identity, spatial design, and digital experiences — considered as one connected story.</p>
          </section>
          <section className="reading-section reading-section-work" id="portfolio">
            <p className="eyebrow">04 / Selected work</p>
            <h2>Made to belong.</h2>
            <p>From quiet neighborhood landmarks to ambitious digital homes, we make the useful feel unforgettable.</p>
          </section>
          <section className="reading-section reading-section-contact">
            <p className="eyebrow">05 / Come say hello</p>
            <h2>There’s room<br />for what’s next.</h2>
            <p>Tell us what you’re imagining. We’d love to hear about it.</p>
            <a className="contact-link" href="mailto:hello@fieldhouse.studio">hello@fieldhouse.studio</a>
          </section>
          <footer className="reading-footer">
            <span>FIELDHOUSE</span>
            <span>Thanks for stopping by.</span>
          </footer>
        </div>
      </main>
    </>
  );
}
