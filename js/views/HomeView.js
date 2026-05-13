import Router from '../core/router.js';
import AbstractView from '../core/AbstractView.js';

export default class HomeView extends AbstractView {
  constructor(params) {
    super(params);
    this.engineId = null;
    this.hasSkipped = false;
    this.timeouts = [];
    this.currentState = 'CHAOS'; 
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           AWWWARDS-TIER: FULL-SCREEN FIXED ENGINE (BEHIND NAVBAR)
           ========================================================================== */
        :root {
            --bg-deep: #030508;
            --text-pure: #FFFFFF;
            --text-muted: #8E8E93;
            --ncc-saffron: #FF9933;
            --ncc-green: #138808;
            --tech-blue: #0A84FF;
            --bg-bento: rgba(15, 20, 25, 0.4);
            --border-glass: rgba(255, 255, 255, 0.08);
            --spring: 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* 1. FULL-SCREEN FIXED VIEWPORT (Kills all scroll/spacing issues) */
        .home-viewport {
            position: fixed; 
            inset: 0; /* top: 0, right: 0, bottom: 0, left: 0 */
            width: 100vw; 
            height: 100dvh;
            background-color: #000000 !important; color: var(--text-pure);
            font-family: "SF Pro Display", "Inter", sans-serif;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; /* STRICTLY KILLS SCROLLBARS */
            cursor: pointer; box-sizing: border-box; margin: 0; padding: 0;
            z-index: 1; /* Assumes your navbar is z-index 10 or higher */
        }

        /* 2. CINEMATIC CANVAS */
        #story-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; transition: opacity 2s ease; }

        /* 3. CENTERED NARRATIVE TYPOGRAPHY */
        .narrative-layer {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            z-index: 5; pointer-events: none;
            padding-top: 4.5rem; /* Offsets visual center to account for navbar */
        }
        .story-text {
            position: absolute; font-size: clamp(3rem, 5vw, 6rem); font-weight: 300;
            letter-spacing: -0.02em; text-align: center; opacity: 0; transform: scale(0.95) translateY(20px);
            transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
            background: linear-gradient(180deg, #FFF 0%, rgba(255,255,255,0.4) 100%) !important;
            -webkit-background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            background-clip: text !important;
            color: transparent !important;
            margin: 0; padding: 0 20px; text-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .story-text.active { opacity: 1; transform: scale(1) translateY(0); }
        .story-text.exit { opacity: 0; transform: scale(1.05) translateY(-20px); filter: blur(10px); }

        .skip-hint {
            position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
            font-size: 0.75rem; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.3);
            animation: pulse-hint 2.5s infinite; z-index: 20; pointer-events: none;
        }
        @keyframes pulse-hint { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }

        /* 4. FINAL UI REVEAL (PERFECTLY CENTERED SPLIT) */
        .ui-layer {
            position: relative; z-index: 10; width: 100%; max-width: 1200px;
            margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 5rem;
            padding: 4.5rem 2rem 0 2rem; /* padding-top offsets the navbar */
            opacity: 0; pointer-events: none; transition: opacity 2s ease;
        }
        .ui-layer.revealed { opacity: 1; pointer-events: all; }

        /* LEFT: HERO HEADER */
        .hero-header { 
            flex: 1; max-width: 550px; text-align: left; 
            transform: translateX(-40px); transition: all 1.5s var(--spring) 0.5s; opacity: 0; 
        }
        .ui-layer.revealed .hero-header { transform: translateX(0); opacity: 1; }

        .sys-badge { 
            display: inline-block; padding: 8px 18px; border-radius: 50px; font-size: 0.75rem; 
            font-weight: 800; text-transform: uppercase; letter-spacing: 2px; 
            border: 1px solid rgba(255, 153, 51, 0.3); color: var(--ncc-saffron); 
            margin-bottom: 2rem; background: rgba(255, 153, 51, 0.05); backdrop-filter: blur(10px);
        }
        
        .hero-title { color: var(--text-pure); font-size: clamp(3.5rem, 5.5vw, 6rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 1.5rem 0; }
        .hero-sub { font-size: 1.15rem; color: var(--text-muted); line-height: 1.6; margin: 0 0 3rem 0; max-width: 500px; }

        .hero-actions { display: flex; gap: 1rem; justify-content: flex-start; }
        .btn { padding: 1.2rem 2.5rem; border-radius: 50px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: 0.3s; border: none; text-decoration: none; display: inline-flex; align-items: center;}
        .btn:active { transform: scale(0.96); }
        .btn-primary { background: var(--text-pure); color: #000; box-shadow: 0 0 30px rgba(255,255,255,0.1); }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 10px 40px rgba(255,255,255,0.3); }
        .btn-ghost { background: rgba(255,255,255,0.03); color: var(--text-pure); border: 1px solid var(--border-glass); backdrop-filter: blur(10px); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }

        /* RIGHT: BENTO GRID */
        .features-grid { 
            flex: 1; max-width: 500px; display: flex; flex-direction: column; gap: 1.25rem; 
            transform: translateX(40px); opacity: 0; transition: all 1.5s var(--spring) 0.8s; 
        }
        .ui-layer.revealed .features-grid { transform: translateX(0); opacity: 1; }
        
        .bento-card { 
            background: var(--bg-bento); border: 1px solid var(--border-glass); border-radius: 20px; 
            padding: 1.5rem; backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
            transition: 0.4s; display: flex; align-items: center; gap: 1.5rem; text-align: left;
        }
        .bento-card:hover { border-color: rgba(255,255,255,0.2); transform: translateX(-10px); box-shadow: 0 15px 30px rgba(0,0,0,0.5); background: rgba(20, 25, 30, 0.7); }
        
        .b-icon { width: 56px; height: 56px; flex-shrink: 0; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); color: var(--text-pure); border: 1px solid var(--border-glass); }
        .b-text { flex: 1; }
        .b-title { font-size: 1.15rem;color: var(--text-pure);font-weight: 700; margin: 0 0 0.5rem 0; letter-spacing: -0.01em; }
        .b-desc { font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin: 0; }

        @media (max-width: 1024px) {
            .home-viewport { overflow-y: auto; overflow-x: hidden; display: block; position: absolute; } /* Fallback for mobile scrolling */
            .ui-layer { flex-direction: column; justify-content: center; padding: 6rem 2rem 4rem 2rem; gap: 3rem; text-align: center; height: auto; min-height: 100vh; position: relative; }
            .hero-header { transform: translateY(30px); text-align: center; max-width: 100%; }
            .hero-sub { margin: 0 auto 2rem auto; }
            .hero-actions { justify-content: center; }
            .features-grid { max-width: 100%; width: 100%; transform: translateY(30px); }
        }
      </style>

      <div class="home-viewport" id="master-container">
          <canvas id="story-canvas"></canvas>

          <div class="narrative-layer">
              <h2 class="story-text" id="text-1">A million different paths.</h2>
              <h2 class="story-text" id="text-2">Drawn by a single call.</h2>
              <h2 class="story-text" id="text-3">United by one purpose.</h2>
              <h2 class="story-text" id="text-4">Aligned in formation.</h2>
              <h2 class="story-text" id="text-5">Forged by discipline.</h2>
          </div>
          
          <div class="skip-hint" id="skip-hint">Click anywhere to skip intro</div>

          <div class="ui-layer" id="ui-layer">
              <div class="hero-header">
                  <div class="sys-badge">National Cadet Corps LMS</div>
                  <h1 class="hero-title">Master the<br>Curriculum.</h1>
                  <p class="hero-sub">The definitive high-performance digital training platform. Study your modules, execute tactical assessments, and track your telemetry in real-time.</p>
                  
                  <div class="hero-actions">
                      <a href="./register" class="btn btn-primary" data-nav>Register Here</a>
                      <a href="./login" class="btn btn-ghost" data-nav>Access Contents! (Registered)</a>
                  </div>
              </div>

              <div class="features-grid">
                  <div class="bento-card">
                      <div class="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
                      <div class="b-text">
                          <h3 class="b-title">Structured Modules</h3>
                          <p class="b-desc">Deeply formatted syllabi covering Map Reading, Weapon Training, and Field Craft.</p>
                      </div>
                  </div>
                  <div class="bento-card">
                      <div class="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
                      <div class="b-text">
                          <h3 class="b-title">Live Telemetry</h3>
                          <p class="b-desc">Monitor operational readiness with real-time progression matrices and accuracy tracking.</p>
                      </div>
                  </div>
                  <div class="bento-card">
                      <div class="b-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                      </div>
                      <div class="b-text">
                          <h3 class="b-title">Field Deployment</h3>
                          <p class="b-desc">Execute training protocols in zero-connectivity environments. Telemetry securely caches locally and syncs upon command uplink.</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    `;
  }

  async mount() {
      // Setup Routing
      document.querySelectorAll('[data-nav]').forEach(btn => {
          btn.onclick = (e) => {
              e.preventDefault();
              const route = btn.getAttribute('href');
              if (route) {
                  this.destroy(); 
                  Router.navigateTo(route);
              }
          };
      });

      // Bind the skip listener securely to the window to ensure clicks are caught everywhere
      this.clickListener = () => this.skipIntro();
      window.addEventListener('click', this.clickListener);

      this.initCinematicEngine();
  }

  initCinematicEngine() {
      const canvas = document.getElementById('story-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      let width, height, cx, cy;
      let particles = [];
      const numParticles = window.innerWidth > 768 ? 1200 : 600;
      const phaseThresholds = {
          ORBIT: 28,
          FLAG: 22,
          SPIRAL: 16,
          GRID: 12
      };
      
      this.currentState = 'CHAOS'; // Initialized here from the class constructor
      let globalTime = 0;
      let lastFrameTime = performance.now();
      this.phaseMetrics = { state: 'CHAOS', avgDistance: Infinity };
      
      const resize = () => {
          // Precisely map to window dimensions since viewport is now fixed Fullscreen
          width = canvas.width = window.innerWidth;
          height = canvas.height = window.innerHeight;
          cx = width / 2; cy = height / 2;
      };
      window.addEventListener('resize', resize);
      resize();

      class Particle {
          constructor(index) {
              this.id = index;
              this.x = Math.random() * width;
              this.y = Math.random() * height;
              this.size = Math.random() * 2 + 0.5;
              this.baseColor = `rgba(255,255,255,0.6)`;
              this.color = this.baseColor;
              this.angle = Math.random() * Math.PI * 2;
              this.radius = Math.random() * (width > 800 ? 400 : 200) + 50;
              this.speedMod = Math.random() * 0.02 + 0.01;
              
              // Phase 3: Flag
              const flagWidth = Math.min(width * 0.8, 800);
              const flagHeight = Math.min(height * 0.5, 400);
              this.flagX = (Math.random() - 0.5) * flagWidth;
              this.flagY = (Math.random() - 0.5) * flagHeight;
              if (this.flagY < -flagHeight / 6) this.flagColor = '#FF9933';
              else if (this.flagY > flagHeight / 6) this.flagColor = '#138808';
              else this.flagColor = '#FFFFFF';

              // Phase 4: Spiral (Fibonacci)
              const phi = index * 137.508; 
              const r = 8 * Math.sqrt(index);
              this.spiralX = Math.cos(phi * Math.PI / 180) * r;
              this.spiralY = Math.sin(phi * Math.PI / 180) * r;

              // Phase 5: Grid
              const cols = Math.ceil(Math.sqrt(numParticles * (width / height)));
              const spaceX = width / cols;
              const spaceY = height / Math.ceil(numParticles / cols);
              this.gridX = (this.id % cols) * spaceX + (spaceX/2);
              this.gridY = Math.floor(this.id / cols) * spaceY + (spaceY/2);
          }

          getTarget(state, time) {
              if (state === 'ORBIT') {
                  return {
                      x: cx + Math.cos(this.angle + time * this.speedMod * 10) * this.radius,
                      y: cy + Math.sin(this.angle + time * this.speedMod * 10) * this.radius * 0.4,
                      color: this.baseColor,
                      lerpSpeed: 0.04
                  };
              }

              if (state === 'FLAG') {
                  const waveOffset = Math.sin(this.flagX * 0.01 - time * 3) * 40;
                  return {
                      x: cx + this.flagX,
                      y: cy + this.flagY + waveOffset,
                      color: this.flagColor,
                      lerpSpeed: 0.06
                  };
              }

              if (state === 'SPIRAL') {
                  return {
                      x: cx + this.spiralX,
                      y: cy + this.spiralY,
                      color: '#FFFFFF',
                      lerpSpeed: 0.05
                  };
              }

              if (state === 'GRID') {
                  return {
                      x: this.gridX,
                      y: this.gridY,
                      color: '#0A84FF',
                      lerpSpeed: 0.08
                  };
              }

              return null;
          }

          update(state, time, frameFactor) {
              const target = this.getTarget(state, time);

              if (state === 'CHAOS') {
                  this.x += Math.cos(this.angle) * 0.5 * frameFactor;
                  this.y += Math.sin(this.angle) * 0.5 * frameFactor;
                  if (this.x < 0) this.x = width; if (this.x > width) this.x = 0;
                  if (this.y < 0) this.y = height; if (this.y > height) this.y = 0;
                  this.color = this.baseColor;
              }
              else if (state === 'CONSTELLATION') {
                  this.x += Math.cos(this.angle) * 0.1 * frameFactor;
                  this.y += Math.sin(this.angle) * 0.1 * frameFactor;
                  if (this.x < 0) this.x = width; if (this.x > width) this.x = 0;
                  if (this.y < 0) this.y = height; if (this.y > height) this.y = 0;
                  this.color = 'rgba(10, 132, 255, 0.4)';
              }
              else if (target) {
                  const lerpFactor = 1 - Math.pow(1 - target.lerpSpeed, frameFactor);
                  this.x += (target.x - this.x) * lerpFactor;
                  this.y += (target.y - this.y) * lerpFactor;
                  this.color = target.color;
              }
          }

          draw() {
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
              ctx.fill();
          }
      }

      for (let i = 0; i < numParticles; i++) particles.push(new Particle(i));

      const animate = (timestamp = performance.now()) => {
          this.engineId = requestAnimationFrame(animate);
          const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
          lastFrameTime = timestamp;
          const frameFactor = Math.max(0.5, deltaSeconds * 60);
          globalTime += deltaSeconds;
          
          ctx.fillStyle = 'rgba(3, 5, 8, 0.25)'; // Trail effect
          ctx.fillRect(0, 0, width, height);

          // We pass this.currentState directly into the loop, allowing skipIntro to override it instantly!
          particles.forEach(p => { p.update(this.currentState, globalTime, frameFactor); p.draw(); });

          if (phaseThresholds[this.currentState]) {
              const sampleStride = Math.max(1, Math.floor(numParticles / 80));
              let totalDistance = 0;
              let sampleCount = 0;

              for (let i = 0; i < particles.length; i += sampleStride) {
                  const target = particles[i].getTarget(this.currentState, globalTime);
                  if (!target) continue;
                  totalDistance += Math.hypot(target.x - particles[i].x, target.y - particles[i].y);
                  sampleCount++;
              }

              this.phaseMetrics = {
                  state: this.currentState,
                  avgDistance: sampleCount > 0 ? totalDistance / sampleCount : Infinity
              };
          } else {
              this.phaseMetrics = { state: this.currentState, avgDistance: Infinity };
          }

          if (this.currentState === 'CONSTELLATION') {
              ctx.strokeStyle = 'rgba(10, 132, 255, 0.05)';
              ctx.lineWidth = 0.5;
              for (let i = 0; i < numParticles; i+=3) {
                  for (let j = i + 1; j < numParticles; j+=3) {
                      const dx = particles[i].x - particles[j].x;
                      const dy = particles[i].y - particles[j].y;
                      if (dx*dx + dy*dy < 10000) {
                          ctx.beginPath();
                          ctx.moveTo(particles[i].x, particles[i].y);
                          ctx.lineTo(particles[j].x, particles[j].y);
                          ctx.stroke();
                      }
                  }
              }
          }
      };
      animate();

      // --- ASYNCHRONOUS DIRECTOR WITH EXACT DELAYS ---
      const delay = (ms) => new Promise(res => {
          const id = setTimeout(res, ms);
          this.timeouts.push(id);
      });

      const waitForPhaseCompletion = (stateName, minDisplayMs, maxDisplayMs) => new Promise(resolve => {
          const start = performance.now();

          const tick = () => {
              if (this.hasSkipped) {
                  resolve();
                  return;
              }

              const elapsed = performance.now() - start;
              const threshold = phaseThresholds[stateName];
              const isSettled = !threshold || (
                  this.phaseMetrics.state === stateName &&
                  this.phaseMetrics.avgDistance <= threshold
              );

              if ((elapsed >= minDisplayMs && isSettled) || elapsed >= maxDisplayMs) {
                  resolve();
                  return;
              }

              requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
      });

      const playPhase = async (textNum, stateName, minDisplayMs, maxDisplayMs) => {
          if (this.hasSkipped) return;
          
          this.currentState = stateName;
          const textEl = document.getElementById(`text-${textNum}`);
          if (textEl) textEl.classList.add('active');
          
          await waitForPhaseCompletion(stateName, minDisplayMs, maxDisplayMs);
          if (this.hasSkipped) return;
          
          if (textEl) textEl.classList.replace('active', 'exit');
          
          // EXACTLY 500ms Breathing Space between phrases
          await delay(500); 
      };

      const runDirector = async () => {
          await delay(500); // Initial boot delay
          await playPhase(1, 'CHAOS', 2500, 3200);
          await playPhase(2, 'ORBIT', 2500, 4200);
          await playPhase(3, 'FLAG', 3000, 4600);
          await playPhase(4, 'SPIRAL', 2500, 4200);
          await playPhase(5, 'GRID', 2500, 4200);
          
          if (this.hasSkipped) return;
          
          this.currentState = 'CONSTELLATION';
          const uiLayer = document.getElementById('ui-layer');
          if(uiLayer) uiLayer.classList.add('revealed');
          
          const hint = document.getElementById('skip-hint');
          if(hint) hint.style.display = 'none';
          
          window.removeEventListener('click', this.clickListener);
      };

      runDirector();
  }

  skipIntro() {
      if (this.hasSkipped) return;
      this.hasSkipped = true;
      
      // 1. Clear all timing queues immediately
      this.timeouts.forEach(clearTimeout);
      
      // 2. Remove click listener
      window.removeEventListener('click', this.clickListener);
      
      // 3. Purge narrative text
      document.querySelectorAll('.story-text').forEach(t => { t.style.display = 'none'; });
      const hint = document.getElementById('skip-hint');
      if (hint) hint.style.display = 'none';

      // 4. Force the state machine to the final phase immediately
      this.currentState = 'CONSTELLATION';

      // 5. Reveal the UI without the 2-second delay
      const uiLayer = document.getElementById('ui-layer');
      if(uiLayer) {
          uiLayer.style.transitionDelay = '0s';
          uiLayer.style.transitionDuration = '1s';
          uiLayer.classList.add('revealed');
      }

      // 6. Dim the canvas so it sits properly behind the UI
      const canvas = document.getElementById('story-canvas');
      if(canvas) {
          canvas.style.opacity = '0.35';
      }
  }

  async destroy() {
      if(this.engineId) cancelAnimationFrame(this.engineId);
      this.timeouts.forEach(clearTimeout);
      window.removeEventListener('click', this.clickListener);
  }
}
