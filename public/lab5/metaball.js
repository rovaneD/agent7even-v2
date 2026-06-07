/* Animated metaball field — brand palette, multiply-style blend over light bg.
   Usage: <canvas class="metaball" data-seed="1"></canvas>
   Optional data-attrs: data-count, data-size, data-speed, data-bg
   Falls back to a static CSS gradient if WebGL is unavailable. */
(function () {
  const PALETTE = ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'];

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  const VERT = `
    attribute vec2 p;
    void main(){ gl_Position = vec4(p, 0.0, 1.0); }
  `;

  // Fragment: N moving balls, weighted-color metaball field, soft alpha over bg.
  function frag(count) {
    return `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uSize;
    uniform vec3  uBg;
    uniform vec2  uPos[${count}];
    uniform vec3  uCol[${count}];

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      // normalize against the larger axis so balls stay round
      float ar = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * ar, uv.y);

      float total = 0.0;
      vec3 colAcc = vec3(0.0);
      for(int i=0; i<${count}; i++){
        vec2 c = vec2(uPos[i].x * ar, uPos[i].y);
        vec2 d = p - c;
        float r = uSize;
        // steep falloff keeps each ball contained -> real light space between
        float q = (r*r) / (dot(d,d) + 0.0006);
        float m = q * q;
        total += m;
        colAcc += uCol[i] * m;
      }
      vec3 field = colAcc / max(total, 0.0001);

      // soft membrane edge; high threshold so the frame keeps light bg
      float a = smoothstep(0.9, 2.6, total);
      gl_FragColor = vec4(mix(uBg, field, a), 1.0);
    }`;
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('metaball shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function initCanvas(canvas) {
    const count = parseInt(canvas.dataset.count || '10', 10);
    const size = parseFloat(canvas.dataset.size || '0.22');
    const speed = parseFloat(canvas.dataset.speed || '1');
    const seed = parseFloat(canvas.dataset.seed || '1');
    const bg = hexToRgb(canvas.dataset.bg || '#F9F9FA');

    const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
    if (!gl) {
      canvas.style.background = 'radial-gradient(60% 60% at 55% 45%, #F5349B33, #3286FE22 40%, #F9F9FA 75%)';
      return;
    }

    const prog = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag(count));
    if (!vs || !fs) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uSize = gl.getUniformLocation(prog, 'uSize');
    const uBg = gl.getUniformLocation(prog, 'uBg');
    const uPos = gl.getUniformLocation(prog, 'uPos');
    const uCol = gl.getUniformLocation(prog, 'uCol');

    // colours per ball, cycled through palette
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = hexToRgb(PALETTE[i % PALETTE.length]);
      cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
    }
    gl.uniform3fv(uCol, cols);
    gl.uniform1f(uSize, size);
    gl.uniform3fv(uBg, bg);

    // per-ball orbital params, clustered slightly right-of-centre
    const balls = [];
    for (let i = 0; i < count; i++) {
      const a = seed * 13.0 + i * 2.399963; // golden-ish
      balls.push({
        cx: 0.52 + Math.cos(a) * 0.16,
        cy: 0.50 + Math.sin(a * 1.3) * 0.20,
        rx: 0.05 + (i % 4) * 0.022,
        ry: 0.06 + (i % 3) * 0.025,
        sx: 0.18 + (i % 5) * 0.05,
        sy: 0.15 + (i % 4) * 0.06,
        px: a,
        py: a * 1.7,
      });
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    const pos = new Float32Array(count * 2);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf, t0 = performance.now();

    function draw(now) {
      const t = reduce ? 6.0 : (now - t0) / 1000 * speed;
      for (let i = 0; i < count; i++) {
        const b = balls[i];
        pos[i * 2] = b.cx + Math.cos(t * b.sx + b.px) * b.rx;
        pos[i * 2 + 1] = b.cy + Math.sin(t * b.sy + b.py) * b.ry;
      }
      gl.uniform2fv(uPos, pos);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    draw(t0);

    // pause when offscreen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) { if (!raf && !reduce) { t0 = performance.now(); raf = requestAnimationFrame(draw); } }
          else { if (raf) { cancelAnimationFrame(raf); raf = null; } }
        });
      }, { threshold: 0.01 }).observe(canvas);
    }
  }

  function boot() {
    document.querySelectorAll('canvas.metaball').forEach(initCanvas);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__initMetaballs = boot;
})();
