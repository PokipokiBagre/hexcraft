// ============================================================
// panel-mapa-hechizos.js
// Mini mapa de hechizos que aparece como pestaña lateral
// cuando se abre la tab "Hechizos" en el panel de personaje.
//
// Uso (desde panel-pj.js):
//   import { abrirMinimapa, cerrarMinimapa } from '../panel-mapa-hechizos.js';
//   // Al abrir tab hechizos:  abrirMinimapa(nombrePJ, esAdmin, supabase)
//   // Al cerrar tab:          cerrarMinimapa()
// ============================================================

import { supabase } from './hex-auth.js';

// ── Constantes de estilo ─────────────────────────────────────
const COLOR_POS    = 'rgba(150, 131, 200, 0.95)';   // violeta — descubierto completo
const COLOR_APR    = 'rgba(236, 213, 154, 0.95)';   // dorado  — aprendible (todos sus precedentes descubiertos)
const COLOR_RASTR  = 'rgba(120, 110, 150, 0.6)';    // gris-vio — descubierto pero precedentes incompletos
const COLOR_NUEVO  = '#00ffff';                      // celeste — nodo recién creado (OP)
const COLOR_FONDO  = '#05000a';
const COLOR_LINEA_POS  = 'rgba(150,131,200,0.45)';
const COLOR_LINEA_APR  = 'rgba(236,213,154,0.35)';
const COLOR_LINEA_RASTR= 'rgba(188,180,156,0.15)';
const COLOR_LINEA_OCULTA = 'rgba(70,70,80,0.15)';

// ── Estado interno ───────────────────────────────────────────
let _estado = {
    abierto:       false,
    nombrePJ:      null,
    esAdmin:       false,
    nodos:         [],
    enlaces:       [],
    colores:       {},           // afinidad → { t, b }
    // Sets globales (basados en esConocido, independientes del PJ)
    descubiertos:  new Set(),    // esConocido=true y todos sus precedentes también
    aprendibles:   new Set(),    // esConocido=false pero TODOS sus precedentes sí
    parciales:     new Set(),    // esConocido=true pero ≥1 precedente no descubierto
    // Sets del PJ seleccionado (para anillo extra)
    posesiones:    new Set(),
    rastreo:       new Set(),
    camara:        { x: 0, y: 0, zoom: 0.6 },
    drag:          { activo: false, lastX: 0, lastY: 0, nodo: null },
    nodoSeleccionado: null,
    nodoNuevo:     null,
    modoConexion:  false,
    tempFlecha:    null,
    jugadores:     [],
    jugadorPanel:  null,
    raf:           null,
    canvas:        null,
    ctx:           null,
    onNodoClick:   null,
};

// ── API PÚBLICA ──────────────────────────────────────────────

export async function abrirMinimapa(nombrePJ, esAdmin, onNodoClick) {
    _estado.nombrePJ     = nombrePJ;
    _estado.esAdmin      = esAdmin;
    _estado.jugadorPanel = nombrePJ;
    _estado.onNodoClick  = onNodoClick || null;
    _estado.nodoSeleccionado = null;
    _estado.nodoNuevo    = null;
    _estado.modoConexion = false;
    _estado.tempFlecha   = null;

    _inyectarPanel();
    _inyectarEstilos();

    await _cargarDatos();
    _calcularSetsGlobales();
    _calcularVista(_estado.jugadorPanel);
    _actualizarSelector();

    // Esperar un frame para que el flexbox haya calculado las dimensiones
    requestAnimationFrame(() => {
        _redimensionar();
        _centrarCamara();
        _iniciarRender();
        _renderControles();
    });
}

export function cerrarMinimapa() {
    _estado.abierto = false;
    if (_estado.raf) { cancelAnimationFrame(_estado.raf); _estado.raf = null; }
    const panel = document.getElementById('pmh-panel');
    if (panel) panel.remove();
    window.removeEventListener('resize', _redimensionar);
}

// Centra el mapa en un hechizo específico (llamado desde panel-pj al clicar en grimorio)
export function centrarEnHechizo(hechizo_id) {
    if (!_estado.abierto) return;
    const nodo = _estado.nodos.find(n => n.id === hechizo_id);
    if (!nodo) return;
    _estado.nodoSeleccionado = nodo;
    // Navegar cámara al nodo
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (wrap) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        const z = Math.max(_estado.camara.zoom, 0.8);
        _estado.camara.zoom = z;
        _estado.camara.x = W / 2 - nodo.x * z;
        _estado.camara.y = H / 2 - nodo.y * z;
    }
    _renderInfo(nodo);
}

