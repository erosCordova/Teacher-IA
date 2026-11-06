import { useEffect, useRef } from 'react'

/**
 * Escena WebGL propia para la portada de My Teacher IA.
 * No altera el DOM de autenticación ni necesita servicios externos.
 */
const VERTEX = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
out vec4 outColor;

mat2 spin(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float scene(vec3 p) {
  vec3 q = p;
  q.xz = spin(0.37 + (uPointer.x - .5) * .42 + sin(uTime * .13) * .07) * q.xz;
  q.yz = spin(.49 + (uPointer.y - .5) * .34 + sin(uTime * .19) * .08) * q.yz;
  vec2 ring = vec2(length(q.xy) - 1.02, q.z);
  float torus = length(ring) - .105;
  vec3 satellite = q - vec3(.02, .01, .03);
  satellite.xy = spin(.20) * satellite.xy;
  float inner = length(vec2(length(satellite.xy) - .69, satellite.z)) - .022;
  return min(torus, inner);
}

vec3 surfaceNormal(vec3 p) {
  const float e = .004;
  return normalize(vec3(
    scene(p + vec3(e, 0, 0)) - scene(p - vec3(e, 0, 0)),
    scene(p + vec3(0, e, 0)) - scene(p - vec3(0, e, 0)),
    scene(p + vec3(0, 0, e)) - scene(p - vec3(0, 0, e))
  ));
}

void main() {
  vec2 screenUV = gl_FragCoord.xy / uResolution;
  vec2 uv = (gl_FragCoord.xy - .5 * uResolution) / uResolution.y;
  float aspect = uResolution.x / uResolution.y;
  uv.x += .14 * aspect;
  vec2 lightUV = uv - vec2(-.04, -.09);

  vec3 color = mix(vec3(.004, .009, .025), vec3(.011, .027, .054),
                   smoothstep(.95, -.65, screenUV.y));
  float mist = exp(-dot(lightUV * vec2(1.1, 1.5), lightUV * vec2(1.1, 1.5)) * 1.7);
  color += vec3(.022, .088, .126) * mist;
  color += vec3(.027, .012, .057) * exp(-length(uv - vec2(.55, .3)) * 1.9);

  // Atmosfera: haces suaves que no dependen de imagenes ni de API.
  vec2 beams = normalize(lightUV + vec2(.0001));
  float lightBeams = pow(abs(sin(atan(beams.y, beams.x) * 5.0 + .4)), 20.0);
  color += vec3(.017, .064, .09) * lightBeams * mist;

  vec3 ro = vec3(0., 0., 3.75);
  vec3 rd = normalize(vec3(uv * 1.35, -1.78));
  float t = 0.;
  bool hit = false;
  vec3 pos = ro;

  for (int i = 0; i < 62; i++) {
    pos = ro + rd * t;
    float distanceToSurface = scene(pos);
    if (distanceToSurface < .004) {
      hit = true;
      break;
    }
    t += max(distanceToSurface * .84, .013);
    if (t > 9.) break;
  }

  if (hit) {
    vec3 normal = surfaceNormal(pos);
    vec3 eye = -rd;
    float fresnel = pow(1. - max(dot(normal, eye), 0.), 3.1);
    vec3 keyLight = normalize(vec3(-.55, .77, 1.3));
    vec3 fillLight = normalize(vec3(.9, -.45, .7));
    float diffuse = max(dot(normal, keyLight), 0.);
    float specular = pow(max(dot(reflect(-keyLight, normal), eye), 0.), 38.);
    float sideSpecular = pow(max(dot(reflect(-fillLight, normal), eye), 0.), 88.);
    float engraved = sin(atan(pos.y, pos.x) * 22. + pos.z * 13. + uTime * .48);
    float shine = .5 + .5 * engraved;
    vec3 midnight = vec3(.025, .055, .11);
    vec3 steel = vec3(.14, .52, .71);
    vec3 reflective = mix(midnight, steel, diffuse * .65 + shine * .11);
    reflective += fresnel * vec3(.51, .85, 1.);
    reflective += specular * vec3(.88, .95, 1.) * 1.8;
    reflective += sideSpecular * vec3(.65, .46, 1.1) * 1.25;
    reflective += .07 * vec3(.6, .8, 1.) * sin(pos.y * 9. + uTime) * sin(pos.x * 6.);
    color = reflective;
  } else {
    // Halo refractado y trazas que aportan profundidad a la geometria.
    float r = length(lightUV);
    float aura = exp(-pow(abs(r - .41) * 6.0, 2.0));
    color += vec3(.037, .15, .22) * aura * .30;
    float streak = exp(-abs(lightUV.y + .07 + lightUV.x * .10) * 38.);
    color += vec3(.025, .055, .10) * streak * mist * .25;
  }

  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - .5) * .009;
  color = color / (color + vec3(1.0));
  color = pow(max(color, vec3(0.)), vec3(.82));
  outColor = vec4(color, 1.);
}`

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export default function CinematicPortal() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      canvas.hidden = true
      return
    }

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
      canvas.hidden = true
      return
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      canvas.hidden = true
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      canvas.hidden = true
      return
    }

    const geometry = gl.createVertexArray()
    const resolution = gl.getUniformLocation(program, 'uResolution')
    const pointerUniform = gl.getUniformLocation(program, 'uPointer')
    const timeUniform = gl.getUniformLocation(program, 'uTime')
    const pointer = { x: .5, y: .5 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation = 0
    let visible = true
    let previousFrame = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.max(.5, Math.min(
        window.devicePixelRatio || 1, 1.3,
        1200 / Math.max(rect.width, 1),
        800 / Math.max(rect.height, 1),
      ))
      const width = Math.max(1, Math.round(rect.width * ratio))
      const height = Math.max(1, Math.round(rect.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const draw = (now: number) => {
      if (!visible) return
      if (now - previousFrame >= 32 || reducedMotion.matches) {
        previousFrame = now
        resize()
        gl.useProgram(program)
        gl.bindVertexArray(geometry)
        gl.uniform2f(resolution, canvas.width, canvas.height)
        gl.uniform2f(pointerUniform, pointer.x, pointer.y)
        gl.uniform1f(timeUniform, reducedMotion.matches ? 0 : now * .001)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      if (!reducedMotion.matches) {
        animation = requestAnimationFrame(draw)
      }
    }

    const onPointer = (event: PointerEvent) => {
      pointer.x = event.clientX / Math.max(window.innerWidth, 1)
      pointer.y = event.clientY / Math.max(window.innerHeight, 1)
    }
    const onVisibility = () => {
      visible = !document.hidden
      if (!visible) cancelAnimationFrame(animation)
      else animation = requestAnimationFrame(draw)
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      visible = false
      cancelAnimationFrame(animation)
      canvas.hidden = true
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onContextLost)
    animation = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animation)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      gl.deleteVertexArray(geometry)
      gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvasRef} className="cinematic-nature__portal" aria-hidden="true" />
}
