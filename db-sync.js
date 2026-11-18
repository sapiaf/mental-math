/**
 * db-sync.js - Modulo di sincronizzazione Cloud con Supabase
 * Gestisce l'autenticazione utente (Email/Password, Magic Link) e la sincronizzazione
 * automatica e bidirezionale dei dati di Calcolo a Mente tra più dispositivi.
 */

(function(){
  // Configurazione predefinita (può essere compilata qui o impostata direttamente dall'app)
  const DEFAULT_CONFIG = {
    url: 'https://uzzlomuxlkswkujszexj.supabase.co',      // es: 'https://abcdefgh.supabase.co'
    anonKey: 'sb_publishable_gTe8tdkpxDtyCTKufSU8cA_A9YUSeo6'  // es: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  };

  const LS_CONFIG_KEY = 'calcolo_supabase_cfg';
  let supabaseClient = null;
  let currentUser = null;
  let syncInProgress = false;

  // Recupera configurazione salvata (da file o da localStorage)
  function getConfig(){
    try {
      const stored = JSON.parse(localStorage.getItem(LS_CONFIG_KEY) || '{}');
      return {
        url: stored.url || DEFAULT_CONFIG.url || '',
        anonKey: stored.anonKey || DEFAULT_CONFIG.anonKey || ''
      };
    } catch(e){
      return DEFAULT_CONFIG;
    }
  }

  function saveConfig(url, anonKey){
    const cfg = { url: url.trim(), anonKey: anonKey.trim() };
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(cfg));
    initClient();
  }

  function initClient(){
    const cfg = getConfig();
    if(cfg.url && cfg.anonKey && window.supabase && typeof window.supabase.createClient === 'function'){
      try {
        supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        return true;
      } catch(e){
        console.warn('Errore inizializzazione Supabase:', e);
        supabaseClient = null;
      }
    }
    return false;
  }

  // Adapter esposto all'app Calcolo a Mente
  window.CalcoloDbAdapter = {
    async init(state, { setSync, saveLocal, renderAll, mergeFacts, mergeHist }){
      initClient();
      if(!supabaseClient){
        setSync('Salvataggio locale (offline)');
        updateHeaderBtn(null);
        return;
      }

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if(session && session.user){
          currentUser = session.user;
          updateHeaderBtn(currentUser);
          setSync('Sincronizzazione cloud…');
          
          // Recupera i dati remoti
          const { data, error } = await supabaseClient
            .from('user_calcolo')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

          if(data && !error){
            // Merge intelligente: unisce i dati cloud con quelli locali
            state.facts = mergeFacts(data.facts || {}, state.facts || {});
            state.history = mergeHist(data.history || [], state.history || []);
            if(data.settings) Object.assign(state.settings, data.settings);
            saveLocal();
            renderAll();
            
            // Rimanda su il dato unificato per allineare entrambi
            await window.CalcoloDbAdapter.save(state, { setSync });
          } else if(error && error.code === 'PGRST116'){
            // Prima volta che l'utente si connette: carica i dati locali sul cloud
            await window.CalcoloDbAdapter.save(state, { setSync });
          }
          setSync('Sincronizzato sul cloud ☁️');
        } else {
          updateHeaderBtn(null);
          setSync('Salvataggio locale (offline)');
        }

        // Ascolta variazioni di autenticazione (login/logout/token refresh)
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
          if(event === 'SIGNED_IN' && session){
            currentUser = session.user;
            updateHeaderBtn(currentUser);
            setSync('Accesso effettuato, sincronizzo…');
            location.reload(); // Ricarica per allineare lo stato pulito
          } else if(event === 'SIGNED_OUT'){
            currentUser = null;
            updateHeaderBtn(null);
            setSync('Salvataggio locale');
          }
        });

      } catch(err){
        console.warn('Sync cloud non riuscita:', err);
        setSync('Salvato su questo dispositivo (offline)');
      }
    },

    async save(state, { setSync }){
      if(!supabaseClient || !currentUser || syncInProgress) return;
      syncInProgress = true;
      if(setSync) setSync('Salvataggio cloud…');

      try {
        const { error } = await supabaseClient
          .from('user_calcolo')
          .upsert({
            user_id: currentUser.id,
            facts: state.facts,
            history: state.history,
            settings: state.settings,
            updated_at: new Date().toISOString()
          });

        if(!error){
          if(setSync) setSync('Sincronizzato sul cloud ☁️');
        } else {
          console.warn('Errore salvataggio Supabase:', error);
          if(setSync) setSync('Errore sync cloud: salvato in locale');
        }
      } catch(err){
        console.warn('Errore rete Supabase:', err);
        if(setSync) setSync('Offline: salvato in locale');
      } finally {
        syncInProgress = false;
      }
    }
  };

  /* ---------- Gestione UI Pulsante Header e Finestra Modale ---------- */
  function updateHeaderBtn(user){
    const btn = document.getElementById('btn-cloud-sync');
    if(!btn) return;
    if(user){
      btn.textContent = '🟢 ' + (user.email ? user.email.split('@')[0] : 'Connesso');
      btn.className = 'btn pill ok';
      btn.title = 'Connesso come ' + user.email;
    } else {
      const cfg = getConfig();
      if(cfg.url && cfg.anonKey){
        btn.textContent = '☁️ Accedi';
        btn.className = 'btn pill go';
      } else {
        btn.textContent = '☁️ Collega DB';
        btn.className = 'btn pill mut';
      }
    }
  }

  function createModalHtml(){
    if(document.getElementById('modal-cloud-sync')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-cloud-sync';
    modal.className = 'modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-card">
        <div class="top" style="display:flex;justify-content:space-between;align-items:center">
          <h2 id="modal-title">Sincronizzazione Cloud</h2>
          <button class="btn pill mut" id="btn-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div id="modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-close-modal').onclick = () => {
      modal.hidden = true;
    };
    modal.onclick = (e) => {
      if(e.target === modal) modal.hidden = true;
    };
  }

  function showSyncModal(){
    createModalHtml();
    const modal = document.getElementById('modal-cloud-sync');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    const cfg = getConfig();

    // 1. Schermata Configurazione (se mancano URL e Anon Key)
    if(!cfg.url || !cfg.anonKey){
      if(title) title.textContent = 'Connetti Supabase';
      body.innerHTML = `
        <p class="hint" style="margin:0">Collega il tuo database <b>Supabase</b> gratuito per sincronizzare i tuoi progressi su tutti i dispositivi senza dover rifare login ogni volta.</p>
        
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
          <div>
            <label class="label">Project URL Supabase</label>
            <input type="text" id="cfg-url" placeholder="https://xyzcompany.supabase.co" class="copyarea" style="min-height:auto;padding:8px;width:100%;box-sizing:border-box">
          </div>
          <div>
            <label class="label">Anon / Public API Key</label>
            <input type="password" id="cfg-key" placeholder="eyJhbGciOiJIUzI1NiIsIn..." class="copyarea" style="min-height:auto;padding:8px;width:100%;box-sizing:border-box">
          </div>
          <button class="btn primary wide" id="btn-save-cfg">Salva e Connetti</button>
          
          <details style="font-size:12.5px;color:var(--muted);margin-top:4px">
            <summary style="cursor:pointer;font-weight:600">SQL da eseguire su Supabase (clicca per copiare)</summary>
            <pre style="background:var(--soft);padding:10px;border-radius:8px;overflow-x:auto;font-size:11px;user-select:all;margin-top:6px">create table user_calcolo (
  user_id text primary key,
  facts jsonb default '{}'::jsonb,
  history jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table user_calcolo enable row level security;
create policy "Proprietario" on user_calcolo for all
using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);</pre>
          </details>
        </div>
      `;

      document.getElementById('btn-save-cfg').onclick = () => {
        const u = document.getElementById('cfg-url').value.trim();
        const k = document.getElementById('cfg-key').value.trim();
        if(!u || !k){
          alert('Inserisci sia l\'URL che la chiave Anon di Supabase');
          return;
        }
        saveConfig(u, k);
        showSyncModal();
      };
      modal.hidden = false;
      return;
    }

    // 2. Schermata Utente Connesso (se loggato)
    if(currentUser){
      if(title) title.textContent = 'Il tuo Account';
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="background:var(--soft);padding:12px;border-radius:12px;display:flex;flex-direction:column;gap:4px">
            <span class="label">Account Connesso</span>
            <b style="font-size:16px">${currentUser.email || 'Utente'}</b>
            <span class="sync">I tuoi progressi si sincronizzano in automatico dopo ogni round.</span>
          </div>

          <div class="row" style="gap:8px">
            <button class="btn primary" id="btn-force-sync" style="flex:1">Sincronizza Ora</button>
            <button class="btn" id="btn-logout" style="color:var(--slow);border-color:color-mix(in srgb,var(--slow) 35%,var(--line))">Esci</button>
          </div>

          ${!DEFAULT_CONFIG.url ? '<button class="btn pill mut" id="btn-reconfig" style="align-self:center;font-size:11.5px">Modifica parametri Supabase</button>' : ''}
        </div>
      `;

      document.getElementById('btn-force-sync').onclick = async () => {
        const btn = document.getElementById('btn-force-sync');
        btn.textContent = 'Sincronizzazione…';
        btn.disabled = true;
        try {
          if(window.CalcoloDbAdapter) await window.CalcoloDbAdapter.save(window.state || {}, { setSync: (t)=>console.log(t) });
          btn.textContent = 'Completato! ✓';
        } catch(e){
          btn.textContent = 'Errore sync';
        }
        setTimeout(() => { btn.textContent = 'Sincronizza Ora'; btn.disabled = false; }, 2000);
      };

      document.getElementById('btn-logout').onclick = async () => {
        if(confirm('Vuoi davvero disconnettere questo account da questo dispositivo? I dati locali rimarranno salvati.')){
          await supabaseClient.auth.signOut();
          currentUser = null;
          updateHeaderBtn(null);
          modal.hidden = true;
        }
      };

      const reconfigBtn = document.getElementById('btn-reconfig');
      if(reconfigBtn){
        reconfigBtn.onclick = () => {
          localStorage.removeItem(LS_CONFIG_KEY);
          showSyncModal();
        };
      }

      modal.hidden = false;
      return;
    }

    // 3. Schermata Login / Registrazione Rapida
    if(title) title.textContent = 'Accedi al tuo Account';
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="seg" id="auth-tabs" style="width:100%;justify-content:center">
          <button id="tab-login" aria-pressed="true" style="flex:1;text-align:center">Accedi</button>
          <button id="tab-signup" aria-pressed="false" style="flex:1;text-align:center">Crea Account</button>
        </div>

        <div>
          <label class="label">Email</label>
          <input type="email" id="auth-email" placeholder="nome@esempio.com" class="copyarea" style="min-height:auto;padding:8px;width:100%;box-sizing:border-box">
        </div>

        <div>
          <label class="label">Password</label>
          <input type="password" id="auth-password" placeholder="Almeno 6 caratteri" class="copyarea" style="min-height:auto;padding:8px;width:100%;box-sizing:border-box">
        </div>

        <button class="btn primary wide" id="btn-auth-submit">Accedi al Cloud</button>

        <div style="text-align:center;margin-top:2px">
          <button class="btn pill mut" id="btn-magic-link" style="font-size:11.5px">Oppure invia Magic Link (senza password)</button>
        </div>

        ${!DEFAULT_CONFIG.url ? '<button class="btn pill mut" id="btn-reconfig" style="align-self:center;font-size:11.5px;margin-top:6px">Modifica parametri Supabase</button>' : ''}
      </div>
    `;

    let isLoginMode = true;
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const btnSubmit = document.getElementById('btn-auth-submit');

    tabLogin.onclick = () => {
      isLoginMode = true;
      tabLogin.setAttribute('aria-pressed', 'true');
      tabSignup.setAttribute('aria-pressed', 'false');
      btnSubmit.textContent = 'Accedi al Cloud';
    };

    tabSignup.onclick = () => {
      isLoginMode = false;
      tabLogin.setAttribute('aria-pressed', 'false');
      tabSignup.setAttribute('aria-pressed', 'true');
      btnSubmit.textContent = 'Crea Account Gratuito';
    };

    btnSubmit.onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if(!email || !password){
        alert('Inserisci sia email che password');
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = isLoginMode ? 'Accesso in corso…' : 'Creazione account…';

      try {
        if(isLoginMode){
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if(error) throw error;
          currentUser = data.user;
          modal.hidden = true;
        } else {
          const { data, error } = await supabaseClient.auth.signUp({ email, password });
          if(error) throw error;
          alert('Account creato! Se Supabase richiede conferma email, controlla la tua casella di posta.');
          currentUser = data.user;
          modal.hidden = true;
        }
      } catch(err){
        alert('Errore: ' + (err.message || 'Impossibile completare l\'operazione'));
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = isLoginMode ? 'Accedi al Cloud' : 'Crea Account Gratuito';
      }
    };

    document.getElementById('btn-magic-link').onclick = async () => {
      const email = document.getElementById('auth-email').value.trim();
      if(!email){
        alert('Inserisci prima la tua email nel campo sopra');
        return;
      }
      try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email });
        if(error) throw error;
        alert('Ti abbiamo inviato un Magic Link via email! Cliccalo per entrare istantaneamente.');
        modal.hidden = true;
      } catch(e){
        alert('Errore Magic Link: ' + e.message);
      }
    };

    const reconfigAuthBtn = document.getElementById('btn-reconfig');
    if(reconfigAuthBtn){
      reconfigAuthBtn.onclick = () => {
        localStorage.removeItem(LS_CONFIG_KEY);
        showSyncModal();
      };
    }

    const emailInput = document.getElementById('auth-email');
    const pwInput = document.getElementById('auth-password');
    if(pwInput){
      pwInput.onkeydown = (e) => {
        if(e.key === 'Enter') btnSubmit.click();
      };
    }
    if(emailInput){
      setTimeout(() => emailInput.focus(), 80);
    }

    modal.hidden = false;
  }

  // Registra listener sul pulsante nell'header quando il DOM è pronto
  window.addEventListener('DOMContentLoaded', () => {
    initClient();
    const btn = document.getElementById('btn-cloud-sync');
    if(btn) btn.onclick = showSyncModal;
    updateHeaderBtn(currentUser);
  });

})();