// ── INYECTAR PANEL HTML ──────────────────────────────────────
function _inyectarPanel() {
    cerrarMinimapa(); // limpiar si ya existía
    _estado.abierto = true;

    const panel = document.createElement('div');
    panel.id = 'pmh-panel';
    panel.innerHTML = `
        <div id="pmh-header">
            <span id="pmh-title">🔮 Mapa de Hechizos</span>
            <div id="pmh-header-right">
                <select id="pmh-pj-selector" title="Ver mapa de otro personaje"></select>
                <button id="pmh-close" title="Cerrar mapa">✕</button>
            </div>
        </div>
        <div id="pmh-controles"></div>
        <div id="pmh-canvas-wrap">
            <canvas id="pmh-canvas"></canvas>
        </div>
        <div id="pmh-info-panel"></div>
    `;
    document.body.appendChild(panel);

    // Selector de jugador
    const sel = document.getElementById('pmh-pj-selector');
    if (sel) {
        sel.addEventListener('change', () => {
            _estado.jugadorPanel = sel.value;
            if (_estado.jugadorPanel === 'Todos') {
                _estado.posesiones = new Set();
                _estado.rastreo    = new Set();
            } else {
                _calcularVista(_estado.jugadorPanel);
            }
            _centrarCamara();
        });
    }

    document.getElementById('pmh-close').addEventListener('click', cerrarMinimapa);

    // Canvas
    _estado.canvas = document.getElementById('pmh-canvas');
    _estado.ctx    = _estado.canvas.getContext('2d', { alpha: false });
    _redimensionar();
    window.addEventListener('resize', _redimensionar);

    _iniciarEventos();
}

// ── ESTILOS ──────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('pmh-styles')) return;
    const s = document.createElement('style');
    s.id = 'pmh-styles';
    s.textContent = `
#pmh-panel {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 50vw;
    min-width: 560px;
    background: rgba(5,0,12,0.97);
    border-right: 1px solid rgba(212,175,55,0.25);
    display: flex;
    flex-direction: column;
    z-index: 10000;
    font-family: 'Cinzel', serif;
    box-shadow: 4px 0 30px rgba(0,0,0,0.9);
    animation: pmh-slide-in 0.22s ease;
}
@keyframes pmh-slide-in {
    from { transform: translateX(-100%); opacity:0; }
    to   { transform: translateX(0);     opacity:1; }
}
#pmh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid rgba(212,175,55,0.2);
    flex-shrink: 0;
}
#pmh-title {
    color: #d4af37;
    font-size: 0.82em;
    letter-spacing: 1.5px;
    font-weight: bold;
}
#pmh-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
#pmh-pj-selector {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(212,175,55,0.3);
    color: #d4af37;
    border-radius: 5px;
    padding: 4px 8px;
    font-family: 'Cinzel', serif;
    font-size: 0.68em;
    cursor: pointer;
    outline: none;
    max-width: 140px;
}
#pmh-close {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: #555;
    border-radius: 4px;
    width: 26px;
    height: 26px;
    cursor: pointer;
    font-size: 0.9em;
    line-height: 1;
}
#pmh-close:hover { color: #fff; border-color: #fff; }
#pmh-controles {
    padding: 8px 12px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    min-height: 44px;
    align-items: center;
}
.pmh-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888;
    border-radius: 5px;
    padding: 5px 10px;
    font-size: 0.68em;
    cursor: pointer;
    font-family: 'Cinzel', serif;
    transition: all 0.15s;
    white-space: nowrap;
}
.pmh-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
.pmh-btn.activo { background: rgba(0,255,255,0.12); color: #00ffff; border-color: rgba(0,255,255,0.4); }
.pmh-btn.gold   { background: rgba(212,175,55,0.1); color: #d4af37; border-color: rgba(212,175,55,0.35); }
.pmh-btn.gold:hover { background: rgba(212,175,55,0.22); }
.pmh-btn.danger { color: #ff4444; border-color: rgba(255,68,68,0.35); }
.pmh-btn.danger:hover { background: rgba(255,68,68,0.1); }
#pmh-canvas-wrap {
    flex: 1;
    overflow: hidden;
    position: relative;
    cursor: grab;
}
#pmh-canvas { display: block; }
#pmh-info-panel {
    min-height: 60px;
    max-height: 200px;
    overflow-y: auto;
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 10px 14px;
    flex-shrink: 0;
    font-size: 0.78em;
    color: #aaa;
    line-height: 1.5;
}
#pmh-info-panel h4 {
    margin: 0 0 6px;
    color: #d4af37;
    font-size: 0.9em;
    letter-spacing: 0.5px;
}
#pmh-info-panel .pmh-tag {
    display: inline-block;
    border: 1px solid;
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 0.85em;
    margin: 0 4px 4px 0;
}
#pmh-info-panel .pmh-acciones {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
}
@media (max-width: 700px) {
    #pmh-panel { width: 100vw; min-width: unset; }
}
    `;
    document.head.appendChild(s);
}

