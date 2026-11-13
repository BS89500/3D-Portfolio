precision highp float;

uniform vec2 uRes;
uniform float uT;      // animation time (shapes spin)
uniform float uCamY;   // camera height, driven by page scroll
uniform vec3 uP[5];    // shape centres
uniform vec3 uBg;      // paper colour

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// polynomial smooth minimum: lets shapes melt into each other
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.) / k;
  return min(a, b) - h * h * k * .25;
}

// five signed distance functions: sphere, rounded box, torus, capsule, octahedron
float d0(vec3 p) { return length(p - uP[0]) - .85; }

float d1(vec3 p) {
  vec3 q = p - uP[1];
  q.xz *= rot(uT * .4);
  q.xy *= rot(uT * .3);
  vec3 w = abs(q) - vec3(.52);
  return length(max(w, 0.)) + min(max(w.x, max(w.y, w.z)), 0.) - .16;
}

float d2(vec3 p) {
  vec3 q = p - uP[2];
  q.yz *= rot(1.2 + uT * .35);
  vec2 t = vec2(length(q.xz) - .78, q.y);
  return length(t) - .27;
}

float d3(vec3 p) {
  vec3 q = p - uP[3];
  q.xy *= rot(.6 + uT * .3);
  q.y -= clamp(q.y, -.55, .55);
  return length(q) - .36;
}

float d4(vec3 p) {
  vec3 q = p - uP[4];
  q.xz *= rot(uT * .5);
  q = abs(q);
  return (q.x + q.y + q.z - .95) * .57735;
}

float map(vec3 p) {
  float d = d0(p);
  d = smin(d, d1(p), .3);
  d = smin(d, d2(p), .3);
  d = smin(d, d3(p), .3);
  d = smin(d, d4(p), .3);
  return d;
}

// Bauhaus ink colours: red, blue, black, yellow, cream. Blended by proximity where shapes merge.
vec3 shade(vec3 p) {
  float w0 = exp(-d0(p) * 9.);
  float w1 = exp(-d1(p) * 9.);
  float w2 = exp(-d2(p) * 9.);
  float w3 = exp(-d3(p) * 9.);
  float w4 = exp(-d4(p) * 9.);
  vec3 c = vec3(.85, .2, .12) * w0
         + vec3(.11, .30, .60) * w1
         + vec3(.09, .08, .08) * w2
         + vec3(.94, .70, .14) * w3
         + vec3(.95, .91, .82) * w4;
  return c / (w0 + w1 + w2 + w3 + w4);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1., -1.) * .0015;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
                   e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// soft shadow cast by the shapes onto the paper
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.;
  float t = .08;
  for (int i = 0; i < 28; i++) {
    float h = map(ro + rd * t);
    res = min(res, 7. * h / t);
    t += clamp(h, .06, .7);
    if (res < .02 || t > 9.) break;
  }
  return clamp(res, 0., 1.);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = (fc * 2. - uRes) / uRes.y;

  // camera: must match ray() in scene.ts
  vec3 ro = vec3(0., uCamY, 7.);
  vec3 rd = normalize(vec3(uv, -1.8));
  vec3 L = normalize(vec3(.5, .75, .85));

  // flat paper
  vec3 col = uBg;

  // raymarch the shapes
  float t = 0.;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    if (d < .002 || t > 16.) break;
    t += d * .92;
  }

  if (t < 16.) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 base = shade(p);

    // matte, partly posterised lighting so it reads as printed ink
    float dif = clamp(dot(n, L), 0., 1.);
    float band = floor(dif * 3. + .5) / 3.;
    float light = mix(dif, band, .55);

    float ao = 1.;
    for (int k = 1; k < 4; k++) {
      float h = .12 * float(k);
      ao -= (h - map(p + n * h)) * .35 / float(k);
    }
    ao = clamp(ao, .4, 1.);

    float rim = pow(1. - max(dot(n, -rd), 0.), 3.);
    vec3 c = base * (.5 + .55 * light) * ao * (1. - rim * .22);
    col = c * mix(vec3(1.), uBg, .3);
  } else if (uCamY > -9.) {
    // shadow on a sheet of paper sitting behind the shapes (z = -2)
    float tp = (-2. - ro.z) / rd.z;
    if (tp > 0.) {
      vec3 pp = ro + rd * tp;
      float sh = softShadow(pp, L);
      col *= mix(vec3(.5, .46, .42), vec3(1.), sh);
    }
  }

  gl_FragColor = vec4(col, 1.);
}
