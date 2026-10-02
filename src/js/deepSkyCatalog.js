/**
 * deepSkyCatalog.js - Catalogo dei corpi celesti, pianeti e oggetti del cielo profondo (DSO)
 * Include:
 * - Pianeti del Sistema Solare e la Luna con calcolo dinamico delle effemeridi
 * - Nebulose iconiche con particolare rilievo a NGC 7293 (Helix Nebula / Nebulosa Elica)
 * - Il catalogo Messier completo (M1 - M110)
 * - Maggiori oggetti NGC / IC del cielo boreale e australe
 * - Principali stelle guida e di riferimento
 */

export const CELESTIAL_CATEGORIES = {
    all: 'Tutti',
    planet: '🪐 Pianeti & Luna',
    nebula: '🌫️ Nebulose',
    galaxy: '🌌 Galassie',
    cluster: '✨ Ammassi Stellari',
    star: '⭐ Stelle Principali'
};

export const CELESTIAL_CATALOG = [
    // ==========================================
    // --- 1. PIANETI & LUNA (SISTEMA SOLARE) ---
    // ==========================================
    {
        id: 'MOON',
        name: '🌙 Luna',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: -12.7,
        color: '#e2e8f0',
        description: 'Unico satellite naturale della Terra con fasi cicliche e mari basaltici'
    },
    {
        id: 'VENUS',
        name: '🪐 Venere (Lucifero / Espero)',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: -4.4,
        color: '#fef08a',
        description: 'Pianeta più luminoso del cielo, visibile all\'alba o al crepuscolo serale'
    },
    {
        id: 'JUPITER',
        name: '🪐 Giove',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: -2.8,
        color: '#f59e0b',
        description: 'Il gigante gassoso con i 4 satelliti medicei (Io, Europa, Ganimede, Callisto)'
    },
    {
        id: 'MARS',
        name: '🪐 Marte (Il Pianeta Rosso)',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: -1.5,
        color: '#f43f5e',
        description: 'Quarto pianeta dal Sole con tonalità rossastra inconfondibile'
    },
    {
        id: 'SATURN',
        name: '🪐 Saturno',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: 0.5,
        color: '#d97706',
        description: 'Il signore degli anelli e il satellite gigante Titano'
    },
    {
        id: 'MERCURY',
        name: '🪐 Mercurio',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: -0.4,
        color: '#cbd5e1',
        description: 'Pianeta più interno ed elusivo, vicino al Sole'
    },
    {
        id: 'URANUS',
        name: '🪐 Urano',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: 5.7,
        color: '#38bdf8',
        description: 'Gigante di ghiaccio dal caratteristico colore ciano'
    },
    {
        id: 'NEPTUNE',
        name: '🪐 Nettuno',
        category: 'planet',
        constellation: 'Eclittica',
        isSolarSystem: true,
        mag: 7.8,
        color: '#3b82f6',
        description: 'L\'ottavo pianeta, di profondo colore blu indaco'
    },

    // ==========================================
    // --- 2. NEBULOSE ICONICHE NGC / IC ---
    // ==========================================
    {
        id: 'NGC7293',
        name: '🌫️ NGC 7293 - Helix Nebula (Nebulosa Elica / Occhio di Dio)',
        category: 'nebula',
        constellation: 'Aquario',
        raHours: 22.4933, // 22h 29m 38s
        decDeg: -20.8367, // -20° 50' 14"
        mag: 7.6,
        color: '#ec4899', // Vivid Pink
        featured: true,
        description: 'Una delle nebulose planetarie più vicine (~650 a.l.) e spettacolari alla Terra'
    },
    {
        id: 'NGC7000',
        name: '🌫️ NGC 7000 - Nebulosa Nord America',
        category: 'nebula',
        constellation: 'Cigno',
        raHours: 20.9833, // 20h 59m
        decDeg: 44.5167, // +44° 31'
        mag: 4.0,
        color: '#f43f5e',
        featured: true,
        description: 'Vasta nebulosa a emissione vicino a Deneb che ricalca il continente nordamericano'
    },
    {
        id: 'NGC6960',
        name: '🌫️ NGC 6960 / NGC 6992 - Nebulosa Velo (Veil Nebula / Scopa della Strega)',
        category: 'nebula',
        constellation: 'Cigno',
        raHours: 20.7567, // 20h 45m
        decDeg: 30.7167, // +30° 43'
        mag: 7.0,
        color: '#06b6d4',
        featured: true,
        description: 'Resto di supernova filamentoso e suggestivo nel Cigno'
    },
    {
        id: 'NGC2244',
        name: '🌫️ NGC 2244 / NGC 2237 - Nebulosa Rosetta (Rosette Nebula)',
        category: 'nebula',
        constellation: 'Unicorno',
        raHours: 6.5333, // 06h 32m
        decDeg: 5.0500, // +05° 03'
        mag: 4.8,
        color: '#f43f5e',
        featured: true,
        description: 'Grande nebulosa a emissione a forma di rosa con ammasso aperto al centro'
    },
    {
        id: 'IC434',
        name: '🌫️ IC 434 / B33 - Nebulosa Testa di Cavallo (Horsehead Nebula)',
        category: 'nebula',
        constellation: 'Orione',
        raHours: 5.6817, // 05h 40m 54s
        decDeg: -2.4583, // -02° 27' 30"
        mag: 7.3,
        color: '#e11d48',
        featured: true,
        description: 'Famosissima nebulosa oscura a silhouette sul fondo a emissione di IC 434'
    },
    {
        id: 'NGC1499',
        name: '🌫️ NGC 1499 - Nebulosa California',
        category: 'nebula',
        constellation: 'Perseo',
        raHours: 4.0500, // 04h 03m
        decDeg: 36.4167, // +36° 25'
        mag: 6.0,
        color: '#fb7185',
        description: 'Nebulosa a emissione allungata che ricorda la sagoma dello stato della California'
    },
    {
        id: 'NGC281',
        name: '🌫️ NGC 281 - Nebulosa Pacman',
        category: 'nebula',
        constellation: 'Cassiopea',
        raHours: 0.8800, // 00h 52m 48s
        decDeg: 56.6167, // +56° 37'
        mag: 7.4,
        color: '#fbbf24',
        description: 'Nebulosa a emissione nella costellazione di Cassiopea ricca di globuli di Bok'
    },
    {
        id: 'NGC7635',
        name: '🌫️ NGC 7635 - Bubble Nebula (Nebulosa Bolla)',
        category: 'nebula',
        constellation: 'Cassiopea',
        raHours: 23.3450, // 23h 20m 42s
        decDeg: 61.2000, // +61° 12'
        mag: 8.5,
        color: '#38bdf8',
        description: 'Sfera di gas creata dal potente vento stellare di una massiccia stella centrale'
    },
    {
        id: 'IC1396',
        name: '🌫️ IC 1396 - Tromba dell\'Elefante (Elephant\'s Trunk)',
        category: 'nebula',
        constellation: 'Cefeo',
        raHours: 21.6167, // 21h 37m
        decDeg: 57.5000, // +57° 30'
        mag: 5.6,
        color: '#f97316',
        description: 'Regione H II gigantesca con la celebre colonna oscura di formazione stellare'
    },
    {
        id: 'IC1805',
        name: '🌫️ IC 1805 / IC 1848 - Nebulosa Cuore e Anima (Heart & Soul)',
        category: 'nebula',
        constellation: 'Cassiopea',
        raHours: 2.5450, // 02h 32m 42s
        decDeg: 61.4500, // +61° 27'
        mag: 6.5,
        color: '#ec4899',
        description: 'Spettacolare complesso di nebulose a emissione e ammassi stellari giovani'
    },

    // ==========================================
    // --- 3. GALASSIE ICONICHE (DSO) ---
    // ==========================================
    {
        id: 'M31',
        name: '🌌 M31 - Galassia di Andromeda',
        category: 'galaxy',
        constellation: 'Andromeda',
        raHours: 0.7122, // 00h 42m 44s
        decDeg: 41.2689, // +41° 16' 08"
        mag: 3.4,
        color: '#06b6d4',
        featured: true,
        description: 'La più maestosa galassia a spirale del Gruppo Locale, visibile a occhio nudo (~2.5 M a.l.)'
    },
    {
        id: 'M33',
        name: '🌌 M33 - Galassia del Triangolo (Pinwheel)',
        category: 'galaxy',
        constellation: 'Triangolo',
        raHours: 1.5642, // 01h 33m 51s
        decDeg: 30.6600, // +30° 39' 36"
        mag: 5.7,
        color: '#38bdf8',
        featured: true,
        description: 'Terza galassia per dimensioni del Gruppo Locale ricca di regioni H II'
    },
    {
        id: 'M51',
        name: '🌌 M51 - Galassia Vortice (Whirlpool Galaxy)',
        category: 'galaxy',
        constellation: 'Cani da Caccia',
        raHours: 13.4983, // 13h 29m 54s
        decDeg: 47.1950, // +47° 11' 42"
        mag: 8.4,
        color: '#818cf8',
        featured: true,
        description: 'Classica galassia a spirale grand design che interagisce con NGC 5195'
    },
    {
        id: 'M81',
        name: '🌌 M81 - Galassia di Bode',
        category: 'galaxy',
        constellation: 'Orsa Maggiore',
        raHours: 9.9267, // 09h 55m 36s
        decDeg: 69.0667, // +69° 04'
        mag: 6.9,
        color: '#a855f7',
        featured: true,
        description: 'Grande e brillante galassia a spirale nell\'Orsa Maggiore vicina a M82'
    },
    {
        id: 'M82',
        name: '🌌 M82 - Galassia Sigaro (Cigar Galaxy)',
        category: 'galaxy',
        constellation: 'Orsa Maggiore',
        raHours: 9.9300, // 09h 55m 48s
        decDeg: 69.6833, // +69° 41'
        mag: 8.4,
        color: '#fb7185',
        description: 'Galassia starburst attiva con spettacolari filamenti di gas idrogeno espulsi'
    },
    {
        id: 'M101',
        name: '🌌 M101 - Galassia Girandola (Pinwheel Galaxy)',
        category: 'galaxy',
        constellation: 'Orsa Maggiore',
        raHours: 14.0533, // 14h 03m 12s
        decDeg: 54.3483, // +54° 20' 54"
        mag: 7.9,
        color: '#60a5fa',
        description: 'Gigantesca galassia a spirale vista frontalmente dai bracci simmetrici'
    },
    {
        id: 'M104',
        name: '🌌 M104 - Galassia Sombrero',
        category: 'galaxy',
        constellation: 'Vergine',
        raHours: 12.6667, // 12h 40m 00s
        decDeg: -11.6233, // -11° 37' 24"
        mag: 8.0,
        color: '#eab308',
        description: 'Galassia dall\'enorme bulbo centrale attraversata da una spessa fascia di polvere'
    },
    {
        id: 'NGC253',
        name: '🌌 NGC 253 - Sculptor Galaxy (Galassia Scoltore / Moneta d\'Argento)',
        category: 'galaxy',
        constellation: 'Scultore',
        raHours: 0.7933, // 00h 47m 36s
        decDeg: -25.2833, // -25° 17'
        mag: 7.2,
        color: '#94a3b8',
        featured: true,
        description: 'Brillante galassia a spirale starburst visibile verso l\'orizzonte Sud'
    },
    {
        id: 'NGC891',
        name: '🌌 NGC 891 - Outer Limits Galaxy',
        category: 'galaxy',
        constellation: 'Andromeda',
        raHours: 2.3767, // 02h 22m 36s
        decDeg: 42.3483, // +42° 20' 54"
        mag: 9.9,
        color: '#a78bfa',
        description: 'Spettacolare galassia vista perfettamente di taglio con dettagliata banda di polveri'
    },
    {
        id: 'NGC4565',
        name: '🌌 NGC 4565 - Needle Galaxy (Galassia Ago)',
        category: 'galaxy',
        constellation: 'Chioma di Berenice',
        raHours: 12.6067, // 12h 36m 24s
        decDeg: 25.9867, // +25° 59' 12"
        mag: 9.6,
        color: '#c084fc',
        description: 'La più celebre e sottile galassia vista di profilo nel cielo primaverile'
    },

    // ==========================================
    // --- 4. CATALOGO MESSIER (M1 - M110) ---
    // ==========================================
    { id: 'M1', name: '🌫️ M1 - Nebulosa del Granchio (Crab Nebula)', category: 'nebula', constellation: 'Toro', raHours: 5.5756, decDeg: 22.0144, mag: 8.4, color: '#f59e0b', description: 'Resto di supernova dell\'anno 1054' },
    { id: 'M2', name: '✨ M2 - Ammasso Globulare', category: 'cluster', constellation: 'Aquario', raHours: 21.5583, decDeg: -0.8233, mag: 6.5, color: '#facc15', description: 'Ricco ammasso globulare compatto' },
    { id: 'M3', name: '✨ M3 - Grande Ammasso Globulare', category: 'cluster', constellation: 'Cani da Caccia', raHours: 13.7033, decDeg: 28.3817, mag: 6.2, color: '#facc15', description: 'Contiene circa 500.000 stelle' },
    { id: 'M4', name: '✨ M4 - Ammasso Globulare', category: 'cluster', constellation: 'Scorpione', raHours: 16.3933, decDeg: -26.5250, mag: 5.6, color: '#facc15', description: 'Uno dei più vicini ammassi globulari' },
    { id: 'M5', name: '✨ M5 - Ammasso Globulare', category: 'cluster', constellation: 'Serpente', raHours: 15.3083, decDeg: 2.0833, mag: 5.6, color: '#facc15', description: 'Grande ammasso globulare ellittico' },
    { id: 'M6', name: '✨ M6 - Ammasso Farfalla (Butterfly Cluster)', category: 'cluster', constellation: 'Scorpione', raHours: 17.6683, decDeg: -32.2500, mag: 4.2, color: '#38bdf8', description: 'Ammasso aperto la cui forma ricorda una farfalla' },
    { id: 'M7', name: '✨ M7 - Ammasso di Tolomeo', category: 'cluster', constellation: 'Scorpione', raHours: 17.8967, decDeg: -34.8167, mag: 3.3, color: '#38bdf8', description: 'Luminoso ammasso aperto visibile a occhio nudo' },
    { id: 'M8', name: '🌫️ M8 - Nebulosa Laguna (Lagoon Nebula)', category: 'nebula', constellation: 'Sagittario', raHours: 18.0600, decDeg: -24.3833, mag: 6.0, color: '#ec4899', featured: true, description: 'Gigante regione H II nella Via Lattea estiva' },
    { id: 'M9', name: '✨ M9 - Ammasso Globulare', category: 'cluster', constellation: 'Ofiuco', raHours: 17.3200, decDeg: -18.5167, mag: 7.7, color: '#facc15', description: 'Ammasso globulare vicino al centro galattico' },
    { id: 'M10', name: '✨ M10 - Ammasso Globulare', category: 'cluster', constellation: 'Ofiuco', raHours: 16.9517, decDeg: -4.1000, mag: 6.4, color: '#facc15', description: 'Brillante ammasso globulare' },
    { id: 'M11', name: '✨ M11 - Ammasso Anitra Selvatica (Wild Duck)', category: 'cluster', constellation: 'Scudo', raHours: 18.8517, decDeg: -6.2667, mag: 5.8, color: '#38bdf8', description: 'Uno dei più densi e popolati ammassi aperti noti' },
    { id: 'M12', name: '✨ M12 - Ammasso Globulare', category: 'cluster', constellation: 'Ofiuco', raHours: 16.7867, decDeg: -1.9500, mag: 6.7, color: '#facc15', description: 'Ammasso globulare poco concentrato' },
    { id: 'M13', name: '✨ M13 - Grande Ammasso Globulare di Ercole', category: 'cluster', constellation: 'Ercole', raHours: 16.6950, decDeg: 36.4600, mag: 5.8, color: '#facc15', featured: true, description: 'Il più spettacolare ammasso globulare dell\'emisfero nord' },
    { id: 'M14', name: '✨ M14 - Ammasso Globulare', category: 'cluster', constellation: 'Ofiuco', raHours: 17.6267, decDeg: -3.2500, mag: 7.6, color: '#facc15', description: 'Ammasso globulare con numerose stelle variabili' },
    { id: 'M15', name: '✨ M15 - Ammasso Globulare di Pegaso', category: 'cluster', constellation: 'Pegaso', raHours: 21.5000, decDeg: 12.1667, mag: 6.2, color: '#facc15', description: 'Ammasso globulare densissimo con collasso del nucleo' },
    { id: 'M16', name: '🌫️ M16 - Nebulosa Aquila (Eagle Nebula / Pilastri della Creazione)', category: 'nebula', constellation: 'Serpente', raHours: 18.3133, decDeg: -13.7833, mag: 6.4, color: '#f43f5e', featured: true, description: 'Sede dei celebri Pilastri della Creazione' },
    { id: 'M17', name: '🌫️ M17 - Nebulosa Omega (Cigno / Ferro di Cavallo)', category: 'nebula', constellation: 'Sagittario', raHours: 18.3467, decDeg: -16.1833, mag: 6.0, color: '#f43f5e', featured: true, description: 'Regione di formazione stellare nel Sagittario' },
    { id: 'M20', name: '🌫️ M20 - Nebulosa Trifida', category: 'nebula', constellation: 'Sagittario', raHours: 18.0433, decDeg: -23.0333, mag: 6.3, color: '#ec4899', featured: true, description: 'Nebulosa a emissione, riflessione e oscura trisettata' },
    { id: 'M22', name: '✨ M22 - Grande Ammasso del Sagittario', category: 'cluster', constellation: 'Sagittario', raHours: 18.6067, decDeg: -23.9000, mag: 5.1, color: '#facc15', description: 'Uno dei più luminosi ammassi globulari del cielo' },
    { id: 'M24', name: '✨ M24 - Nube Stellare del Sagittario', category: 'cluster', constellation: 'Sagittario', raHours: 18.2833, decDeg: -18.5500, mag: 4.6, color: '#facc15', description: 'Vasta finestra galattica verso il centro della Via Lattea' },
    { id: 'M27', name: '🌫️ M27 - Nebulosa Manubrio (Dumbbell Nebula)', category: 'nebula', constellation: 'Volpetta', raHours: 19.9933, decDeg: 22.7167, mag: 7.4, color: '#10b981', featured: true, description: 'La prima nebulosa planetaria scoperta nella storia da Messier nel 1764' },
    { id: 'M35', name: '✨ M35 - Ammasso Aperto nei Gemelli', category: 'cluster', constellation: 'Gemelli', raHours: 6.1483, decDeg: 24.3333, mag: 5.3, color: '#38bdf8', description: 'Grande e spettacolare ammasso aperto invernale' },
    { id: 'M42', name: '🌫️ M42 - Grande Nebulosa di Orione', category: 'nebula', constellation: 'Orione', raHours: 5.5906, decDeg: -5.3911, mag: 4.0, color: '#a855f7', featured: true, description: 'La più luminosa e studiata culla stellare del cielo notturno' },
    { id: 'M43', name: '🌫️ M43 - Nebulosa di De Mairan', category: 'nebula', constellation: 'Orione', raHours: 5.5928, decDeg: -5.2717, mag: 9.0, color: '#a855f7', description: 'Parte della grande nebulosa di Orione separata da polveri' },
    { id: 'M44', name: '✨ M44 - Ammasso del Presepe (Praesepe / Beehive)', category: 'cluster', constellation: 'Cancro', raHours: 8.6667, decDeg: 19.6667, mag: 3.7, color: '#38bdf8', featured: true, description: 'Grande ammasso aperto visibile a occhio nudo' },
    { id: 'M45', name: '✨ M45 - Le Pleiadi (Sette Sorelle)', category: 'cluster', constellation: 'Toro', raHours: 3.7833, decDeg: 24.1167, mag: 1.6, color: '#38bdf8', featured: true, description: 'Il più celebre e spettacolare ammasso aperto del cielo boreale' },
    { id: 'M57', name: '🌫️ M57 - Nebulosa Anello (Ring Nebula)', category: 'nebula', constellation: 'Lira', raHours: 18.8933, decDeg: 33.0283, mag: 8.8, color: '#10b981', featured: true, description: 'Famosa nebulosa planetaria a forma di ciambella di fumo' },
    { id: 'M64', name: '🌌 M64 - Galassia Occhio Nero (Black Eye Galaxy)', category: 'galaxy', constellation: 'Chioma di Berenice', raHours: 12.9450, decDeg: 21.6833, mag: 8.5, color: '#fb7185', description: 'Galassia con una prominente banda di polvere scura assorbente' },
    { id: 'M78', name: '🌫️ M78 - Nebulosa a Riflessione in Orione', category: 'nebula', constellation: 'Orione', raHours: 5.7783, decDeg: 0.0500, mag: 8.3, color: '#38bdf8', description: 'La più luminosa nebulosa diffusa a riflessione del cielo' },
    { id: 'M97', name: '🌫️ M97 - Nebulosa Gufo (Owl Nebula)', category: 'nebula', constellation: 'Orsa Maggiore', raHours: 11.2467, decDeg: 55.0167, mag: 9.9, color: '#10b981', description: 'Nebulosa planetaria con due macchie scure simili a occhi di gufo' },

    // ==========================================
    // --- 5. AMMASSI ICONICI NGC ---
    // ==========================================
    {
        id: 'NGC869_884',
        name: '✨ NGC 869 / NGC 884 - Doppio Ammasso di Perseo (h + χ Persei)',
        category: 'cluster',
        constellation: 'Perseo',
        raHours: 2.3333, // 02h 20m
        decDeg: 57.1333, // +57° 08'
        mag: 3.7,
        color: '#facc15',
        featured: true,
        description: 'Coppia spettacolare di ammassi aperti visibili anche a occhio nudo'
    },

    // ==========================================
    // --- 6. STELLE GUIDA E DI RIFERIMENTO ---
    // ==========================================
    { id: 'STAR_SIRIUS', name: '⭐ Sirio (α Canis Majoris)', category: 'star', constellation: 'Cane Maggiore', raHours: 6.7525, decDeg: -16.7161, mag: -1.46, color: '#ffffff', description: 'La stella più brillante del cielo notturno' },
    { id: 'STAR_VEGA', name: '⭐ Vega (α Lyrae)', category: 'star', constellation: 'Lira', raHours: 18.6156, decDeg: 38.7836, mag: 0.03, color: '#93c5fd', description: 'Vertice del Triangolo Estivo e riferimento fotometrico' },
    { id: 'STAR_POLARIS', name: '⭐ Stella Polare (α Ursae Minoris)', category: 'star', constellation: 'Orsa Minore', raHours: 2.5303, decDeg: 89.2642, mag: 1.98, color: '#fef08a', description: 'Indica il Polo Nord Celeste con precisione di circa 0.7°' },
    { id: 'STAR_BETELGEUSE', name: '⭐ Betelgeuse (α Orionis)', category: 'star', constellation: 'Orione', raHours: 5.9194, decDeg: 7.4069, mag: 0.50, color: '#f87171', description: 'Supergigante rossa nella spalla di Orione' },
    { id: 'STAR_RIGEL', name: '⭐ Rigel (β Orionis)', category: 'star', constellation: 'Orione', raHours: 5.2422, decDeg: -8.2017, mag: 0.18, color: '#93c5fd', description: 'Supergigante blu nel piede di Orione' },
    { id: 'STAR_ARCTURUS', name: '⭐ Arturo (α Boötis)', category: 'star', constellation: 'Boote', raHours: 14.2611, decDeg: 19.1822, mag: -0.05, color: '#fdba74', description: 'Gigante arancione luminosissima nell\'emisfero nord' },
    { id: 'STAR_DENEB', name: '⭐ Deneb (α Cygni)', category: 'star', constellation: 'Cigno', raHours: 20.6903, decDeg: 45.2803, mag: 1.25, color: '#ffffff', description: 'Supergigante bianca nella coda del Cigno' },
    { id: 'STAR_ALTAIR', name: '⭐ Altair (α Aquilae)', category: 'star', constellation: 'Aquila', raHours: 19.8464, decDeg: 8.8683, mag: 0.77, color: '#ffffff', description: 'Vertice meridionale del Triangolo Estivo' },
    { id: 'STAR_ANTARES', name: '⭐ Antares (α Scorpii)', category: 'star', constellation: 'Scorpione', raHours: 16.4900, decDeg: -26.4319, mag: 1.06, color: '#ef4444', description: 'Il cuore rosso dello Scorpione' },
    { id: 'STAR_CAPELLA', name: '⭐ Capella (α Aurigae)', category: 'star', constellation: 'Auriga', raHours: 5.2781, decDeg: 45.9980, mag: 0.08, color: '#fef08a', description: 'Stella quadrupla gialla visibile per gran parte dell\'anno' },
    { id: 'STAR_ALDEBARAN', name: '⭐ Aldebaran (α Tauri)', category: 'star', constellation: 'Toro', raHours: 4.5987, decDeg: 16.5093, mag: 0.85, color: '#fb923c', description: 'L\'occhio rosso del Toro, vicino all\'ammasso delle Iadi' },
    { id: 'STAR_SPICA', name: '⭐ Spica (α Virginis)', category: 'star', constellation: 'Vergine', raHours: 13.4199, decDeg: -11.1613, mag: 0.98, color: '#60a5fa', description: 'Brillante stella azzurra nella costellazione della Vergine' }
];
