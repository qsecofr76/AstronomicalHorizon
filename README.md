# 🌄 Astronomical Horizon & Viewshed Analyzer

Applicazione web moderna basata su **OpenStreetMap** per il rilevamento delle quote altimetriche, calcolo del **profilo dell'orizzonte astronomico a 360°** e generazione della **mappa termica dei gradi di visibilità (Viewshed)** attorno a qualsiasi punto selezionato sulla Terra.

---

## 🌟 Caratteristiche Principali

- 🗺️ **Mappa Interattiva OpenStreetMap**:
  - Supporto per diversi layer cartografici: **OpenTopoMap** (rilievi montani e curve di livello), **OpenStreetMap Standard**, **Satellite Esri**, e **Carto Dark**.
  - Rilevamento istantaneo dell'altitudine al click o al trascinamento dell'osservatore.
  - Ricerca toponimi globale tramite OpenStreetMap Nominatim.
  - Preset rapidi di cime e monumenti celebri (Monte Bianco, Monte Rosa, Cervino, Vesuvio, Etna, Gran Sasso, Stonehenge, ecc.).

- ⛰️ **Modello Digitale del Terreno (DEM)**:
  - Recupero dei dati altimetrici globali ad alta risoluzione tramite tile **AWS Open Data Terrarium** (\(z=10 \dots 13\)).
  - Decodifica pixel-per-pixel in quota reale in metri (\(Quota = R \cdot 256 + G + B/256 - 32768\)).
  - Fallback automatico su API di elevazione Open-Meteo.

- 👁️ **Mappa Colorata dei Rilievi e Intervisibilità (Viewshed)**:
  - Algoritmo di Line-of-Sight (Linee di Vista) a 360° con correzione della **curvatura terrestre** e **rifrazione atmosferica standard** (\(R_{eff} \approx 7.323.000\text{ m}\)).
  - 4 modalità di visualizzazione:
    1. **Intervisibilità (Visibile / Nascosto)**: Aree in vista diretta rispetto a valli e versanti in ombra.
    2. **Gradi di Elevazione Angolare (Termico)**: Gradiente basato sui gradi di inclinazione rispetto all'orizzonte piano.
    3. **Topografico**: Colorazione in base alla quota altimetrica assoluta dei rilievi visibili.
    4. **Distanza**: Gradiente di profondità dal punto di vista.
  - Regolazione in tempo reale di **raggio di analisi** (da 3 a 50 km), **altezza occhi osservatore** e **opacità**.

- ☀️ **Profilo Orizzonte Astronomico a 360°**:
  - Grafico interattivo dell'orizzonte montano a 360° (Nord \(\rightarrow\) Est \(\rightarrow\) Sud \(\rightarrow\) Ovest).
  - Tracciamento delle traiettorie solari per **Solstizio d'Estate (21 Giu)**, **Solstizio d'Inverno (21 Dic)**, **Equinozi (20 Mar / 22 Set)** e **Sole Oggi**.
  - Evidenziazione interattiva: passando il mouse sul grafico si illumina sulla mappa la vetta e la linea di vista corrispondente!

- 💾 **Esportazione**:
  - Esportazione del profilo orizzonte a 360° in formato **CSV** e **JSON**.
  - Esportazione screenshot in **PNG** del profilo dell'orizzonte.

---

## 🚀 Come Avviare l'Applicazione

### Metodo 1: Tramite Vite / Node.js
```bash
# Installa le dipendenze (già fatto)
cmd.exe /c npm install

# Avvia il server di sviluppo locale
cmd.exe /c npm run dev
```
Apri il browser all'indirizzo indicato (tipicamente `http://localhost:5173`).

### Metodo 2: Tramite Python HTTP Server
```bash
python -m http.server 8000
```
Apri il browser all'indirizzo `http://localhost:8000`.

---

## 📐 Formule Matematiche e Algoritmo

### 1. Correzione Curvatura Terrestre e Rifrazione
La caduta apparente di quota \(\Delta h\) per un punto a distanza \(d\) è data da:
$$\Delta h(d) = \frac{d^2}{2 \cdot R_{eff}}$$
dove \(R_{eff} = \frac{R_{terra}}{1 - k}\) con \(k \approx 0.13\).

### 2. Elevazione Angolare Orizzonte
L'angolo verticale \(\alpha\) (in gradi) visto dall'osservatore è:
$$\alpha = \arctan\left(\frac{(Z_{bersaglio} - \Delta h(d)) - (Z_{oss} + h_{oss})}{d}\right) \times \frac{180}{\pi}$$
L'orizzonte a un dato azimut \(\theta\) è definito come:
$$\alpha_{orizzonte}(\theta) = \max_{d \le R} \alpha(d, \theta)$$
