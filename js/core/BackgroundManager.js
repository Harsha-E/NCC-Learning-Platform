export default class BackgroundManager {
    static instance = null;

    static init(options = {}) {
        if (this.instance) return;
        this.instance = new BackgroundManager(options);
        this.instance.mount();
    }

    static updateColors(color1, color2) {
        if (this.instance) {
            this.instance.setColors(color1, color2);
        }
    }

    constructor(options = {}) {
        this.options = {
            color1: options.color1 || '#0f172a',
            color2: options.color2 || '#e2e8f0',
            speed: options.speed || 0.8
        };
        this.reqId = null;
        this.gl = null;
        this.canvasElement = null;
    }

    mount() {
        if (document.getElementById('global-hero-canvas')) return;

        // Add CSS if missing
        if (!document.getElementById('hero-geo-styles')) {
            const style = document.createElement('style');
            style.id = 'hero-geo-styles';
            style.innerHTML = `
                .hero-geo-canvas {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
                    z-index: -10; pointer-events: none;
                }
                .hero-geo-content {
                    position: relative; z-index: 10; width: 100%; max-width: 1200px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    padding: 2rem 1.5rem; text-align: center;
                }
                .hero-geo-title-container { overflow: hidden; margin-bottom: 0.5rem; }
                .hero-geo-title {
                    font-size: clamp(3.5rem, 10vw, 5rem);
                    line-height: 0.9; letter-spacing: -0.05em;
                    color: #ffffff; margin: 0;
                    transform: translateY(100%); opacity: 0;
                    text-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.5), -1px -1px 0 rgba(0,0,0,0.2), 1px 1px 0 rgba(0,0,0,0.2);
                }
                .hero-geo-title-1 { font-style: italic; font-weight: 300; animation: geoSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; }
                .hero-geo-title-2 { font-weight: 800; color: #f8fafc; animation: geoSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards; }
                .hero-geo-desc {
                    font-size: clamp(1.1rem, 4vw, 1.35rem); line-height: 1.6;
                    color: rgba(255,255,255,0.9); max-width: 480px; margin-top: 1.5rem; margin-bottom: 0;
                    transform: translateY(20px); opacity: 0;
                    animation: geoFadeUp 0.8s ease-out 0.6s forwards;
                    text-shadow: 0 4px 15px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6);
                    font-weight: 500;
                }
                @keyframes geoSlideUp { to { transform: translateY(0); opacity: 1; } }
                @keyframes geoFadeUp { to { transform: translateY(0); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'global-hero-canvas';
        canvas.className = 'hero-geo-canvas';
        this.canvasElement = canvas;
        document.body.appendChild(canvas);

        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (this.gl) {
            this.initWebGL(canvas, this.gl);
        }
    }

    setColors(c1Hex, c2Hex) {
        this.options.color1 = c1Hex;
        this.options.color2 = c2Hex;
        if (this.uC1 && this.uC2 && this.gl) {
            const hexToRgb = (hex) => {
                let r = 0, g = 0, b = 0;
                if (hex.length === 7) {
                    r = parseInt(hex.substring(1,3), 16)/255;
                    g = parseInt(hex.substring(3,5), 16)/255;
                    b = parseInt(hex.substring(5,7), 16)/255;
                }
                return [r,g,b];
            };
            const c1 = hexToRgb(c1Hex);
            const c2 = hexToRgb(c2Hex);
            this.gl.uniform3f(this.uC1, c1[0], c1[1], c1[2]);
            this.gl.uniform3f(this.uC2, c2[0], c2[1], c2[2]);
        }
    }

    initWebGL(canvas, gl) {
        const hexToRgb = (hex) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 7) {
                r = parseInt(hex.substring(1,3), 16)/255;
                g = parseInt(hex.substring(3,5), 16)/255;
                b = parseInt(hex.substring(5,7), 16)/255;
            }
            return [r,g,b];
        };

        const vsSource = `
            attribute vec2 aPosition;
            varying vec2 vUv;
            void main() {
                vUv = aPosition * 0.5 + 0.5;
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `;

        const fsSource = `
            precision highp float;
            uniform float uTime;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            varying vec2 vUv;

            vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

            float snoise(vec2 v){
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m; m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            float bayerDither4x4(vec2 uv) {
                float x = mod(uv.x, 4.0);
                float y = mod(uv.y, 4.0);
                int idx = int(y) * 4 + int(x);
                if(idx == 0) return 0.0/16.0; if(idx == 1) return 8.0/16.0;
                if(idx == 2) return 2.0/16.0; if(idx == 3) return 10.0/16.0;
                if(idx == 4) return 12.0/16.0; if(idx == 5) return 4.0/16.0;
                if(idx == 6) return 14.0/16.0; if(idx == 7) return 6.0/16.0;
                if(idx == 8) return 3.0/16.0; if(idx == 9) return 11.0/16.0;
                if(idx == 10) return 1.0/16.0; if(idx == 11) return 9.0/16.0;
                if(idx == 12) return 15.0/16.0; if(idx == 13) return 7.0/16.0;
                if(idx == 14) return 13.0/16.0; return 5.0/16.0;
            }

            void main() {
                vec2 uv = vUv;
                vec2 coord = gl_FragCoord.xy;
                float noise = snoise(uv * 1.5 + vec2(uTime * 0.05, uTime * 0.03)) * 0.25;
                float diagonal = (uv.x + uv.y) * 0.5;
                float gradient = diagonal * 1.2 + noise;
                
                vec3 deepBlue = uColor1; vec3 paleBlue = uColor2;
                vec3 softBlue = mix(deepBlue, paleBlue, 0.33);
                vec3 lightBlue = mix(deepBlue, paleBlue, 0.66);
                
                vec3 color;
                if (gradient < 0.3) { color = deepBlue; } 
                else if (gradient < 0.55) { color = softBlue; } 
                else if (gradient < 0.8) { color = lightBlue; } 
                else { color = paleBlue; }
                
                float dither = bayerDither4x4(coord);
                float threshold = fract(gradient * 4.0);
                
                if (gradient < 0.3 && threshold > dither * 0.5) { color = softBlue; } 
                else if (gradient >= 0.3 && gradient < 0.55 && threshold > dither * 0.5) { color = lightBlue; } 
                else if (gradient >= 0.55 && gradient < 0.8 && threshold > dither * 0.5) { color = paleBlue; }
                
                vec2 cornerDist = vec2(uv.x, uv.y);
                float fadeMask = smoothstep(0.0, 0.25, length(cornerDist));
                color = mix(vec3(1.0), color, fadeMask);
                
                float vignette = smoothstep(1.2, 0.3, length(uv - 0.5));
                color = mix(color, color * 0.95, (1.0 - vignette) * 0.3);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const compileShader = (type, source) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            return s;
        };

        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        gl.useProgram(program);

        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const posAttr = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(program, 'uTime');
        this.uC1 = gl.getUniformLocation(program, 'uColor1');
        this.uC2 = gl.getUniformLocation(program, 'uColor2');

        const c1 = hexToRgb(this.options.color1);
        const c2 = hexToRgb(this.options.color2);
        gl.uniform3f(this.uC1, c1[0], c1[1], c1[2]);
        gl.uniform3f(this.uC2, c2[0], c2[1], c2[2]);

        this.resizeHandler = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            gl.viewport(0, 0, canvas.width, canvas.height);
        };
        window.addEventListener('resize', this.resizeHandler);
        this.resizeHandler(); // initial sizing

        const speed = this.options.speed;
        const render = (time) => {
            gl.uniform1f(uTime, time * 0.001 * speed);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            this.reqId = requestAnimationFrame(render);
        };
        this.reqId = requestAnimationFrame(render);
    }
}