// ── CARGA DE DATOS ───────────────────────────────────────────
async function _cargarDatos() {
    const [nodosRes, stringsRes, afinRes, jugadoresRes] = await Promise.all([
        supabase.from('hechizos_nodos').select('hechizo_id, nombre, afinidad, clase, hex_cost, es_conocido, pos_x, pos_y, radio, color'),
        supabase.from('hechizos_strings').select('source_id, target_id'),
        supabase.from('hechizos_afinidades').select('afinidad, color_t, color_b'),
        supabase.from('personajes').select('nombre').eq('is_player', true).eq('is_active', true).order('nombre'),
    ]);

    // Colores de afinidad
    _estado.colores = {};
    (afinRes.data || []).forEach(r => {
        _estado.colores[r.afinidad] = { t: r.color_t || '#aaa', b: r.color_b || '#555' };
    });

    // Nodos
    _estado.nodos = (nodosRes.data || []).map(n => ({
        id:            n.hechizo_id,
        nombre:        n.nombre || n.hechizo_id,
        afinidad:      n.afinidad || 'Desconocida',
        clase:         n.clase || '1',
        hex:           n.hex_cost || 0,
        esConocido:    n.es_conocido,
        x:             n.pos_x || 0,
        y:             n.pos_y || 0,
        radio:         n.radio || (n.es_conocido ? 35 : 28),
        color:         n.color || '#888',
        esNuevo:       false,
        incomingSources: [],
    }));

    // Mapa id→nodo
    const nMap = {};
    _estado.nodos.forEach(n => { nMap[n.id] = n; });

    // Enlaces
    _estado.enlaces = [];
    (stringsRes.data || []).forEach(s => {
        const src = nMap[s.source_id];
        const tgt = nMap[s.target_id];
        if (src && tgt && src !== tgt) {
            _estado.enlaces.push({ source: src, target: tgt });
            tgt.incomingSources.push(src);
        }
    });

    // Jugadores para selector
    _estado.jugadores = (jugadoresRes.data || []).map(p => p.nombre);
    _actualizarSelector();

    // Inventario del jugador
    await _cargarInventarioPJ(_estado.jugadorPanel);
}

async function _cargarInventarioPJ(nombre) {
    if (!nombre || nombre === 'Todos') {
        _estado.posesiones = new Set();
        _estado.rastreo    = new Set();
        return;
    }

    const { data } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre')
        .eq('personaje_nombre', nombre);

    const inv = new Set((data || []).map(h => h.hechizo_nombre.toLowerCase().trim()));

    // posesiones = hechizos que tiene el PJ (para el anillo extra en el mapa)
    _estado.posesiones = new Set();
    _estado.nodos.forEach(n => {
        const nom = (n.nombre || '').toLowerCase().trim();
        const id  = (n.id    || '').toLowerCase().trim();
        if (inv.has(nom) || inv.has(id)) _estado.posesiones.add(n);
    });

    // Rastreo recursivo hacia atrás desde posesiones (para mostrar camino)
    _estado.rastreo = new Set();
    const rastrear = (n) => {
        _estado.enlaces.forEach(e => {
            if (e.target === n && !_estado.rastreo.has(e.source) && !_estado.posesiones.has(e.source)) {
                _estado.rastreo.add(e.source);
                rastrear(e.source);
            }
        });
    };
    _estado.posesiones.forEach(n => rastrear(n));
}

function _calcularVista(nombre) {
    _cargarInventarioPJ(nombre); // async, actualiza sets en background
}

// Calcula sets basados en esConocido (global, independiente del PJ)
function _calcularSetsGlobales() {
    _estado.descubiertos = new Set();
    _estado.aprendibles  = new Set();
    _estado.parciales    = new Set();

    _estado.nodos.forEach(n => { if (n.esConocido) _estado.descubiertos.add(n); });

    _estado.nodos.forEach(n => {
        if (n.esConocido) {
            // Conocido con al menos un precedente no descubierto → parcial
            if (n.incomingSources.length > 0 && !n.incomingSources.every(s => s.esConocido))
                _estado.parciales.add(n);
        } else {
            // No conocido, todos sus precedentes sí → aprendible
            if (n.incomingSources.length > 0 && n.incomingSources.every(s => s.esConocido))
                _estado.aprendibles.add(n);
        }
    });
}

function _actualizarSelector() {
    const sel = document.getElementById('pmh-pj-selector');
    if (!sel) return;
    // Incluir "Todos" como primera opción
    const opciones = ['Todos', ..._estado.jugadores];
    sel.innerHTML = opciones.map(j =>
        `<option value="${j}" ${j === _estado.jugadorPanel ? 'selected' : ''}>${j}</option>`
    ).join('');
}

// ── RENDER CONTROLES ─────────────────────────────────────────
function _renderControles() {
    const c = document.getElementById('pmh-controles');
    if (!c) return;

    if (_estado.esAdmin) {
        c.innerHTML = `
            <button class="pmh-btn gold" id="pmh-btn-nuevo" title="Crear nuevo nodo">➕ Nodo</button>
            <button class="pmh-btn ${_estado.modoConexion ? 'activo' : ''}" id="pmh-btn-flecha" title="Dibujar flecha de conexión">↗ Flecha</button>
            <button class="pmh-btn gold" id="pmh-btn-guardar" title="Guardar posiciones">💾 Guardar</button>
            <button class="pmh-btn" id="pmh-btn-ordenar" title="Auto-ordenar nodos">🌀 Ordenar</button>
            <button class="pmh-btn" id="pmh-btn-centrar" title="Centrar cámara">⊙ Centrar</button>
        `;
        document.getElementById('pmh-btn-nuevo').addEventListener('click', _crearNodoNuevo);
        document.getElementById('pmh-btn-flecha').addEventListener('click', _toggleModoConexion);
        document.getElementById('pmh-btn-guardar').addEventListener('click', _guardarPosiciones);
        document.getElementById('pmh-btn-ordenar').addEventListener('click', _autoOrdenar);
        document.getElementById('pmh-btn-centrar').addEventListener('click', _centrarCamara);
    } else {
        c.innerHTML = `
            <button class="pmh-btn" id="pmh-btn-centrar">⊙ Centrar</button>
            <span style="font-size:0.65em;color:#3a3a58;margin-left:4px;">Clic en un hechizo para ver detalles</span>
        `;
        document.getElementById('pmh-btn-centrar').addEventListener('click', _centrarCamara);
    }
}

