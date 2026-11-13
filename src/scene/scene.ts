import fragSrc from './scene.frag?raw';

type Vec3 = [number, number, number];

// Camera constants: keep in sync with scene.frag
const CAM_Z = 7;
const FOCAL = 1.8;
const HALF_H = CAM_Z / FOCAL; // half the visible height at z = 0

// Picking radii for the five shapes (slightly larger than the real shapes)
const RADIUS = [0.95, 0.95, 1.05, 0.95, 0.95];
const COUNT = RADIUS.length;

const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function hex(v: string): Vec3 {
  let h = v.trim().replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** Starts the SDF scene. Returns false if WebGL is unavailable. */
export function initScene(canvas: HTMLCanvasElement, hint: HTMLElement | null): boolean {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return false;
  const prog = gl.createProgram();
  if (!prog) return false;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return false;
  }
  gl.useProgram(prog);

  // one oversized triangle covers the screen
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    res: u('uRes'), t: u('uT'), camY: u('uCamY'), p: u('uP'), bg: u('uBg'),
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- state ----
  const pos: Vec3[] = Array.from({ length: COUNT }, () => [0, 0, 0] as Vec3);
  const vel: [number, number][] = Array.from({ length: COUNT }, () => [0, 0] as [number, number]);
  let home: Vec3[] = pos.map((p) => [...p] as Vec3);
  let W = 1, H = 1, aspect = 1, camY = 0, seconds = 0;
  let needsDraw = true;
  let drag: { i: number; off: [number, number]; t: number } | null = null;
  let placed = false;
  let wasLandscape = true;

  function layoutHome(): void {
    if (aspect >= 0.95) {
      // shapes sit in the left "photo" area of the front page, under the masthead
      const ax = Math.min(1, aspect / 1.78);
      home = [
        [-4.8 * ax, -0.6, 0], [-2.9 * ax, -2.1, 0.5], [-0.9 * ax, -0.3, -0.3],
        [0.9 * ax, -2.0, 0.3], [-3.0 * ax, 0.1, -1.1],
      ];
    } else {
      home = [[-0.8, 0.6, 0], [0.9, 0.0, 0.3], [-0.7, -1.0, 0.4], [0.9, -1.8, 0], [0.05, -0.5, -0.8]];
    }
  }

  function resize(): void {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8;
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(2, Math.round(W * scale));
    canvas.height = Math.max(2, Math.round(H * scale));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    aspect = W / H;
    layoutHome();
    const landscape = aspect >= 0.95;
    if (!placed || landscape !== wasLandscape) {
      home.forEach((h, i) => { pos[i] = [...h] as Vec3; });
      placed = true;
    }
    wasLandscape = landscape;
    needsDraw = true;
  }

  // ---- the paper colour comes from the CSS token --bg (must be a hex value) ----
  let paper: Vec3 = [0.91, 0.88, 0.79];
  function readTheme(): void {
    paper = hex(getComputedStyle(document.documentElement).getPropertyValue('--bg'));
    needsDraw = true;
  }
  readTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });

  // ---- picking (same camera as the shader) ----
  function drawPos(i: number): Vec3 {
    const p = pos[i];
    return [p[0], p[1] + (reduceMotion ? 0 : Math.sin(seconds * 0.8 + i * 1.7) * 0.09), p[2]];
  }

  function ray(cx: number, cy: number): { o: Vec3; d: Vec3 } {
    const ux = (cx * 2 - W) / H;
    const uy = (H - cy * 2) / H;
    const len = Math.hypot(ux, uy, FOCAL);
    return { o: [0, camY, CAM_Z], d: [ux / len, uy / len, -FOCAL / len] };
  }

  function pick(cx: number, cy: number): number {
    const r = ray(cx, cy);
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < COUNT; i++) {
      const c = drawPos(i);
      const oc: Vec3 = [r.o[0] - c[0], r.o[1] - c[1], r.o[2] - c[2]];
      const b = oc[0] * r.d[0] + oc[1] * r.d[1] + oc[2] * r.d[2];
      const cc = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - RADIUS[i] ** 2;
      const disc = b * b - cc;
      if (disc > 0) {
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < bestT) { bestT = t; best = i; }
      }
    }
    return best;
  }

  /** Where the pointer ray crosses the plane z = z. */
  function onPlane(cx: number, cy: number, z: number): [number, number] {
    const r = ray(cx, cy);
    const t = (z - r.o[2]) / r.d[2];
    return [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t];
  }

  const blocked = (e: Event): boolean =>
    e.target instanceof Element && e.target.closest('a, button, .nav, .win') !== null;
  const heroInView = (): boolean => window.scrollY < window.innerHeight * 0.8;

  function startDrag(cx: number, cy: number, e: Event): boolean {
    if (!heroInView() || blocked(e)) return false;
    const i = pick(cx, cy);
    if (i < 0) return false;
    const [px, py] = onPlane(cx, cy, pos[i][2]);
    drag = { i, off: [pos[i][0] - px, pos[i][1] - py], t: performance.now() };
    vel[i] = [0, 0];
    document.body.style.cursor = 'grabbing';
    hint?.classList.add('gone');
    return true;
  }

  function moveDrag(cx: number, cy: number): void {
    if (!drag) return;
    const i = drag.i;
    const [px, py] = onPlane(cx, cy, pos[i][2]);
    const lim = aspect * HALF_H * 0.92;
    const nx = Math.max(-lim, Math.min(lim, px + drag.off[0]));
    const ny = Math.max(-3.5, Math.min(3.5, py + drag.off[1]));
    const now = performance.now();
    const dt = Math.max(8, now - drag.t) / 16.7;
    vel[i] = [
      ((nx - pos[i][0]) / dt) * 0.6 + vel[i][0] * 0.4,
      ((ny - pos[i][1]) / dt) * 0.6 + vel[i][1] * 0.4,
    ];
    pos[i][0] = nx;
    pos[i][1] = ny;
    drag.t = now;
    needsDraw = true;
  }

  function endDrag(): void {
    drag = null;
    document.body.style.cursor = '';
  }

  window.addEventListener('mousedown', (e) => { if (e.button === 0) startDrag(e.clientX, e.clientY, e); });
  window.addEventListener('mousemove', (e) => {
    if (drag) { moveDrag(e.clientX, e.clientY); return; }
    if (heroInView() && !blocked(e)) {
      document.body.style.cursor = pick(e.clientX, e.clientY) >= 0 ? 'grab' : '';
    }
  });
  window.addEventListener('mouseup', endDrag);

  // touch: only stop the page from scrolling when a shape was actually grabbed
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (startDrag(t.clientX, t.clientY, e) && e.cancelable) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!drag) return;
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', endDrag);
  window.addEventListener('touchcancel', endDrag);

  // scrolling lowers the camera, so the shapes slide up with the hero
  function onScroll(): void {
    camY = -(window.scrollY / window.innerHeight) * (HALF_H * 2);
    needsDraw = true;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  onScroll();
  resize();

  // ---- render loop ----
  const positions = new Float32Array(COUNT * 3);
  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(2, (now - last) / 16.7);
    last = now;
    if (!reduceMotion) seconds += (dt * 16.7) / 1000;

    // throw inertia + bounce off the edges
    const lim = aspect * HALF_H * 0.92;
    for (let i = 0; i < COUNT; i++) {
      if (drag && drag.i === i) continue;
      const v = vel[i];
      if (Math.abs(v[0]) + Math.abs(v[1]) > 0.0008) {
        pos[i][0] += v[0] * dt;
        pos[i][1] += v[1] * dt;
        if (pos[i][0] > lim) { pos[i][0] = lim; v[0] *= -0.6; }
        if (pos[i][0] < -lim) { pos[i][0] = -lim; v[0] *= -0.6; }
        if (pos[i][1] > 3.5) { pos[i][1] = 3.5; v[1] *= -0.6; }
        if (pos[i][1] < -3.5) { pos[i][1] = -3.5; v[1] *= -0.6; }
        const f = Math.pow(0.93, dt);
        v[0] *= f;
        v[1] *= f;
        needsDraw = true;
      }
    }

    // keep animating while the hero is on screen; otherwise only redraw on change
    if (!reduceMotion && window.scrollY < window.innerHeight * 1.2) needsDraw = true;

    if (needsDraw) {
      for (let i = 0; i < COUNT; i++) positions.set(drawPos(i), i * 3);
      gl!.uniform2f(U.res, canvas.width, canvas.height);
      gl!.uniform1f(U.t, seconds * 0.6);
      gl!.uniform1f(U.camY, camY);
      gl!.uniform3fv(U.p, positions);
      gl!.uniform3f(U.bg, ...paper);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      needsDraw = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
}
