import AbstractView from '../core/AbstractView.js';
import Store from '../core/store.js';
import ContentService from '../services/content.service.js';
import Router from '../core/router.js';
import { getDbInstance, doc, setDoc, getDoc } from '../core/firebase-init.js';

export default class BlueprintView extends AbstractView {
  constructor(params) {
    super(params);
    this.activeTab = 'blueprint';
    
    // Unified Configuration State
    this.currentCert = 'A';
    this.currentWing = 'army';
    this.curriculumTree = [];
    
    // Mock Deployment State
    this.mockSettings = { totalQuestions: 75, durationMins: 180, passPercentage: 50 };
    this.mockRules = [];
  }

  async getHtml() {
    return `
      <style>
        /* ==========================================================================
           SYSTEM BLUEPRINT & MOCK ENGINE HUD
           ========================================================================== */
        :root {
            --bg-abyss: #000000;
            --panel-bg: #0F172A;
            --panel-border: rgba(255, 255, 255, 0.1);
            
            --text-pure: #FFFFFF;
            --text-muted: #94A3B8;
            
            --admin-red: #EF4444;
            --admin-red-glow: rgba(239, 68, 68, 0.2);
            --cyber-blue: #38BDF8;
            --neon-green: #10B981;
            
            --radius-lg: 16px;
            --radius-md: 12px;
        }

        .blueprint-viewport {
            min-height: 100dvh; background-color: var(--bg-abyss);
            color: var(--text-pure); font-family: "SF Pro Display", "Inter", sans-serif;
            padding: 8.5rem 1.5rem 6.5rem 1.5rem !important; 
            box-sizing: border-box; display: flex; flex-direction: column;
        }

        .admin-layout {
            display: grid; grid-template-columns: 280px 1fr; gap: 2rem;
            max-width: 1400px; margin: 0 auto; width: 100%; flex: 1;
            animation: fadeIn 0.4s ease-out;
        }

        /* --- SIDEBAR --- */
        .admin-sidebar {
            background: var(--panel-bg); border: 1px solid var(--panel-border);
            border-radius: var(--radius-lg); padding: 2rem 1.5rem;
            display: flex; flex-direction: column; gap: 1rem; height: fit-content;
        }

        .nav-tab {
            padding: 1rem 1.25rem; border-radius: var(--radius-md); font-weight: 700; font-size: 0.95rem;
            cursor: pointer; transition: 0.2s; border: 1px solid transparent; color: var(--text-muted);
        }
        .nav-tab:hover { background: rgba(255,255,255,0.05); color: var(--text-pure); }
        .nav-tab.active { background: rgba(56, 189, 248, 0.1); color: var(--text-pure); border-color: rgba(56, 189, 248, 0.3); }

        /* --- MAIN CONTENT --- */
        .admin-content {
            background: var(--panel-bg); border: 1px solid var(--panel-border);
            border-radius: var(--radius-lg); padding: 2.5rem; min-height: 600px;
        }

        .content-header { margin-bottom: 2.5rem; border-bottom: 1px solid var(--panel-border); padding-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-end; }
        .content-header h1 { font-size: 2rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
        .content-header p { color: var(--text-muted); margin: 0; font-size: 0.95rem; }

        /* --- CONTROLS & TREE --- */
        .blueprint-controls { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .bp-select { background: #000; color: white; border: 1px solid var(--panel-border); padding: 0.8rem 1.2rem; border-radius: 8px; font-weight: 600; outline: none; cursor: pointer; font-size: 0.9rem; }
        .bp-select:focus { border-color: var(--cyber-blue); }
        
        .bp-module { background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); border-radius: 12px; padding: 1.5rem; border-left: 4px solid var(--cyber-blue); margin-bottom: 1.5rem; }
        .bp-mod-header { margin-bottom: 1rem; font-size: 1.25rem; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }
        .bp-chapter { display: flex; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--panel-border); }
        
        .btn-action { background: rgba(255,255,255,0.1); border: none; color: white; padding: 10px 20px; border-radius: 8px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-action:hover { background: var(--cyber-blue); color: #000; transform: translateY(-2px); }

        /* --- PARAMETRIC MOCK BUILDER --- */
        .mock-settings-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 3rem; }
        .ms-box { background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); border-radius: 12px; padding: 1.5rem; }
        .ms-label { font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: block; }
        .ms-input { background: transparent; border: none; color: white; font-size: 2rem; font-weight: 800; width: 100%; outline: none; border-bottom: 2px solid transparent; transition: 0.2s; }
        .ms-input:focus { border-color: var(--cyber-blue); }

        .allocation-bar { width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 0.5rem; overflow: hidden; }
        .alloc-fill { height: 100%; background: var(--cyber-blue); transition: 0.3s; width: 0%; }
        .alloc-fill.over { background: var(--admin-red); }
        .alloc-fill.perfect { background: var(--neon-green); }

        .rule-list { display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem; }
        .rule-row { display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); padding: 1rem; border-radius: 12px; }
        .rule-q-box { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 8px; }
        .rule-input { width: 60px; background: transparent; border: 1px solid var(--panel-border); color: white; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-align: center; outline: none; }
        .rule-select { flex: 1; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--panel-border); padding: 10px; border-radius: 8px; font-weight: 600; outline: none; }
        .rule-del { background: rgba(239,68,68,0.1); color: var(--admin-red); border: none; width: 36px; height: 36px; border-radius: 8px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }

        @media (max-width: 900px) {
            .admin-layout { grid-template-columns: 1fr; }
            .admin-sidebar { flex-direction: row; overflow-x: auto; padding: 1rem; }
            .nav-tab { white-space: nowrap; padding: 0.8rem 1rem; }
            .mock-settings-grid { grid-template-columns: 1fr; }
            .rule-row { flex-direction: column; align-items: stretch; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="blueprint-viewport">
          <div class="admin-layout">
              <div class="admin-sidebar">
                  <div style="color:var(--text-muted); font-size:0.75rem; font-weight:800; letter-spacing:2px; margin-bottom:1rem; text-transform:uppercase;">Admin Architecture</div>
                  <div class="nav-tab ${this.activeTab === 'blueprint' ? 'active' : ''}" data-tab="blueprint">🗂️ Curriculum Hierarchy</div>
                  <div class="nav-tab ${this.activeTab === 'mocks' ? 'active' : ''}" data-tab="mocks">🎯 Weightage Setter</div>
              </div>
              <div class="admin-content" id="adminContentArea"></div>
          </div>
      </div>
    `;
  }

