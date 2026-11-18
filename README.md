# Calcolo a Mente ⚡

Un allenatore di calcolo a mente veloce, minimale e ottimizzato per smartphone e desktop (stile *Zetamac*).

Include tracciamento dei calcoli più difficili tramite mediana dei tempi di risposta, storico dei round con grafici a barre sparkline, livelli progressivi e salvataggio automatico offline.

È strutturato come **Progressive Web App (PWA)**: funziona al 100% offline, può essere installata come un'app nativa su iPhone/Android/Desktop, e include strumenti di backup/esportazione JSON e CSV.

## Allenamento quotidiano e ripasso

- **Allenamento di oggi**: 4 minuti attivi in tre fasi, con una pausa tra le fasi: riscaldamento (1 min), ripasso (2 min), verifica mista (1 min). Usa il livello selezionato e fino a 12 calcoli in scadenza; se non ce ne sono, riprende i punti deboli o genera esercizi del livello. Si segna come completato dopo aver risolto almeno un calcolo in ogni fase.
- **Ripasso a distanza**: dalla home puoi avviare anche solo il ripasso da 2 minuti. Dopo risposte corrette sotto i 2 secondi mediani, gli intervalli progrediscono a 1, 3, 7, 14 e 30 giorni, solo quando il ripasso precedente è scaduto. Ripetere prima della scadenza non la rimanda e non allunga l’intervallo. Una risposta lenta riporta l’intervallo a 1 giorno; un errore ripropone il calcolo dopo 10 minuti.
- **Padronanza confermata**: richiede almeno 5 risposte nei round normali o nelle verifiche finali quotidiane, distribuite su almeno 2 giorni. Per ogni calcolo si conservano le ultime 5 verifiche (una osservazione per sessione, con mediana dei tempi e numero di risposte); la mediana delle verifiche deve essere sotto 1,2 secondi, senza errori nelle verifiche considerate e negli ultimi 5 tentativi. Una verifica deve contenere almeno 2 calcoli distinti. I drill ripetitivi non creano prove di padronanza.
- Gli **errori recenti**, negli ultimi 5 tentativi, determinano la priorità dei calcoli difficili e il bordo rosso nella matrice. Gli errori totali restano disponibili nei dettagli e nei backup. Anche un errore su un calcolo non ancora risolto viene conservato.

Lo storico e i backup precedenti restano leggibili. I tempi e gli errori storici sono conservati; non vengono inventati risultati recenti o verifiche per i vecchi dati. I calcoli precedenti diventano ripassabili un giorno dopo l’ultima risposta registrata. Scadenze e verifiche vengono salvate insieme ai calcoli, nello stesso localStorage e nel cloud esistente, senza modifiche alla tabella Supabase. Le sessioni quotidiane e i ripassi non modificano gli obiettivi dei round normali da 2 minuti.

### Verifica locale

I test non richiedono dipendenze aggiuntive:

```bash
node --test tests/training.test.cjs
```

---

## 📁 Struttura del Progetto

```text
mental-math/
├── index.html              # Punto d'ingresso principale della Web App
├── calcolo.html            # Copia standalone completa e autonoma
├── manifest.webmanifest    # Configurazione PWA (titolo, colori, icone, avvio standalone)
├── sw.js                   # Service Worker per il funzionamento e la cache offline
├── favicon.svg             # Favicon vettoriale
├── icons/                  # Icone ad alta risoluzione per la PWA
│   ├── icon.svg            # Master vettoriale
│   ├── icon-192.png        # Icona Android / PWA standard (192x192)
│   ├── icon-512.png        # Icona PWA splash screen & store (512x512)
│   └── apple-touch-icon.png# Icona per iOS Home Screen (180x180)
├── db-sync.js              # Autenticazione e sincronizzazione Supabase
├── db-adapter.example.js   # Esempio per collegare un database cloud (Supabase/Firebase)
├── tests/training.test.cjs # Verifiche di padronanza, ripasso e selezione esercizi
└── README.md               # Documentazione del progetto
```

---

## 🚀 Come Eseguire Localmente

### Opzione 1: Doppio clic
Puoi semplicemente fare doppio clic su `index.html` (o `calcolo.html`) e aprirlo in qualsiasi browser (Safari, Chrome, Firefox, Edge).

### Opzione 2: Server locale (consigliato per testare la PWA)
Per testare il Service Worker e la PWA localmente:
```bash
# Con Python 3
python3 -m http.server 8080

# Oppure con Node.js
npx serve .
```
Apri poi `http://localhost:8080` nel browser.

---

## 🌐 Come Pubblicare la Web App Online

