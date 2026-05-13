/**
 * Terrain shader. Procedurally tints the planet surface using a per-body
 * palette plus latitude/biome mask so even flat sphere meshes look varied.
 */

export const terrainVertex = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying float vElevation;

  uniform float uTerrainAmplitude;
  uniform float uTime;

  // 3D simplex-ish noise — fast and good enough for a base bump.
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 =   v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
      i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
      i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vec3 n = normalize(position);
    // Multi-octave fbm: continents (low freq), ranges (mid), detail (high)
    float continents = snoise(n * 1.6);
    float ranges = snoise(n * 5.5) * 0.55;
    float detail = snoise(n * 20.0) * 0.22;
    float h = continents + ranges + detail;
    // Normalised elevation roughly in [-1, 1]
    vElevation = clamp(h * 0.55, -1.0, 1.0);
    vec3 displaced = position + n * vElevation * uTerrainAmplitude;
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    vLocalPos = displaced;
    vNormal = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const terrainFragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying float vElevation;

  uniform vec3 uSunDirection;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform vec3 uColorPole;
  uniform float uPlanetRadius;
  uniform float uOceanLevel;
  uniform float uHasAtmosphere;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);

    float lat = abs(normalize(vLocalPos).y);
    // Map elevation [-1, 1] to [0, 1] for biome blending.
    float h = vElevation * 0.5 + 0.5;

    // Ocean: when elevation is below the ocean level (only wet planets).
    vec3 ocean = vec3(0.04, 0.16, 0.38);
    vec3 oceanShallow = vec3(0.10, 0.40, 0.60);
    float belowOcean = step(h, uOceanLevel);
    vec3 oceanColour = mix(oceanShallow, ocean, smoothstep(uOceanLevel - 0.08, uOceanLevel - 0.18, h));

    // Land biome blend. For wet planets uColorLow is the deep-ocean tint, so
    // land starts at uColorMid (grass/sand) and climbs to uColorHigh
    // (mountain). For dry planets we use the full low → mid → high range.
    vec3 land;
    if (uOceanLevel >= 0.0) {
      float landH = clamp((h - uOceanLevel) / max(1.0 - uOceanLevel, 0.001), 0.0, 1.0);
      vec3 beach = mix(uColorMid, vec3(0.78, 0.72, 0.45), 0.55);
      vec3 lower = mix(beach, uColorMid, smoothstep(0.0, 0.18, landH));
      vec3 upper = mix(uColorMid, uColorHigh, smoothstep(0.18, 0.85, landH));
      land = mix(lower, upper, smoothstep(0.05, 0.28, landH));
      // Rocky peaks
      land = mix(land, uColorHigh * 1.05, smoothstep(0.7, 0.95, landH));
    } else {
      if (h < 0.4) land = mix(uColorLow, uColorMid, smoothstep(0.0, 0.4, h));
      else        land = mix(uColorMid, uColorHigh, smoothstep(0.4, 1.0, h));
    }
    // Polar ice cap blend by latitude.
    vec3 surface = mix(land, uColorPole, smoothstep(0.78, 0.92, lat));
    surface = mix(surface, oceanColour, belowOcean);
    // Coastal foam at the waterline for wet planets.
    float coastBand = 1.0 - smoothstep(0.0, 0.02, abs(h - uOceanLevel));
    surface = mix(surface, vec3(0.85, 0.92, 0.95), coastBand * step(0.0, uOceanLevel) * 0.6);

    float ndl = max(dot(N, L), 0.0);
    float ambient = 0.16 + 0.06 * uHasAtmosphere;
    vec3 lit = surface * (ambient + ndl * 1.0);

    // Subtle rim glow on atmospheric worlds for sunset feel.
    if (uHasAtmosphere > 0.5) {
      float rim = 1.0 - clamp(dot(N, normalize(cameraPosition - vWorldPos)), 0.0, 1.0);
      lit += vec3(1.0, 0.55, 0.3) * rim * 0.22 * ndl;
    }

    gl_FragColor = vec4(lit, 1.0);
  }
`;
