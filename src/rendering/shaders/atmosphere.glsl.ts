/**
 * Atmosphere shader pair (vertex + fragment) implementing a single-pass
 * Rayleigh + Mie approximation. Designed to be cheap enough for browser
 * use while still producing the characteristic blue-purple-amber gradients.
 *
 * Strings are exported instead of .glsl files so they bundle without a
 * loader plugin.
 */

export const atmosphereVertex = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const atmosphereFragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  uniform vec3 uPlanetCenter;
  uniform float uPlanetRadius;
  uniform float uAtmosphereRadius;
  uniform vec3 uSunDirection;
  uniform vec3 uCameraPos;
  uniform vec3 uAtmosphereColor;
  uniform float uIntensity;

  // Schlick-style cheap atmosphere approximation. We compute the chord through
  // the atmosphere shell then modulate by sun direction for day-night gradient.
  void main() {
    vec3 V = normalize(vWorldPos - uCameraPos);
    vec3 L = normalize(uSunDirection);
    vec3 P = vWorldPos;

    vec3 toCenter = P - uPlanetCenter;
    float distFromCenter = length(toCenter);
    float shell = clamp(
      (distFromCenter - uPlanetRadius) / max(uAtmosphereRadius - uPlanetRadius, 1.0),
      0.0, 1.0
    );

    // View-dot-normal term for limb glow.
    vec3 N = normalize(toCenter);
    float rim = 1.0 - clamp(dot(N, -V), 0.0, 1.0);
    rim = pow(rim, 2.5);

    // Sun position term: brighter on the day side.
    float sun = clamp(dot(N, L) * 0.6 + 0.5, 0.0, 1.0);

    // Mie forward-scatter halo around the sun.
    float mie = pow(clamp(dot(V, -L), 0.0, 1.0), 8.0);

    vec3 dayColor = uAtmosphereColor;
    vec3 sunsetColor = mix(uAtmosphereColor, vec3(1.0, 0.55, 0.25), 0.55);
    vec3 nightColor = uAtmosphereColor * 0.05;

    // Day side richer; sunset where sun grazes; night dark.
    float terminator = smoothstep(-0.15, 0.25, dot(N, L));
    vec3 base = mix(nightColor, mix(sunsetColor, dayColor, terminator), terminator);
    vec3 col = base * (rim * 1.6 + 0.2 * shell) * uIntensity;
    col += dayColor * mie * 0.6;

    float alpha = clamp(rim * 1.4 + mie * 0.8, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;