La web app è completamente statica (HTML, CSS e JavaScript puro, zero dipendenze da compilare):

### 1. GitHub Pages (Gratis & Consigliato)
1. Fai il push del repository sul tuo account GitHub (`github.com/sapiaf/mental-math`):
   ```bash
   git add .
   git commit -m "Initial release of Calcolo a Mente PWA"
   git branch -M main
   git remote add origin https://github.com/sapiaf/mental-math.git
   git push -u origin main
   ```
2. Vai su **Settings** del repository su GitHub.
3. Seleziona **Pages** dal menu laterale sinistro.
4. Sotto **Build and deployment** > **Branch**, seleziona `main` e cartella `/ (root)`.
5. Clicca su **Save**. Entro 1-2 minuti la tua app sarà attiva all'indirizzo:
   `https://sapiaf.github.io/mental-math/`

### 2. Cloudflare Pages / Vercel / Netlify
Basta collegare il repository GitHub: non serve alcun comando di build, la directory di output è la root `./`.

---

## 📱 Come Installare l'App sullo Smartphone (PWA)

Una volta pubblicata su HTTPS (ad es. GitHub Pages):

- **iPhone / iPad (iOS Safari)**:
  1. Apri il link del sito in Safari.
  2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto in basso).
  3. Scorri e tocca **Aggiungi alla schermata Home**.
  4. L'app apparirà come un'applicazione a tutto schermo senza barre del browser.

- **Android (Chrome)**:
  1. Apri il sito in Chrome.
  2. Tocca il banner **Installa App** (oppure apri il menu a tre puntini ⋮ e seleziona **Installa applicazione**).

- **Desktop (Chrome / Edge / Safari)**:
  1. Clicca sull'icona di installazione nella barra degli indirizzi del browser.

---

## 💾 Gestione Dati & Backup

Tutti i dati risiedono nel browser sotto la chiave `localStorage['calcolo-a-mente.v1']`.

### Struttura dati:
- **`facts`**: memorizza ogni calcolo incontrato (es. `k7x8`), quante volte è uscito, gli ultimi tempi di risposta, gli errori storici e recenti, le verifiche miste e la scadenza del ripasso. Il formato mantiene il prefisso precedente e aggiunge i nuovi metadati in coda.
- **`history`**: elenco di tutti i round svolti (data, livello, punteggio, durata in secondi).
- **`settings`**: livello attuale, durata selezionata, intervalli personalizzati, filtro operazioni.

### Funzioni di Esportazione & Importazione:
Nella schermata **Progressi** trovi la sezione **Dati e Backup**:
1. **Esporta backup (JSON)**: scarica un file `.json` completo con tutti i dati.
2. **Importa backup (JSON)**: ripristina o unisce i dati da un file di backup precedente. Ottimo per trasferire i propri punteggi dal PC al telefono o per evitare perdite se si svuota la cronologia del browser.
3. **Esporta round (CSV)**: esporta l'elenco di tutte le sessioni giocate con punteggi e orari, apribile in Excel o Google Fogli.
4. **Scarica CSV (Difficili)**: nella scheda *Difficili*, permette di scaricare l'elenco dei calcoli più lenti con le rispettive mediane e frequenze.
5. **Azzera dati**: resetta in sicurezza lo stato previa conferma.

---

## ☁️ Sincronizzazione Cloud Automatica (Supabase)

L'applicazione include il modulo integrato [`db-sync.js`](./db-sync.js) che permette di sincronizzare i dati su qualsiasi dispositivo e browser.

### Come configurarlo in 3 passaggi:
1. **Crea un progetto gratuito su [supabase.com](https://supabase.com)**.
2. **Crea la tabella**: nella sezione **SQL Editor** di Supabase, esegui questo comando:
   ```sql
   create table user_calcolo (
     user_id text primary key,
     facts jsonb default '{}'::jsonb,
     history jsonb default '[]'::jsonb,
     settings jsonb default '{}'::jsonb,
     updated_at timestamp with time zone default timezone('utc'::text, now())
   );
   alter table user_calcolo enable row level security;
   create policy "Proprietario" on user_calcolo for all
   using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
   ```
3. **Collega l'app**:
   - Apri l'app e tocca il pulsante **`☁️ Connetti Cloud`** nell'intestazione (o nella scheda Progressi).
   - Incolla il tuo **Project URL** e la tua **Anon Public Key** (da *Project Settings* > *API* su Supabase).
   - Accedi o crea un account con Email e Password (o Magic Link istantaneo).

Da quel momento, ogni round giocato sul telefono o sul PC si sincronizzerà istantaneamente sul tuo account, mantenendo sempre la piena funzionalità offline quando non c'è campo!
