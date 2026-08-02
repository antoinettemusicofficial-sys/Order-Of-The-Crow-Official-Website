/* =========================================================
   ORDER OF THE CROW — liquid-hero.js
   Recreation of Linkin Park's mouse-drag liquid-displacement hero,
   using the Dead Man album art as the source image.

   How it works (no libraries, pure WebGL2):
   - A low-res "field" texture stores a displacement vector (RG) +
     intensity (B) per pixel. Ping-ponged between two framebuffers.
   - SIM pass: each frame it diffuses (blurs) + decays the field, then
     adds a soft splat at the mouse pushed in the mouse's move direction.
     Diffuse + slow decay = the lingering "watercolor" bloom you can
     keep painting into.
   - RENDER pass: samples the album art, offsetting UVs by the field
     with a slight per-channel (chromatic) split for the liquid look.
   Falls back to the CSS background image if WebGL2 is unavailable.
   ========================================================= */

(() => {
  const canvas = document.getElementById('liquidHero');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl || reduceMotion) return; // CSS background image remains as fallback

  // float render targets are required for the field
  const extF = gl.getExtension('EXT_color_buffer_float');
  const extH = gl.getExtension('EXT_color_buffer_half_float');
  if (!extF && !extH) return;
  const FIELD_TYPE = extF ? gl.FLOAT : gl.HALF_FLOAT;

  /* ---------- shader helpers ---------- */
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[liquid-hero] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const program = (vsSrc, fsSrc) => {
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[liquid-hero] link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  };

  const VERT = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const SIM = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_prev;
  uniform vec2  u_res;      // sim resolution
  uniform vec2  u_mouse;    // 0..1
  uniform vec2  u_vel;      // mouse velocity (uv/frame)
  uniform float u_aspect;   // width / height
  uniform float u_active;   // 1 while pointer present
  void main(){
    vec2 texel = 1.0 / u_res;
    vec4 c = texture(u_prev, v_uv);
    vec4 l = texture(u_prev, v_uv - vec2(texel.x, 0.0));
    vec4 r = texture(u_prev, v_uv + vec2(texel.x, 0.0));
    vec4 t = texture(u_prev, v_uv + vec2(0.0, texel.y));
    vec4 b = texture(u_prev, v_uv - vec2(0.0, texel.y));
    vec4 diff = (l + r + t + b) * 0.25;
    vec4 field = mix(c, diff, 0.22);   // diffuse (watercolor spread)
    field *= 0.984;                    // decay (lingering fade)

    // soft splat at mouse, aspect-corrected so it's round
    vec2 duv = v_uv - u_mouse; duv.x *= u_aspect;
    float d = length(duv);
    float infl = exp(-d * d / 0.0040) * u_active;
    field.xy += u_vel * infl * 42.0;              // push in move direction
    field.z  += infl * length(u_vel) * 26.0;      // intensity -> color fringe

    field.xy = clamp(field.xy, -1.0, 1.0);
    field.z  = clamp(field.z, 0.0, 1.5);
    outColor = field;
  }`;

  const RENDER = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_image;
  uniform sampler2D u_field;
  uniform vec2 u_imgScale;
  uniform vec2 u_imgOffset;
  void main(){
    vec4 f = texture(u_field, v_uv);
    vec2 disp = f.xy * 0.13;                 // displacement strength
    vec2 base = v_uv * u_imgScale + u_imgOffset;
    // chromatic split along displacement = liquid/watercolor edge
    float rr = texture(u_image, base + disp * 1.00).r;
    float gg = texture(u_image, base + disp * 0.60).g;
    float bb = texture(u_image, base + disp * 0.30).b;
    vec3 col = vec3(rr, gg, bb);
    // luminous blue bloom where the field is energized (on-brand)
    col += vec3(0.12, 0.32, 0.75) * clamp(f.z, 0.0, 1.0) * 0.28;
    outColor = vec4(col, 1.0);
  }`;

  const simProg = program(VERT, SIM);
  const renderProg = program(VERT, RENDER);
  if (!simProg || !renderProg) return;

  /* ---------- geometry (fullscreen triangle) ---------- */
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(simProg, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  /* ---------- field ping-pong targets ---------- */
  const makeTarget = (w, h) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, FIELD_TYPE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  };

  let simW = 0, simH = 0, a = null, b = null;
  const allocField = () => {
    simW = Math.max(2, Math.floor(canvas.width / 4));  // quarter-res sim
    simH = Math.max(2, Math.floor(canvas.height / 4));
    a = makeTarget(simW, simH);
    b = makeTarget(simW, simH);
  };

  /* ---------- source image texture ---------- */
  const imgTex = gl.createTexture();
  let imgReady = false, imgW = 1, imgH = 1;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    imgW = img.naturalWidth; imgH = img.naturalHeight;
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    imgReady = true;
  };
  img.src = 'assets/dead-man-album-art.jpg';

  // cover-fit: map canvas uv -> image uv keeping aspect (crop, no stretch)
  let imgScale = [1, 1], imgOffset = [0, 0];
  const computeCover = () => {
    const ca = canvas.width / canvas.height;
    const ia = imgW / imgH;
    if (ca > ia) { const s = ia / ca; imgScale = [1, s]; imgOffset = [0, (1 - s) / 2]; }
    else         { const s = ca / ia; imgScale = [s, 1]; imgOffset = [(1 - s) / 2, 0]; }
  };

  /* ---------- resize ---------- */
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w; canvas.height = h;
    allocField();
    computeCover();
  };

  /* ---------- pointer tracking ---------- */
  const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0, active: 0 };
  const setPos = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (clientX - r.left) / r.width;
    mouse.y = 1 - (clientY - r.top) / r.height; // flip Y for GL
    mouse.active = 1;
  };
  const hero = document.getElementById('hero');
  hero.addEventListener('mousemove', (e) => setPos(e.clientX, e.clientY));
  hero.addEventListener('mouseleave', () => { mouse.active = 0; });
  hero.addEventListener('touchmove', (e) => {
    if (e.touches[0]) setPos(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  hero.addEventListener('touchend', () => { mouse.active = 0; });

  /* ---------- render loop ---------- */
  const uSim = {
    prev: gl.getUniformLocation(simProg, 'u_prev'),
    res: gl.getUniformLocation(simProg, 'u_res'),
    mouse: gl.getUniformLocation(simProg, 'u_mouse'),
    vel: gl.getUniformLocation(simProg, 'u_vel'),
    aspect: gl.getUniformLocation(simProg, 'u_aspect'),
    active: gl.getUniformLocation(simProg, 'u_active'),
  };
  const uRen = {
    image: gl.getUniformLocation(renderProg, 'u_image'),
    field: gl.getUniformLocation(renderProg, 'u_field'),
    scale: gl.getUniformLocation(renderProg, 'u_imgScale'),
    offset: gl.getUniformLocation(renderProg, 'u_imgOffset'),
  };

  resize();
  window.addEventListener('resize', resize);

  const frame = () => {
    // smoothed velocity from pointer delta
    mouse.vx = (mouse.x - mouse.px);
    mouse.vy = (mouse.y - mouse.py);
    mouse.px = mouse.x; mouse.py = mouse.y;

    // ---- SIM pass (into b, reading a) ----
    gl.useProgram(simProg);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.uniform1i(uSim.prev, 0);
    gl.uniform2f(uSim.res, simW, simH);
    gl.uniform2f(uSim.mouse, mouse.x, mouse.y);
    gl.uniform2f(uSim.vel, mouse.vx, mouse.vy);
    gl.uniform1f(uSim.aspect, canvas.width / canvas.height);
    gl.uniform1f(uSim.active, mouse.active);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [a, b] = [b, a]; // swap

    // ---- RENDER pass (to screen) ----
    if (imgReady) {
      gl.useProgram(renderProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.uniform1i(uRen.image, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform1i(uRen.field, 1);
      gl.uniform2f(uRen.scale, imgScale[0], imgScale[1]);
      gl.uniform2f(uRen.offset, imgOffset[0], imgOffset[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
