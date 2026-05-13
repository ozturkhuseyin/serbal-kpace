/**
 * Engine plume shader. Used as the material on a small cone billboard at the
 * back of each engine. Produces a hot core fading to a cooler outer envelope
 * with subtle turbulence.
 */

export const exhaustVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  uniform float uLength;
  uniform float uThrottle;
  void main() {
    vec3 pos = position;
    pos.y *= mix(0.4, 1.4, uThrottle) * uLength;
    vUv = uv;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vDepth = -(viewMatrix * wp).z;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const exhaustFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vDepth;
  uniform float uTime;
  uniform float uThrottle;
  uniform vec3 uCoreColor;
  uniform vec3 uOuterColor;

  // Cheap turbulence using sin of high frequencies.
  float turbulence(vec2 uv) {
    float t = uTime * 8.0;
    float f =
      sin((uv.x + uv.y) * 18.0 + t) * 0.5 +
      sin((uv.x - uv.y) * 32.0 - t * 1.3) * 0.3 +
      sin((uv.x * 60.0) + t * 2.1) * 0.15;
    return f * 0.5 + 0.5;
  }

  void main() {
    if (uThrottle <= 0.001) discard;
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0;
    float along = 1.0 - vUv.y;
    float core = pow(center, 3.0) * along;
    float envelope = pow(center, 1.4) * along;
    float t = turbulence(vUv);
    // Hot glowing core scaled up significantly so it's clearly visible.
    vec3 col = mix(uOuterColor, uCoreColor, core * (0.7 + 0.3 * t));
    col += uCoreColor * core * 0.6;
    float alpha = (envelope * 0.85 + core * 1.4) * (0.6 + 0.4 * t) * uThrottle;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