// ── CENTRAR CÁMARA ───────────────────────────────────────────
function _centrarCamara() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap || _estado.nodos.length === 0) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;

    // Centrar sobre descubiertos si los hay y hay PJ activo, sino sobre todos
    const ref = (_estado.descubiertos.size > 0 && _estado.jugadorPanel !== 'Todos')
        ? Array.from(_estado.descubiertos)
        : _estado.nodos;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ref.forEach(n => {
        if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
    });
    const w = (maxX - minX) || 800;
    const h = (maxY - minY) || 800;
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const zoom = Math.min(W / (w * 1.3), H / (h * 1.3), 0.9);
    _estado.camara.zoom = zoom;
    _estado.camara.x = W / 2 - cx * zoom;
    _estado.camara.y = H / 2 - cy * zoom;
}

// ── REDIMENSIONAR CANVAS ─────────────────────────────────────
function _redimensionar() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    const c    = _estado.canvas;
    if (!wrap || !c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width  = wrap.clientWidth  * dpr;
    c.height = wrap.clientHeight * dpr;
    c.style.width  = wrap.clientWidth  + 'px';
    c.style.height = wrap.clientHeight + 'px';
}

// ── RENDER LOOP ──────────────────────────────────────────────
function _iniciarRender() {
    if (_estado.raf) cancelAnimationFrame(_estado.raf);
    const loop = () => {
        if (!_estado.abierto) return;
        _dibujar();
        _estado.raf = requestAnimationFrame(loop);
    };
    loop();
}