  async mount() {
      const profile = Store.get('profile');
      if (!profile || profile.role !== 'admin') {
          return Router.navigateTo('./dashboard');
      }

      this.bindTabEvents();
      await this.loadConfigurationData();
      this.renderTabContent();
  }

  bindTabEvents() {
      document.querySelectorAll('.nav-tab').forEach(tab => {
          tab.onclick = () => {
              document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
              this.activeTab = tab.dataset.tab;
              this.renderTabContent();
          };
      });
  }

  async loadConfigurationData() {
      // Load Tree for current Cert/Wing
      try {
          const modules = await ContentService.getModules(this.currentCert, this.currentWing);
          let tree = [];
          for (const mod of modules) {
              const chapters = await ContentService.getChapters(this.currentCert, mod.id);
              tree.push({ ...mod, chapters });
          }
          this.curriculumTree = tree;
      } catch (e) {
          console.error("Failed to load blueprint tree:", e);
      }

      // Load Mock Settings for current Cert/Wing
      try {
          const db = getDbInstance();
          const snap = await getDoc(doc(db, 'metadata', `mockBlueprint_${this.currentCert}_${this.currentWing}`));
          if (snap.exists()) {
              const data = snap.data();
              this.mockSettings = data.settings || { totalQuestions: 75, durationMins: 180, passPercentage: 50 };
              this.mockRules = data.rules || [];
          } else {
              // Defaults if none exist
              this.mockSettings = { totalQuestions: 75, durationMins: 180, passPercentage: 50 };
              this.mockRules = [{ id: Date.now(), start: 1, end: 10, target: '' }];
          }
      } catch (e) {
          console.warn("Failed to load mock settings, using defaults.");
      }
  }

  async reloadConfiguration() {
      const cert = document.getElementById('certSelect').value;
      const wing = document.getElementById('wingSelect').value;
      
      this.currentCert = cert;
      this.currentWing = wing;
      
      document.getElementById('adminContentArea').innerHTML = `<div style="padding:4rem; text-align:center; color: var(--text-muted); font-weight: bold;">Re-calibrating Engine...</div>`;
      
      await this.loadConfigurationData();
      this.renderTabContent();
  }

  renderTabContent() {
      const contentArea = document.getElementById('adminContentArea');
      
      if (this.activeTab === 'blueprint') {
          contentArea.innerHTML = this.getBlueprintHtml();
          document.getElementById('certSelect').onchange = () => this.reloadConfiguration();
          document.getElementById('wingSelect').onchange = () => this.reloadConfiguration();
      } 
      else if (this.activeTab === 'mocks') {
          contentArea.innerHTML = this.getMockBuilderHtml();
          document.getElementById('certSelect').onchange = () => this.reloadConfiguration();
          document.getElementById('wingSelect').onchange = () => this.reloadConfiguration();
          
          this.bindMockBuilderEvents();
          this.updateMockAllocationUI();
      }
  }

