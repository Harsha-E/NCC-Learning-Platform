window.InstallGate = (function () {
  let deferredPrompt;
  let glContext = null;
  let reqId = null;
  let resizeHandler = null;

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.matchMedia('(max-width: 768px)').matches;
  };

  const isInstalled = () => {
    if (!isMobileDevice()) return true; // Desktops always pass
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  };

  function checkAndShowGate() {
    if (isMobileDevice() && !isInstalled()) {
      renderGateUI();
      return true; // Gate is active
    } else {
      removeGateUI();
      return false; // Gate is not active
    }
  }

  function removeGateUI() {
    const overlay = document.getElementById('ncc-install-gate');
    if (overlay) {
        if (reqId) cancelAnimationFrame(reqId);
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        if (glContext) glContext.getExtension('WEBGL_lose_context')?.loseContext();
        
        overlay.remove();
        document.body.style.overflow = '';
    }
  }

  function initWebGL(canvas, gl) {
      glContext = gl;
      
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
              
              vec3 deepBlue = vec3(0.059, 0.09, 0.165); // #0f172a
              vec3 paleBlue = vec3(0.886, 0.91, 0.941); // #e2e8f0
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

      resizeHandler = () => {
          canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
          canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
          gl.viewport(0, 0, canvas.width, canvas.height);
      };
      window.addEventListener('resize', resizeHandler);
      resizeHandler();

      const render = (time) => {
          gl.uniform1f(uTime, time * 0.001 * 0.8);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          reqId = requestAnimationFrame(render);
      };
      reqId = requestAnimationFrame(render);
  }

  function renderGateUI() {
    if (document.getElementById('ncc-install-gate')) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const overlay = document.createElement('div');
    overlay.id = 'ncc-install-gate';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#000000',
      zIndex: '99999',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: '"SF Pro Display", "Inter", sans-serif',
      boxSizing: 'border-box',
      textAlign: 'center',
      overflow: 'hidden'
    });

    // 1. Setup Canvas Background
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '0',
        pointerEvents: 'none'
    });
    overlay.appendChild(canvas);

    // 2. Setup Glassmorphism Container
    const card = document.createElement('div');
    Object.assign(card.style, {
      position: 'relative',
      zIndex: '10',
      background: 'rgba(15, 23, 42, 0.4)', /* Deep dark blue, highly transparent */
      backdropFilter: 'blur(40px)',
      webkitBackdropFilter: 'blur(40px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderTop: '1px solid rgba(255, 255, 255, 0.2)', /* Subtle top highlight */
      borderRadius: '24px',
      padding: '3rem 2rem',
      maxWidth: '400px',
      width: '90%',
      boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
    });

    const logo = document.createElement('img');
    logo.src = './assets/branding/logo-primary.png';
    logo.alt = 'NCC Logo';
    Object.assign(logo.style, {
      width: '120px',
      height: '120px',
      margin: '0 auto 1.5rem auto',
      display: 'block',
      filter: 'drop-shadow(0 0 20px rgba(10, 132, 255, 0.4))',
      borderRadius: '24px' // Assuming it might need slight rounding if maskable, but it's a transparent PNG usually
    });

    const title = document.createElement('h1');
    title.innerText = 'Shape Authority';
    Object.assign(title.style, {
      fontSize: '2.5rem',
      fontWeight: '800',
      lineHeight: '1.1',
      letterSpacing: '-0.04em',
      marginBottom: '1rem',
      color: '#ffffff',
      textShadow: '0 2px 10px rgba(0,0,0,0.3)'
    });

    const message = document.createElement('p');
    message.innerText = 'High-contrast geometry with restrained motion. Install the progressive web app to access your dashboard.';
    Object.assign(message.style, {
      fontSize: '1.1rem',
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: '2.5rem',
      lineHeight: '1.5'
    });

    card.appendChild(logo);
    card.appendChild(title);
    card.appendChild(message);

    if (isIOS) {
      const iosInstructions = document.createElement('div');
      Object.assign(iosInstructions.style, {
          background: 'rgba(0,0,0,0.05)',
          padding: '1.5rem',
          borderRadius: '16px',
          textAlign: 'left',
          width: '100%',
          boxSizing: 'border-box'
      });
      iosInstructions.innerHTML = `
        <p style="margin-bottom: 12px; font-weight: 700; color: rgba(255,255,255,0.9); text-transform:uppercase; letter-spacing:1px; font-size:0.85rem;">Install Instructions:</p>
        <p style="margin-bottom: 8px; font-size:0.95rem; color:rgba(255,255,255,0.7);">1. Tap the <strong>Share</strong> button below</p>
        <p style="margin-bottom: 8px; font-size:0.95rem; color:rgba(255,255,255,0.7);">2. Scroll and tap <strong>Add to Home Screen</strong></p>
        <p style="margin-bottom: 0; font-size:0.95rem; color:rgba(255,255,255,0.7);">3. Open the newly installed App</p>
      `;
      card.appendChild(iosInstructions);
    } else {
      const installBtn = document.createElement('button');
      installBtn.innerText = 'Install Platform';
      Object.assign(installBtn.style, {
        backgroundColor: '#000000',
        color: '#ffffff',
        border: 'none',
        padding: '1.2rem 2rem',
        fontSize: '1rem',
        borderRadius: '50px',
        cursor: 'pointer',
        fontWeight: '700',
        width: '100%',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        transition: 'all 0.3s ease'
      });
      
      installBtn.onmouseover = () => { installBtn.style.transform = 'scale(1.02)'; installBtn.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)'; };
      installBtn.onmouseout = () => { installBtn.style.transform = 'scale(1)'; installBtn.style.boxShadow = 'none'; };

      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          // Trust the appinstalled event to reload the app correctly
        }
        deferredPrompt = null;
      });
      card.appendChild(installBtn);
    }

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Initialize WebGL
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
        initWebGL(canvas, gl);
    }
    
    // Lock scrolling
    document.body.style.overflow = 'hidden';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', (e) => {
    removeGateUI();
    // Reload the page completely to boot up the standalone app in its fresh state
    window.location.reload();
  });

  window.addEventListener('visibilitychange', () => {
      // Re-evaluate installation state when the user comes back to the browser tab
      if (document.visibilityState === 'visible') {
          if (isMobileDevice() && isInstalled()) {
              // They installed it and came back. Let's just reload.
              window.location.reload();
          }
      }
  });

  window.addEventListener('load', checkAndShowGate);
  window.addEventListener('resize', checkAndShowGate);

  return {
      isInstalled,
      checkAndShowGate,
      isMobileDevice
  };
})();