function _dibujar() {
    const { canvas, ctx, camara, nodos, enlaces,
            descubiertos, aprendibles, parciales, posesiones, rastreo,
            nodoSeleccionado, modoConexion, tempFlecha, nodoNuevo } = _estado;
    if (!ctx || !canvas) return;

    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const sf = Math.max(camara.zoom, 0.15);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLOR_FONDO;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(camara.x, camara.y);
    ctx.scale(camara.zoom, camara.zoom);

    // ── 1. ENLACES ───────────────────────────────────────────
    enlaces.forEach(e => {
        const dx = e.target.x - e.source.x;
        const dy = e.target.y - e.source.y;
        const ang = Math.atan2(dy, dx);
        const tx  = e.target.x - Math.cos(ang) * (e.target.radio + 4 / sf);
        const ty  = e.target.y - Math.sin(ang) * (e.target.radio + 4 / sf);

        let color = COLOR_LINEA_OCULTA;
        let lw    = 0.7 / sf;
        let dash  = [];

        const sD = descubiertos.has(e.source);
        const tD = descubiertos.has(e.target);
        const tA = aprendibles.has(e.target);
        // Anillo PJ: si hay PJ activo y posee el source
        const sP = posesiones.has(e.source);
        const tP = posesiones.has(e.target);

        if (sD && tD)      { color = COLOR_LINEA_POS;   lw = 1.4 / sf; }
        else if (sD && tA) { color = COLOR_LINEA_APR;   lw = 1.1 / sf; }
        else if (sP && tP) { color = COLOR_LINEA_POS;   lw = 1.4 / sf; }
        else if (_estado.jugadorPanel === 'Todos') { color = 'rgba(120,110,160,0.45)'; lw = 1.0 / sf; }
        else if (!e.target.esConocido && !tA) { dash = [6/sf, 5/sf]; color = COLOR_LINEA_OCULTA; }

        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);

        // Punta de flecha
        const hl = lw * 3 + 8 / sf;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - hl * Math.cos(ang - Math.PI/7), ty - hl * Math.sin(ang - Math.PI/7));
        ctx.lineTo(tx - hl * Math.cos(ang + Math.PI/7), ty - hl * Math.sin(ang + Math.PI/7));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    });

    // Flecha temporal (modo conexión)
    if (modoConexion && tempFlecha) {
        const ang = Math.atan2(tempFlecha.endY - tempFlecha.source.y, tempFlecha.endX - tempFlecha.source.x);
        const hl  = 16 / sf;
        ctx.beginPath();
        ctx.moveTo(tempFlecha.source.x, tempFlecha.source.y);
        ctx.lineTo(tempFlecha.endX, tempFlecha.endY);
        ctx.strokeStyle = COLOR_NUEVO;
        ctx.lineWidth = 3 / sf;
        ctx.setLineDash([8/sf, 6/sf]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tempFlecha.endX, tempFlecha.endY);
        ctx.lineTo(tempFlecha.endX - hl * Math.cos(ang - Math.PI/7), tempFlecha.endY - hl * Math.sin(ang - Math.PI/7));
        ctx.lineTo(tempFlecha.endX - hl * Math.cos(ang + Math.PI/7), tempFlecha.endY - hl * Math.sin(ang + Math.PI/7));
        ctx.closePath();
        ctx.fillStyle = COLOR_NUEVO;
        ctx.fill();
    }

    // ── 2. NODOS ─────────────────────────────────────────────
    nodos.forEach(nodo => {
        // Sets globales (basados en esConocido)
        const esDes      = descubiertos.has(nodo);
        const esApr      = aprendibles.has(nodo);
        const esPar      = parciales.has(nodo);
        // Sets del PJ (para anillo extra)
        const esPosesion = posesiones.has(nodo);
        const esSeleccionado = nodoSeleccionado === nodo;
        const esNuevo    = nodo.esNuevo;

        // En vista "Todos" todos los nodos son visibles e importantes
        const esTodos = _estado.jugadorPanel === 'Todos';

        // Color núcleo basado en estado global
        let colorNucleo = esTodos ? 'rgba(100,95,130,0.7)' : 'rgba(80,75,105,0.75)';
        if (esNuevo)      colorNucleo = COLOR_NUEVO;
        else if (esDes)   colorNucleo = esPar ? COLOR_RASTR : COLOR_POS;
        else if (esApr)   colorNucleo = COLOR_APR;

        const colorBorde = esNuevo ? COLOR_NUEVO : colorNucleo;
        const importante = esDes || esApr || esPar || esNuevo || esSeleccionado || esTodos;

        // Ocultos visibles pero tenues — mínimo 0.85
        ctx.globalAlpha = importante ? 1.0 : 0.85;

        // Halo de selección
        if (esSeleccionado) {
            ctx.beginPath();
            ctx.arc(nodo.x, nodo.y, nodo.radio + 12/sf, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(236,213,154,0.8)';
            ctx.lineWidth = 2.5/sf;
            ctx.setLineDash([6/sf,4/sf]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Halo de nodo nuevo (celeste pulsante)
        if (esNuevo) {
            ctx.beginPath();
            ctx.arc(nodo.x, nodo.y, nodo.radio + 14/sf, 0, Math.PI*2);
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLOR_NUEVO;
            ctx.strokeStyle = `rgba(0,255,255,${0.4 + 0.3 * Math.sin(Date.now()/300)})`;
            ctx.lineWidth = 3/sf;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Anillo extra si el PJ activo posee este nodo
        if (esPosesion && _estado.jugadorPanel !== 'Todos') {
            ctx.beginPath();
            ctx.arc(nodo.x, nodo.y, nodo.radio + 6/sf, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(150,131,200,0.6)';
            ctx.lineWidth = 1.5/sf;
            ctx.stroke();
        }

        // Aro exterior (fondo)
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, nodo.radio, 0, Math.PI*2);
        ctx.fillStyle = '#0d0d1a';
        ctx.fill();

        // Núcleo — siempre rellenado con su color (nunca vacío)
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, Math.max(1, nodo.radio - 7), 0, Math.PI*2);
        const rellenar = true; // siempre rellenar con colorNucleo
        ctx.fillStyle = colorNucleo;
        if (esDes || esApr || esNuevo || esTodos) { ctx.shadowBlur = esNuevo ? 14 : 7; ctx.shadowColor = colorNucleo; }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Borde exterior
        ctx.beginPath();
        ctx.arc(nodo.x, nodo.y, nodo.radio, 0, Math.PI*2);
        ctx.strokeStyle = colorBorde;
        ctx.lineWidth = (esSeleccionado ? 3 : 1.5) / sf;
        if (!nodo.esConocido && !esNuevo && !esTodos) {
            ctx.setLineDash([5/sf, 4/sf]);
            ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.45);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // Texto — siempre visible para TODOS los nodos con zoom suficiente
        if (camara.zoom > 0.08 || esSeleccionado) {
            const fs = esDes ? 28 : 22;
            ctx.font = `bold ${fs}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const ty2 = nodo.y + nodo.radio + 10/sf;

            let texto;
            if (_estado.esAdmin || nodo.esConocido) {
                texto = nodo.nombre;
            } else {
                const m = nodo.id.match(/\d+/);
                texto = m ? `Hechizo ${m[0]}` : nodo.id;
            }

            // Ocultos con texto más tenue pero legible
            ctx.globalAlpha = importante ? 1.0 : 0.85;
            ctx.strokeStyle = 'rgba(0,0,0,0.95)';
            ctx.lineWidth = 5/sf;
            ctx.strokeText(texto, nodo.x, ty2);

            ctx.fillStyle = esNuevo  ? COLOR_NUEVO
                : esDes  ? (esPar ? COLOR_RASTR : COLOR_POS)
                : esApr  ? COLOR_APR
                : 'rgba(160,155,175,0.9)';   // gris claro visible para ocultos
            ctx.fillText(texto, nodo.x, ty2);

            // Medallita de HEX — solo si hay costo y zoom suficiente
            if (nodo.hex > 0 && camara.zoom > 0.25) {
                const hexTxt = `⬡${nodo.hex}`;
                const fsPill = 17;
                ctx.font = `${fsPill}px sans-serif`;
                const pillW = ctx.measureText(hexTxt).width + 8/sf;
                const pillH = fsPill + 4/sf;
                const pillX = nodo.x - pillW/2;
                const pillY = ty2 + fs + 6/sf;

                // Fondo de la medallita
                ctx.beginPath();
                ctx.roundRect?.(pillX, pillY, pillW, pillH, 4/sf) || ctx.rect(pillX, pillY, pillW, pillH);
                ctx.fillStyle = 'rgba(20,15,35,0.85)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(212,175,55,0.35)';
                ctx.lineWidth = 1/sf;
                ctx.stroke();

                // Texto HEX
                ctx.font = `bold ${fsPill}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(212,175,55,0.85)';
                ctx.strokeStyle = 'rgba(0,0,0,0.9)';
                ctx.lineWidth = 3/sf;
                ctx.strokeText(hexTxt, nodo.x, pillY + 2/sf);
                ctx.fillText(hexTxt, nodo.x, pillY + 2/sf);
            }

            ctx.globalAlpha = 1.0;
        }
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ── PANEL DE INFO INFERIOR ───────────────────────────────────
function _renderInfo(nodo) {
    const el = document.getElementById('pmh-info-panel');
    if (!el) return;

    if (!nodo) { el.innerHTML = '<span style="color:#333;font-size:0.8em;">Clic en un nodo para ver detalles</span>'; return; }

    const esPosesion = _estado.posesiones.has(nodo);
    const mostrarFull = nodo.esConocido || esPosesion || _estado.esAdmin;
    const color = (_estado.colores[nodo.afinidad] || {}).t || '#888';

    const nombre = mostrarFull ? nodo.nombre : (nodo.id.match(/\d+/) ? `Hechizo ${nodo.id.match(/\d+/)[0]}` : nodo.id);

    let html = `<h4 style="color:${color}">${nombre}</h4>`;
    if (mostrarFull) {
        html += `<span class="pmh-tag" style="border-color:${color};color:${color}">${nodo.afinidad}</span>`;
        html += `<span class="pmh-tag" style="border-color:#555;color:#aaa">Cl.${nodo.clase}</span>`;
        html += `<span class="pmh-tag" style="border-color:#555;color:#aaa">⬡ ${nodo.hex}</span>`;
        if (esPosesion) html += `<span class="pmh-tag" style="border-color:rgba(150,131,200,0.5);color:rgba(150,131,200,1)">✓ Aprendido</span>`;
    } else {
        html += `<span style="color:#444;font-size:0.85em;font-style:italic;">Sellado — requisitos insuficientes</span>`;
    }

    // Acciones de OP
    if (_estado.esAdmin && !nodo.isHexNode) {
        const safe = nodo.id.replace(/'/g, "\\'");
        const safeNombre = nodo.nombre.replace(/'/g, "\\'");
        html += `<div class="pmh-acciones">`;
        html += `<button class="pmh-btn gold" onclick="window._pmhToggleConocido('${safe}',${!nodo.esConocido})">${nodo.esConocido ? '🔒 Ocultar' : '👁 Publicar'}</button>`;
        if (nodo.esNuevo) {
            html += `<button class="pmh-btn danger" onclick="window._pmhEliminarNuevo('${safe}')">🗑 Descartar</button>`;
        }
        html += `</div>`;
    }

    el.innerHTML = html;
}

// ── EVENTOS DE CANVAS ────────────────────────────────────────
function _iniciarEventos() {
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (!wrap) return;

    const _worldPos = (cx, cy) => {
        const rect = _estado.canvas.getBoundingClientRect();
        const { x, y, zoom } = _estado.camara;
        return { x: (cx - rect.left - x) / zoom, y: (cy - rect.top - y) / zoom };
    };

    const _nodoEn = (wx, wy) => {
        for (let i = _estado.nodos.length - 1; i >= 0; i--) {
            const n = _estado.nodos[i];
            if (Math.hypot(n.x - wx, n.y - wy) <= n.radio) return n;
        }
        return null;
    };

    // MOUSE DOWN
    wrap.addEventListener('mousedown', e => {
        const wp = _worldPos(e.clientX, e.clientY);
        const nodo = _nodoEn(wp.x, wp.y);

        if (_estado.modoConexion) {
            if (nodo) {
                _estado.tempFlecha = { source: nodo, endX: wp.x, endY: wp.y };
            }
            return;
        }

        if (nodo) {
            // Guardar el nodo candidato — decidir en mouseup si fue clic o drag
            _estado.drag.nodoCandidate = nodo;
            _estado.drag.nodo = null;          // no activar drag todavía
            _estado.drag.hasMoved = false;
        } else {
            _estado.drag.nodoCandidate = null;
            _estado.drag.activo = true;
            _estado.nodoSeleccionado = null;
            _renderInfo(null);
        }

        _estado.drag.lastX = e.clientX;
        _estado.drag.lastY = e.clientY;
        _estado.drag.startX = e.clientX;
        _estado.drag.startY = e.clientY;
    });

    // MOUSE MOVE
    wrap.addEventListener('mousemove', e => {
        const dx = e.clientX - _estado.drag.lastX;
        const dy = e.clientY - _estado.drag.lastY;
        const wp = _worldPos(e.clientX, e.clientY);

        if (_estado.modoConexion && _estado.tempFlecha) {
            _estado.tempFlecha.endX = wp.x;
            _estado.tempFlecha.endY = wp.y;
            _estado.drag.lastX = e.clientX;
            _estado.drag.lastY = e.clientY;
            return;
        }

        // Detectar si el movimiento supera el umbral (4px) para activar drag
        const totalDx = e.clientX - (_estado.drag.startX || e.clientX);
        const totalDy = e.clientY - (_estado.drag.startY || e.clientY);
        const movedEnough = Math.hypot(totalDx, totalDy) > 4;

        if (_estado.drag.nodoCandidate && movedEnough && _estado.esAdmin) {
            // Activar drag del nodo candidato
            _estado.drag.nodo = _estado.drag.nodoCandidate;
            _estado.drag.nodoCandidate = null;
            _estado.drag.hasMoved = true;
        }

        if (_estado.drag.nodo) {
            _estado.drag.nodo.x += dx / _estado.camara.zoom;
            _estado.drag.nodo.y += dy / _estado.camara.zoom;
            _estado.drag.nodo._dirty = true;
        } else if (_estado.drag.activo) {
            _estado.camara.x += dx;
            _estado.camara.y += dy;
        }

        _estado.drag.lastX = e.clientX;
        _estado.drag.lastY = e.clientY;

        // Cursor
        const n = _nodoEn(wp.x, wp.y);
        wrap.style.cursor = _estado.modoConexion ? 'crosshair' : (n ? 'pointer' : 'grab');
    });

    // MOUSE UP
    wrap.addEventListener('mouseup', e => {
        const wp = _worldPos(e.clientX, e.clientY);
        const nodo = _nodoEn(wp.x, wp.y);

        if (_estado.modoConexion && _estado.tempFlecha) {
            if (nodo && nodo !== _estado.tempFlecha.source) {
                _crearEnlace(_estado.tempFlecha.source, nodo);
            }
            _estado.tempFlecha = null;
        }

        // Si había un candidato y NO hubo drag → fue un clic → seleccionar
        if (_estado.drag.nodoCandidate && !_estado.drag.hasMoved) {
            _seleccionarNodo(_estado.drag.nodoCandidate);
        }

        _estado.drag.activo       = false;
        _estado.drag.nodo         = null;
        _estado.drag.nodoCandidate= null;
        _estado.drag.hasMoved     = false;
    });

    // WHEEL (zoom)
    wrap.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = _estado.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.85 : 1.15;
        const nuevoZoom = Math.max(0.05, Math.min(_estado.camara.zoom * delta, 3));
        _estado.camara.x = mx - (mx - _estado.camara.x) * (nuevoZoom / _estado.camara.zoom);
        _estado.camara.y = my - (my - _estado.camara.y) * (nuevoZoom / _estado.camara.zoom);
        _estado.camara.zoom = nuevoZoom;
    }, { passive: false });
}

// ── SELECCIONAR NODO ─────────────────────────────────────────
function _seleccionarNodo(nodo) {
    _estado.nodoSeleccionado = nodo;
    _renderInfo(nodo);

    // Callback al grimorio del panel derecho
    if (_estado.onNodoClick && typeof _estado.onNodoClick === 'function') {
        _estado.onNodoClick(nodo);
    }
}

// ── OP: CREAR NODO NUEVO ─────────────────────────────────────
function _crearNodoNuevo() {
    if (!_estado.esAdmin) return;

    // Posición central de la cámara
    const wrap = document.getElementById('pmh-canvas-wrap');
    const cx = (wrap.clientWidth  / 2 - _estado.camara.x) / _estado.camara.zoom;
    const cy = (wrap.clientHeight / 2 - _estado.camara.y) / _estado.camara.zoom;

    const id = `hechizo_nuevo_${Date.now()}`;
    const nodo = {
        id, nombre: 'Nuevo Hechizo',
        afinidad: 'Desconocida', clase: '1', hex: 0,
        esConocido: false, esNuevo: true,
        x: cx, y: cy, radio: 35,
        incomingSources: [], _dirty: true,
    };
    _estado.nodos.push(nodo);
    _seleccionarNodo(nodo);

    // Abrir editor de hechizo del panel-pj si está disponible
    if (typeof window._ppjAbrirEditorHz === 'function') {
        window._ppjAbrirEditorHz(null, _estado.jugadorPanel, 'cat');
    }
}

// ── OP: TOGGLE MODO CONEXIÓN ─────────────────────────────────
function _toggleModoConexion() {
    _estado.modoConexion = !_estado.modoConexion;
    _estado.tempFlecha   = null;
    const btn = document.getElementById('pmh-btn-flecha');
    if (btn) btn.classList.toggle('activo', _estado.modoConexion);
    const wrap = document.getElementById('pmh-canvas-wrap');
    if (wrap) wrap.style.cursor = _estado.modoConexion ? 'crosshair' : 'grab';
}

// ── OP: CREAR ENLACE EN SUPABASE ──────────────────────────────
async function _crearEnlace(src, tgt) {
    // Evitar duplicados
    const existe = _estado.enlaces.some(e => e.source === src && e.target === tgt);
    if (existe) return;

    _estado.enlaces.push({ source: src, target: tgt });
    tgt.incomingSources.push(src);

    // Recalcular vista
    await _cargarInventarioPJ(_estado.jugadorPanel);

    // Persistir en DB (solo si ambos tienen id real)
    if (!src.esNuevo && !tgt.esNuevo) {
        await supabase.from('hechizos_strings').upsert(
            { source_id: src.id, target_id: tgt.id },
            { onConflict: 'source_id,target_id' }
        );
    }
}

// ── OP: GUARDAR POSICIONES ────────────────────────────────────
async function _guardarPosiciones() {
    const sucios = _estado.nodos.filter(n => n._dirty && !n.esNuevo);
    if (sucios.length === 0) { alert('Sin cambios de posición que guardar.'); return; }

    const rows = sucios.map(n => ({
        hechizo_id: n.id,
        pos_x: Math.round(n.x),
        pos_y: Math.round(n.y),
        es_conocido: n.esConocido
    }));

    const { error } = await supabase.from('hechizos_nodos')
        .upsert(rows, { onConflict: 'hechizo_id' });

    if (error) { alert('Error: ' + error.message); return; }
    sucios.forEach(n => { n._dirty = false; });
    alert(`✓ ${sucios.length} posición(es) guardadas.`);
}

// ── OP: AUTO-ORDENAR (Fruchterman-Reingold simplificado) ──────
function _autoOrdenar() {
    if (!_estado.esAdmin) return;
    const nodos   = _estado.nodos;
    const enlaces = _estado.enlaces;
    const K = 500;
    let temp = 300;
    let iter = 120;

    nodos.forEach(n => { n._dirty = true; });

    const paso = () => {
        if (iter <= 0) { alert('Ordenado. Guarda cuando quieras.'); return; }

        const disp = new Map(nodos.map(n => [n.id, { x: 0, y: 0 }]));

        for (let i = 0; i < nodos.length; i++) {
            for (let j = i + 1; j < nodos.length; j++) {
                const u = nodos[i], v = nodos[j];
                let dx = u.x - v.x, dy = u.y - v.y;
                const d = Math.hypot(dx, dy) || 1;
                const f = (K * K) / d;
                disp.get(u.id).x += dx / d * f;
                disp.get(u.id).y += dy / d * f;
                disp.get(v.id).x -= dx / d * f;
                disp.get(v.id).y -= dy / d * f;
            }
        }

        enlaces.forEach(({ source: u, target: v }) => {
            let dx = u.x - v.x, dy = u.y - v.y;
            const d = Math.hypot(dx, dy) || 1;
            const f = d * d / K;
            disp.get(u.id).x -= dx / d * f;
            disp.get(u.id).y -= dy / d * f;
            disp.get(v.id).x += dx / d * f;
            disp.get(v.id).y += dy / d * f;
        });

        // Atracción al centro
        nodos.forEach(u => {
            const d = Math.hypot(u.x, u.y) || 1;
            const f = d * d / (K * 2);
            disp.get(u.id).x -= u.x / d * f;
            disp.get(u.id).y -= u.y / d * f;
        });

        nodos.forEach(u => {
            const d2 = disp.get(u.id);
            const len = Math.hypot(d2.x, d2.y) || 1;
            const lim = Math.min(len, temp);
            u.x += d2.x / len * lim;
            u.y += d2.y / len * lim;
        });

        temp *= 0.95;
        iter--;
        requestAnimationFrame(paso);
    };
    paso();
}

// ── OP: TOGGLE CONOCIDO ───────────────────────────────────────
window._pmhToggleConocido = async (id, nuevoValor) => {
    const nodo = _estado.nodos.find(n => n.id === id);
    if (!nodo) return;
    const { error } = await supabase.from('hechizos_nodos')
        .update({ es_conocido: nuevoValor })
        .eq('hechizo_id', id);
    if (error) { alert('Error: ' + error.message); return; }
    nodo.esConocido = nuevoValor;
    nodo.radio = nuevoValor ? 35 : 28;
    _calcularSetsGlobales();
    _renderInfo(nodo);
};

// ── OP: DESCARTAR NODO NUEVO ──────────────────────────────────
window._pmhEliminarNuevo = (id) => {
    _estado.nodos = _estado.nodos.filter(n => n.id !== id);
    _estado.nodoSeleccionado = null;
    _renderInfo(null);
};
