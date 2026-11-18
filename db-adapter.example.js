/**
 * db-adapter.example.js
 * 
 * Questo file mostra come collegare "Calcolo a Mente" a un database cloud (es. Supabase o Firebase).
 * Quando `window.CalcoloDbAdapter` è definito prima del boot dell'app, il trainer
 * sincronizzerà automaticamente facts, history e settings con il cloud mantenendo
 * sempre la copia offline in localStorage.
 * 
 * Per usarlo:
 * 1. Crea un progetto gratuito su Supabase (https://supabase.com) o Firebase.
 * 2. Includi lo script SDK del provider nel tuo <head>.
 * 3. Rinomina questo file in `db-adapter.js` e includilo in `index.html`.
 */

// ==========================================
// ESEMPIO 1: SUPABASE
// ==========================================
/*
// Tabella SQL consigliata su Supabase:
// create table user_calcolo (
//   user_id text primary key,
//   facts jsonb default '{}'::jsonb,
//   history jsonb default '[]'::jsonb,
//   settings jsonb default '{}'::jsonb,
//   updated_at timestamp with time zone default timezone('utc'::text, now())
// );

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
// const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.CalcoloDbAdapter = {
  // Chiamato all'avvio dell'app
  async init(state, { setSync, saveLocal, renderAll, mergeFacts, mergeHist }) {
    setSync('Connessione a Supabase…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSync('Accesso non effettuato: salvataggio locale');
        return;
      }

      const { data, error } = await supabase
        .from('user_calcolo')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        state.facts = mergeFacts(data.facts || {}, state.facts);
        state.history = mergeHist(data.history || [], state.history);
        if (data.settings) Object.assign(state.settings, data.settings);
        saveLocal();
        renderAll();
      }
      setSync('Sincronizzato con il tuo account');
    } catch (e) {
      console.warn('Errore sync Supabase:', e);
      setSync('Salvato su questo dispositivo (offline)');
    }
  },

  // Chiamato dopo ogni round completato
  async save(state, { setSync }) {
    setSync('Salvataggio su Supabase…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_calcolo').upsert({
        user_id: user.id,
        facts: state.facts,
        history: state.history,
        settings: state.settings,
        updated_at: new Date().toISOString()
      });
      setSync('Salvato sul cloud');
    } catch (e) {
      console.warn('Errore salvataggio Supabase:', e);
      setSync('Salvato solo su questo dispositivo');
    }
  }
};
*/

// ==========================================
// ESEMPIO 2: FIREBASE FIRESTORE
// ==========================================
/*
window.CalcoloDbAdapter = {
  async init(state, { setSync, saveLocal, renderAll, mergeFacts, mergeHist }) {
    // Inizializza firebase auth & firestore
    // const doc = await getDoc(doc(db, "users", userId));
  },
  async save(state, { setSync }) {
    // setDoc(doc(db, "users", userId), { ... });
  }
};
*/
