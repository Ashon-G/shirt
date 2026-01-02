import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Spline from '@splinetool/react-spline';

/**
 * Exclusive Shirt Landing Page — Scroll-linked 3D motion
 *
 * This version ties rotation + position (slide left) + zoom (scale) directly to
 * the user's scroll progress through the stage. No snapping — it moves on every scroll.
 *
 * TS hygiene:
 * - Minimal runtime types for Spline nodes
 * - Explicit param/return types
 * - Uses `import.meta.env.MODE` (no Node types needed)
 * - Style objects typed with `css()` helper
 */

const SCENE_URL = 'https://prod.spline.design/PDPpJC3z1w9z6ds3/scene.splinecode';
const OBJECT_NAME = 'male_tshirt'; // change if your mesh name is different

// ————————————————————————————————————————————————————————————————
// Minimal type surfaces for Spline runtime objects we touch
// ————————————————————————————————————————————————————————————————
type Vec3 = { x: number; y: number; z: number; set?: (x: number, y: number, z: number) => void };
interface SplineNode { rotation?: Vec3; position?: Vec3; scale?: Vec3 }
interface SplineAppLike {
  findObjectByName?: (name: string) => SplineNode | undefined | null;
  _scene?: { children?: SplineNode[] };
}

// Pose for a section (rotation, position, scale)
interface Pose { label: string; x: number; y: number; z: number; px: number; py: number; pz: number; s: number }