  // =========================================================
  // BLUEPRINT TREE (READ-ONLY OVERVIEW)
  // =========================================================
  getBlueprintHtml() {
      let treeHtml = '';
      if (this.curriculumTree.length === 0) {
          treeHtml = `<div style="text-align:center; padding: 3rem; border: 1px dashed var(--panel-border); border-radius: 12px; color: var(--text-muted);">No architecture found for this configuration.</div>`;
      } else {
          this.curriculumTree.forEach(mod => {
              let chapsHtml = mod.chapters.map(chap => `
                  <div class="bp-chapter">
                      <div style="font-weight: 600;">${chap.title}</div>
                      <span style="color:var(--text-muted); font-family: 'JetBrains Mono'; font-size:0.75rem;">${chap.id}</span>
                  </div>
              `).join('');

              treeHtml += `
                  <div class="bp-module">
                      <div class="bp-mod-header">
                          <span>${mod.title}</span>
                          <span style="color:var(--text-muted); font-family: 'JetBrains Mono'; font-size:0.75rem;">${mod.id}</span>
                      </div>
                      ${chapsHtml}
                  </div>
              `;
          });
      }

      return `
          <div class="content-header">
              <div><h1>System Architecture</h1><p>View the active curriculum matrix.</p></div>
          </div>
          <div class="blueprint-controls">
              <select class="bp-select" id="certSelect">
                  <option value="A" ${this.currentCert === 'A' ? 'selected' : ''}>Certificate A</option>
                  <option value="B" ${this.currentCert === 'B' ? 'selected' : ''}>Certificate B</option>
                  <option value="C" ${this.currentCert === 'C' ? 'selected' : ''}>Certificate C</option>
              </select>
              <select class="bp-select" id="wingSelect">
                  <option value="army" ${this.currentWing === 'army' ? 'selected' : ''}>Army Wing</option>
                  <option value="navy" ${this.currentWing === 'navy' ? 'selected' : ''}>Navy Wing</option>
                  <option value="airforce" ${this.currentWing === 'airforce' ? 'selected' : ''}>Air Force Wing</option>
              </select>
          </div>
          <div id="blueprintTree">${treeHtml}</div>
      `;
  }

  // =========================================================
  // PARAMETRIC MOCK BUILDER
  // =========================================================
  getMockBuilderHtml() {
      let targetOptions = `<option value="">-- Select Source Target --</option>`;
      this.curriculumTree.forEach(mod => {
          targetOptions += `<optgroup label="Module: ${mod.title}">`;
          targetOptions += `<option value="MOD_${mod.id}">Entire Module: ${mod.title}</option>`;
          mod.chapters.forEach(chap => {
              targetOptions += `<option value="CHAP_${mod.id}_${chap.id}">↳ Chapter: ${chap.title}</option>`;
          });
          targetOptions += `</optgroup>`;
      });

      let rulesHtml = this.mockRules.map((rule, idx) => `
          <div class="rule-row" data-id="${rule.id}">
              <div class="rule-q-box">
                  <span style="color:var(--text-muted); font-weight:700;">Q.</span>
                  <input type="number" class="rule-input start-q" value="${rule.start}" min="1">
                  <span style="color:var(--text-muted); font-weight:700;">to</span>
                  <input type="number" class="rule-input end-q" value="${rule.end}" min="1">
              </div>
              <select class="rule-select source-target">
                  ${targetOptions.replace(`value="${rule.target}"`, `value="${rule.target}" selected`)}
              </select>
              <button class="rule-del" title="Delete Rule">×</button>
          </div>
      `).join('');

      return `
          <div class="content-header">
              <div><h1>Parametric Mock Engine</h1><p>Define exact paper patterns and weightages.</p></div>
              <button class="btn-action" id="saveMockBtn" style="background: var(--neon-green); color: black;">Deploy Engine</button>
          </div>

          <div class="blueprint-controls">
              <select class="bp-select" id="certSelect">
                  <option value="A" ${this.currentCert === 'A' ? 'selected' : ''}>Certificate A</option>
                  <option value="B" ${this.currentCert === 'B' ? 'selected' : ''}>Certificate B</option>
                  <option value="C" ${this.currentCert === 'C' ? 'selected' : ''}>Certificate C</option>
              </select>
              <select class="bp-select" id="wingSelect">
                  <option value="army" ${this.currentWing === 'army' ? 'selected' : ''}>Army Wing</option>
                  <option value="navy" ${this.currentWing === 'navy' ? 'selected' : ''}>Navy Wing</option>
                  <option value="airforce" ${this.currentWing === 'airforce' ? 'selected' : ''}>Air Force Wing</option>
              </select>
          </div>

          <div class="mock-settings-grid">
              <div class="ms-box"><span class="ms-label">Total Questions</span><input type="number" id="msTotalQ" class="ms-input" value="${this.mockSettings.totalQuestions}"></div>
              <div class="ms-box"><span class="ms-label">Duration (Mins)</span><input type="number" id="msDuration" class="ms-input" value="${this.mockSettings.durationMins}"></div>
              <div class="ms-box"><span class="ms-label">Passing Target (%)</span><input type="number" id="msPass" class="ms-input" value="${this.mockSettings.passPercentage}"></div>
          </div>

          <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); border-radius: 16px; padding: 2rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom: 1rem;">
                  <h3 style="margin:0;">Question Matrix</h3>
                  <span id="allocText" style="font-family:'JetBrains Mono'; font-weight:700; color:var(--cyber-blue);">0 Allocated</span>
              </div>
              
              <div class="allocation-bar"><div class="alloc-fill" id="allocFill"></div></div>
              <p id="allocWarning" style="color:var(--admin-red); font-size:0.85rem; display:none; margin-top: 0.5rem; font-weight: 600;">Warning: Allocation exceeds total questions.</p>

              <div class="rule-list" id="ruleListContainer">${rulesHtml}</div>
              <button class="btn-action" id="addRuleBtn" style="width:100%; margin-top:1.5rem; padding:1rem; border:1px dashed var(--panel-border); background:transparent; color:var(--text-muted);">+ Add Distribution Rule</button>
          </div>
      `;
  }

