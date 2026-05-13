/**
 * Starfield shader. Used on a points geometry of 12k stars. Computes per-star
 * size by random seed and modulates twinkle by time.
 */

export const starfieldVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  varying float vSeed;
  varying float vSize;
  uniform float uTime;
  void main() {
    vSeed = aSeed;
    vSize = aSize;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.85 + 0.15 * sin(uTime * 1.7 + aSeed * 12.0);
    gl_PointSize = aSize * twinkle * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const starfieldFragment = /* glsl */ `
  precision highp float;
  varying float vSeed;
  varying float vSize;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float intensity = 1.0 - smoothstep(0.05, 0.5, d);
    vec3 tint;
    float h = fract(vSeed * 17.43);
    if (h < 0.6) tint = vec3(1.0, 0.95, 0.9);
    else if (h < 0.85) tint = vec3(0.7, 0.8, 1.0);
    else tint = vec3(1.0, 0.7, 0.5);
    gl_FragColor = vec4(tint * intensity, intensity);
  }
`;