export default function App() {
  const splineAppRef = useRef<SplineAppLike | null>(null);
  const shirtRef = useRef<SplineNode | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // ————————————————————————————————————————————————————————————————
  // Keyframes across the stage (0 → 1). Add/remove poses to change the path.
  // ————————————————————————————————————————————————————————————————
  const POSES = useMemo<Pose[]>(
    () => [
      { label: 'front',             x:  0.00,           y: 0.0,              z:  0.00,           px:   0, py: 0, pz: 0, s: 1.00 },
      { label: 'quarter-left',      x:  0.06,           y: Math.PI / 4,      z: -0.04,           px: -30, py: 0, pz: 0, s: 1.08 },
      { label: 'side-left',         x:  0.00,           y: Math.PI / 2,      z:  0.00,           px: -60, py: 0, pz: 0, s: 1.18 },
      { label: 'threeQuarter-left', x: -0.06,           y: (3 * Math.PI) / 4, z:  0.04,           px: -40, py: 0, pz: 0, s: 1.12 },
      { label: 'back',              x:  0.00,           y: Math.PI,          z:  0.00,           px: -10, py: 0, pz: 0, s: 1.05 },
    ],
    []
  );

  // ————————————————————————————————————————————————————————————————
  // Helpers: setters, math, and scroll progress within the stage
  // ————————————————————————————————————————————————————————————————
  const prefersReduce = (): boolean =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setRotation = (x: number, y: number, z: number): void => {
    const t = shirtRef.current; if (!t?.rotation) return;
    try {
      typeof t.rotation.set === 'function' ? t.rotation.set(x, y, z) : (t.rotation.x = x, t.rotation.y = y, t.rotation.z = z);
    } catch (e) {
      if (import.meta.env.MODE !== 'production') console.warn('[3D] rotation set failed', e);
    }
  };
  const setPosition = (x: number, y: number, z: number): void => {
    const t = shirtRef.current; if (!t?.position) return;
    try {
      typeof t.position.set === 'function' ? t.position.set(x, y, z) : (t.position.x = x, t.position.y = y, t.position.z = z);
    } catch (e) {
      if (import.meta.env.MODE !== 'production') console.warn('[3D] position set failed', e);
    }
  };
  const setScale = (s: number): void => {
    const t = shirtRef.current; if (!t?.scale) return;
    try {
      typeof t.scale.set === 'function' ? t.scale.set(s, s, s) : (t.scale.x = s, t.scale.y = s, t.scale.z = s);
    } catch (e) {
      if (import.meta.env.MODE !== 'production') console.warn('[3D] scale set failed', e);
    }
  };

  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  const getStageProgress = (): number => {
    const el = stageRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = Math.max(1, r.height - vh); // scrollable distance while sticky
    const scrolled = clamp01((0 - r.top) / total); // 0 when stage top hits top; 1 at stage end
    return scrolled;
  };

  // Return an interpolated pose for progress p ∈ [0,1]
  const getPoseAt = (p: number): Pose => {
    const frames = POSES.length;
    if (frames === 0) return { label: 'empty', x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, s: 1 };
    if (frames === 1) return POSES[0];

    const x = clamp01(p) * (frames - 1);
    const i = Math.floor(x);
    const t = clamp01(x - i);
    const a = POSES[i];
    const b = POSES[Math.min(i + 1, frames - 1)];
    return {
      label: `mix(${a.label},${b.label})` ,
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      z: lerp(a.z, b.z, t),
      px: lerp(a.px, b.px, t),
      py: lerp(a.py, b.py, t),
      pz: lerp(a.pz, b.pz, t),
      s:  lerp(a.s,  b.s,  t),
    };
  };

  // Apply a pose immediately (no easing) so movement maps 1:1 to scroll
  const applyPose = (pose: Pose): void => {
    setRotation(pose.x, pose.y, pose.z);
    setPosition(pose.px, pose.py, pose.pz);
    setScale(pose.s);
  };

  // Scroll-linked update (rAF throttled)
  useEffect(() => {
    if (prefersReduce()) return; // respect reduced motion

    let ticking = false;
    const update = () => {
      ticking = false;
      const p = getStageProgress();
      applyPose(getPoseAt(p));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // run once initially
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [POSES]);

  // ————————————————————————————————————————————————————————————————
  // Spline loading / object lookup
  // ————————————————————————————————————————————————————————————————
  const handleLoad = (splineApp: SplineAppLike) => {
    splineAppRef.current = splineApp;

    const tryNames = [OBJECT_NAME, 'shirt', 'Tshirt', 'tshirt', 'Model', 'Mesh'];
    let found: SplineNode | undefined | null = null;
    for (const name of tryNames) {
      found = splineApp.findObjectByName?.(name);
      if (found) break;
    }
    if (!found && splineApp._scene?.children?.length) {
      found = splineApp._scene.children.find((o: SplineNode) => !!o?.rotation);
    }

    shirtRef.current = found || null;
    setIsLoaded(true);

    // Initialize to p=0 pose
    applyPose(getPoseAt(0));
  };

  return (
    <div style={styles.page}>
      {/* Showcase Stage bounds the sticky region */}
      <section ref={stageRef} style={styles.stage}>
        {/* Sticky 3D layer — moves continuously with scroll */}
        <div style={styles.canvasWrap} aria-hidden={!isLoaded}>
          <Spline scene={SCENE_URL} onLoad={handleLoad} style={styles.canvas} />
          <div style={styles.vignette} />
        </div>

        {/* Content that drives the scroll length */}
        <main style={styles.main}>
          <section style={{ ...styles.section, ...styles.hero }}>
            <div style={styles.heroInner}>
              <p style={styles.kicker}>Limited Drop</p>
              <h1 style={styles.title}>THE CIPHER TEE</h1>
              <p style={styles.subtitle}>
                An invite‑only release crafted with heavyweight cotton, premium stitching,
                and a silhouette that speaks in whispers.
              </p>
              <div style={styles.ctaRow}>
                <a href="#request" style={styles.ctaPrimary}>Request Invite</a>
                <a href="#details" style={styles.ctaGhost}>See Details</a>
              </div>
              <p style={styles.stockNote}>Only 300 units. One per customer.</p>
            </div>
          </section>

          <section id="details" style={styles.section}>
            <div style={styles.sectionInner}>
              <h2 style={styles.h2}>Built Quiet. Worn Loud.</h2>
              <ul style={styles.featureList}>
                <li>14oz combed cotton with enzyme wash</li>
                <li>Pre‑shrunk, boxy drape, dropped shoulder</li>
                <li>Double‑needle collar, taped seams</li>
                <li>Signature hem tag with serialized ID</li>
              </ul>
            </div>
          </section>

          <section style={styles.section}>
            <div style={styles.grid3}>
              <div style={styles.card}><h3 style={styles.h3}>Cut</h3><p>Boxy + cropped for a modern line that stacks with denim and cargos.</p></div>
              <div style={styles.card}><h3 style={styles.h3}>Fabric</h3><p>Dense hand feel without bulk. Softens with a matte, broken‑in finish.</p></div>
              <div style={styles.card}><h3 style={styles.h3}>Finish</h3><p>Reactive dyes for depth; holds color through seasons, not weeks.</p></div>
            </div>
          </section>

          <section style={styles.section}>
            <div style={styles.quote}>
              “This tee doesn’t shout. It codes.”
            </div>
          </section>

          <section id="request" style={{ ...styles.section, ...styles.finalCTA }}>
            <div style={styles.sectionInner}>
              <h2 style={styles.h2}>Join the list</h2>
              <form onSubmit={(e) => e.preventDefault()} style={styles.form}>
                <input required placeholder="Email address" type="email" style={styles.input} />
                <button type="submit" style={styles.ctaPrimary}>Request Invite</button>
              </form>
              <small style={styles.small}>No spam. We only email when it matters.</small>
            </div>
          </section>
        </main>
      </section>

      {/* Outside the stage: the shirt has released and scrolls away */}
      <footer style={styles.footer}>© {new Date().getFullYear()} Cipher Studio</footer>
    </div>
  );
}

// Contextual typing helper so inline objects are checked as React.CSSProperties
const css = (o: CSSProperties) => o;

const styles = {
  page: css({
    background: 'radial-gradient(1200px 600px at 70% 30%, rgba(255,255,255,0.06), rgba(255,255,255,0) 60%), #0b0d12',
    color: 'white',
    minHeight: '100vh',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    lineHeight: 1.4,
  }),
  // Stage bounds the sticky region; when the stage ends, sticky releases.
  stage: css({ position: 'relative', zIndex: 0 }),
  // Sticky canvas that scrolls with the page but only within the stage
  canvasWrap: css({ position: 'sticky', top: 0, height: '100vh', zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }),
  canvas: css({ width: '100%', height: '100%' }),
  vignette: css({ position: 'absolute', inset: 0, background: 'radial-gradient(80% 60% at 60% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.65) 100%)', mixBlendMode: 'multiply', pointerEvents: 'none' }),
  main: css({ position: 'relative', zIndex: 1, scrollBehavior: 'smooth' }),
  section: css({ minHeight: '100vh', display: 'grid', alignItems: 'center', padding: '8rem 6vw' }),
  hero: css({ paddingTop: '12vh' }),
  heroInner: css({ maxWidth: 720, backdropFilter: 'blur(6px)' }),
  kicker: css({ letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.7, fontSize: 13, marginBottom: 12 }),
  title: css({ fontSize: 'clamp(36px, 8vw, 104px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }),
  subtitle: css({ maxWidth: 560, opacity: 0.9, margin: '0 0 24px', fontSize: 18 }),
  ctaRow: css({ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0 8px' }),
  ctaPrimary: css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '14px 22px', borderRadius: 14, background: 'linear-gradient(135deg, #7e5cfb, #17c6ff)', color: '#0b0d12', fontWeight: 700, textDecoration: 'none', boxShadow: '0 10px 30px rgba(23, 198, 255, 0.25)', border: '1px solid rgba(255,255,255,0.15)' }),
  ctaGhost: css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '14px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }),
  stockNote: css({ opacity: 0.7, marginTop: 12 }),
  sectionInner: css({ maxWidth: 860 }),
  h2: css({ fontSize: 'clamp(28px, 4vw, 48px)', margin: '0 0 16px', fontWeight: 800 }),
  h3: css({ fontSize: 20, margin: '0 0 8px', fontWeight: 700 }),
  featureList: css({ display: 'grid', gap: 10, opacity: 0.92, padding: 0, listStyle: 'none', fontSize: 18 }),
  grid3: css({ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
  card: css({ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }),
  quote: css({ fontSize: 'clamp(22px, 4vw, 40px)', opacity: 0.9, fontStyle: 'italic', maxWidth: 800 }),
  finalCTA: css({ background: 'linear-gradient(180deg, rgba(126,92,251,0.06), rgba(23,198,255,0.06))', borderTop: '1px solid rgba(255,255,255,0.06)' }),
  form: css({ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }),
  input: css({ flex: '1 1 260px', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none' }),
  small: css({ opacity: 0.6, display: 'block', marginTop: 10 }),
  footer: css({ textAlign: 'center', opacity: 0.5, padding: '40px 0' }),
};