  bindMockBuilderEvents() {
      ['msTotalQ', 'msDuration', 'msPass'].forEach(id => {
          document.getElementById(id).oninput = () => {
              this.mockSettings.totalQuestions = parseInt(document.getElementById('msTotalQ').value) || 0;
              this.mockSettings.durationMins = parseInt(document.getElementById('msDuration').value) || 0;
              this.mockSettings.passPercentage = parseInt(document.getElementById('msPass').value) || 0;
              this.updateMockAllocationUI();
          };
      });

      document.getElementById('addRuleBtn').onclick = () => {
          let nextStart = 1;
          if (this.mockRules.length > 0) nextStart = parseInt(this.mockRules[this.mockRules.length - 1].end) + 1;
          let nextEnd = Math.min(nextStart + 9, this.mockSettings.totalQuestions);
          
          this.mockRules.push({ id: Date.now(), start: nextStart, end: nextEnd, target: '' });
          this.renderTabContent(); 
      };

      document.querySelectorAll('.rule-row').forEach((row, index) => {
          const ruleId = parseInt(row.dataset.id);
          row.querySelector('.start-q').oninput = (e) => { this.mockRules[index].start = parseInt(e.target.value) || 0; this.updateMockAllocationUI(); };
          row.querySelector('.end-q').oninput = (e) => { this.mockRules[index].end = parseInt(e.target.value) || 0; this.updateMockAllocationUI(); };
          row.querySelector('.source-target').onchange = (e) => { this.mockRules[index].target = e.target.value; };
          
          row.querySelector('.rule-del').onclick = () => {
              this.mockRules = this.mockRules.filter(r => r.id !== ruleId);
              this.renderTabContent();
          };
      });

      document.getElementById('saveMockBtn').onclick = async () => {
          const btn = document.getElementById('saveMockBtn');
          btn.textContent = 'Deploying...';
          try {
              const db = getDbInstance();
              await setDoc(doc(db, 'metadata', `mockBlueprint_${this.currentCert}_${this.currentWing}`), {
                  settings: this.mockSettings,
                  rules: this.mockRules,
                  updatedAt: new Date().toISOString()
              });
              btn.textContent = 'Deployed ✅';
              setTimeout(() => btn.textContent = 'Deploy Engine', 2000);
          } catch (e) {
              console.error("Save failed", e);
              btn.textContent = 'Error - Check DB Rules';
          }
      };
  }

  updateMockAllocationUI() {
      let allocated = 0;
      this.mockRules.forEach(r => { if (r.end >= r.start) allocated += (r.end - r.start + 1); });

      const total = this.mockSettings.totalQuestions;
      const text = document.getElementById('allocText');
      const fill = document.getElementById('allocFill');
      const warning = document.getElementById('allocWarning');

      text.textContent = `${allocated} / ${total} Allocated`;
      
      if (total === 0) { fill.style.width = '0%'; return; }

      const percent = Math.min((allocated / total) * 100, 100);
      fill.style.width = `${percent}%`;

      fill.className = 'alloc-fill';
      warning.style.display = 'none';

      if (allocated > total) { fill.classList.add('over'); warning.style.display = 'block'; text.style.color = 'var(--admin-red)'; } 
      else if (allocated === total) { fill.classList.add('perfect'); text.style.color = 'var(--neon-green)'; } 
      else { text.style.color = 'var(--cyber-blue)'; }
  }
}