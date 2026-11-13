"use client";

/** Fires confetti unless the user prefers reduced motion. */
export async function celebrate(kind: "first" | "champion" = "first") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#8b5cf6", "#a78bfa", "#facc15", "#22d3ee", "#f472b6"];
  if (kind === "champion") {
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  } else {
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors });
  }
}
