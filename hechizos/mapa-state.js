// ============================================================
// mapa-state.js — Estado global y constantes del mapa
// /hechizos/mapa-state.js
// ============================================================

export const C = {
    POS:    'rgba(150,131,200,0.95)',
    APR:    'rgba(236,213,154,0.95)',
    RASTR:  'rgba(120,110,150,0.6)',
    NUEVO:  '#00ffff',
    PJ:     'rgba(0,220,255,0.95)',
    PREV:   'rgba(210,150,80,0.78)',
    NEXT:   'rgba(80,220,130,0.95)',
    FONDO:  '#05000a',
    L_POS:  'rgba(150,131,200,0.45)',
    L_APR:  'rgba(236,213,154,0.35)',
    L_RASTR:'rgba(188,180,156,0.15)',
    L_OC:   'rgba(70,70,80,0.15)',
    L_PJ:   'rgba(0,210,255,0.6)',
    DEL:    'rgba(220,60,60,0.95)',   // color flechas en modo eliminar
};

export const st = {
    // ── Datos ────────────────────────────────────────────────
    nodos:        [],
    enlaces:      [],
    colores:      {},        // afinidad → { t, b }
    jugadores:    [],        // jugadores activos
    personajes:   [],        // todos los personajes activos

    // ── Vista / filtro PJ ────────────────────────────────────
    jugadorPanel: 'Todos',
    descubiertos: new Set(),
    aprendibles:  new Set(),
    parciales:    new Set(),
    posesiones:   new Set(),
    rastreo:      new Set(),

    // ── Cámara ───────────────────────────────────────────────
    camara: { x: 0, y: 0, zoom: 0.6 },

    // ── Drag ─────────────────────────────────────────────────
    drag: {
        activo: false, lastX: 0, lastY: 0,
        nodo: null, nodoCandidate: null,
        hasMoved: false, startX: 0, startY: 0,
    },

    // ── Selección ────────────────────────────────────────────
    nodoSel:       null,
    modoSelMulti:  false,
    seleccionados: new Set(),

    // ── Selección rectangular ─────────────────────────────────
    rectSel: {
        activo: false,
        startX: 0, startY: 0,
        endX:   0, endY:   0,
    },

    // ── Panel OP izquierdo ────────────────────────────────────
    opPanelAbierto: false,
    opTab: 'sel',

    // ── Modo conexión ─────────────────────────────────────────
    modoConexion:       false,
    tempFlecha:         null,   // { source, endX, endY }

    // ── Modo eliminar flecha ──────────────────────────────────
    modoEliminarFlecha: false,
    enlaceHover:        null,   // enlace bajo el cursor en modo eliminar

    // ── Portapapeles (último resultado de asignación) ─────────
    clipboard: null,  // { pj, hechizos:[], hexGastado, descubiertos:[] }

    // ── Canvas ───────────────────────────────────────────────
    canvas: null,
    ctx:    null,
    raf:    null,

    // ── Sesión ───────────────────────────────────────────────
    esAdmin: false,
};
