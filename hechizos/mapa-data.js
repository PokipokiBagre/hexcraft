// ============================================================
// mapa-data.js — Carga de datos desde Supabase
// /hechizos/mapa-data.js
// ============================================================

import { supabase } from '../hex-auth.js';
import { st } from './mapa-state.js';

// ── Carga completa ───────────────────────────────────────────
export async function cargarDatos() {
    const [nRes, sRes, aRes, jugRes, pjRes] = await Promise.all([
        supabase.from('hechizos_nodos').select('*'),
        supabase.from('hechizos_strings').select('source_id, target_id'),
        supabase.from('hechizos_afinidades').select('afinidad, color_t, color_b'),
        supabase.from('personajes').select('nombre').eq('is_player', true).eq('is_active', true).order('nombre'),
        supabase.from('personajes').select('nombre').eq('is_active', true).order('nombre'),
    ]);

    // Colores de afinidad
    st.colores = {};
    (aRes.data || []).forEach(r => {
        st.colores[r.afinidad] = { t: r.color_t || '#aaa', b: r.color_b || '#555' };
    });

    // Nodos
    st.nodos = (nRes.data || []).map(n => ({
        id:            n.hechizo_id,
        nombre:        n.nombre || n.hechizo_id,
        afinidad:      n.afinidad || 'Desconocida',
        clase:         n.clase || '1',
        hex:           n.hex_cost || 0,
        vex:           n.valor_vex || 0,
        nota:          n.nota      || '',
        resumen:       n.resumen   || '',
        efecto:        n.efecto    || '',
        overcast:      n.overcast  || '',
        undercast:     n.undercast || '',
        especial:      n.especial  || '',
        esConocido:    n.es_conocido,
        esNuevo:       false,
        esEstado:      n.es_estado    || false,
        esPrioridad:   n.es_prioridad || false,
        backcast:      n.backcast     || 0,
        nextcast:      n.nextcast     || 0,
        afectaHechizos: n.afecta_hechizos || false,
        afectaUsuario:  n.afecta_usuario  || false,
        afectaObjetivo: n.afecta_objetivo || false,
        x:      n.pos_x || 0,
        y:      n.pos_y || 0,
        radio:  n.radio || (n.es_conocido ? 35 : 28),
        color:  n.color || '#888',
        incomingSources: [],
        _dirty: false,
    }));

    // Mapa id→nodo para enlazar strings
    const nMap = {};
    st.nodos.forEach(n => { nMap[n.id] = n; });

    // Strings (enlaces dirigidos)
    st.enlaces = [];
    (sRes.data || []).forEach(s => {
        const src = nMap[s.source_id], tgt = nMap[s.target_id];
        if (src && tgt && src !== tgt) {
            st.enlaces.push({ source: src, target: tgt });
            tgt.incomingSources.push(src);
        }
    });

    // Personajes
    st.jugadores  = (jugRes.data || []).map(p => p.nombre);
    st.personajes  = (pjRes.data || []).map(p => p.nombre);
}

// ── Inventario de un PJ ──────────────────────────────────────
export async function cargarInventarioPJ(nombre) {
    if (!nombre || nombre === 'Todos') {
        st.posesiones = new Set();
        st.rastreo    = new Set();
        return;
    }

    const { data } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre')
        .eq('personaje_nombre', nombre);

    const inv = new Set((data || []).map(h => h.hechizo_nombre.toLowerCase().trim()));

    st.posesiones = new Set();
    st.nodos.forEach(n => {
        const nom = (n.nombre || '').toLowerCase().trim();
        const id  = (n.id    || '').toLowerCase().trim();
        if (inv.has(nom) || inv.has(id)) st.posesiones.add(n);
    });

    // Rastreo recursivo de precedentes desde posesiones
    st.rastreo = new Set();
    const rastrear = (n) => {
        st.enlaces.forEach(e => {
            if (e.target === n && !st.rastreo.has(e.source) && !st.posesiones.has(e.source)) {
                st.rastreo.add(e.source);
                rastrear(e.source);
            }
        });
    };
    st.posesiones.forEach(n => rastrear(n));
}

// ── Conjuntos globales (conocido/aprendible/parcial) ─────────
export function calcSetsGlobales() {
    st.descubiertos = new Set();
    st.aprendibles  = new Set();
    st.parciales    = new Set();

    st.nodos.forEach(n => { if (n.esConocido) st.descubiertos.add(n); });
    st.nodos.forEach(n => {
        if (n.esConocido) {
            if (n.incomingSources.length > 0 && !n.incomingSources.every(s => s.esConocido))
                st.parciales.add(n);
        } else {
            if (n.incomingSources.length > 0 && n.incomingSources.every(s => s.esConocido))
                st.aprendibles.add(n);
        }
    });
}

// ── Recargar todo desde DB (tras guardar un hechizo) ─────────
export async function recargarDatos() {
    st.nodoSel = null;
    await cargarDatos();
    calcSetsGlobales();
    await cargarInventarioPJ(st.jugadorPanel);
}

// ── Persistir enlace en DB ───────────────────────────────────
export async function persistirEnlace(src, tgt) {
    if (src.esNuevo || tgt.esNuevo) return; // nodo temporal, no guardar aún
    const { error } = await supabase
        .from('hechizos_strings')
        .upsert({ source_id: src.id, target_id: tgt.id }, { onConflict: 'source_id,target_id' });
    return !error;
}

// ── Persistir posiciones sucias ───────────────────────────────
export async function guardarPosiciones() {
    const sucios = st.nodos.filter(n => n._dirty && !n.esNuevo);
    if (sucios.length === 0) return { ok: 0, err: 0, total: 0 };

    let ok = 0, err = 0;
    for (const n of sucios) {
        const { error } = await supabase
            .from('hechizos_nodos')
            .update({ pos_x: Math.round(n.x), pos_y: Math.round(n.y) })
            .eq('hechizo_id', n.id);
        if (error) err++;
        else { n._dirty = false; ok++; }
    }
    return { ok, err, total: sucios.length };
}

// ── Toggle es_conocido ───────────────────────────────────────
export async function toggleConocido(id, nuevoValor) {
    const nodo = st.nodos.find(n => n.id === id);
    if (!nodo) return false;
    const { error } = await supabase
        .from('hechizos_nodos')
        .update({ es_conocido: nuevoValor })
        .eq('hechizo_id', id);
    if (error) return false;
    nodo.esConocido = nuevoValor;
    nodo.radio = nuevoValor ? 35 : 28;
    calcSetsGlobales();
    return true;
}

// ── Aplicar propiedades batch ─────────────────────────────────
export async function aplicarPropiedades(ids, payload) {
    let ok = 0, err = 0;
    for (const id of ids) {
        const { error } = await supabase
            .from('hechizos_nodos')
            .update(payload)
            .eq('hechizo_id', id);
        if (error) { err++; continue; }
        const n = st.nodos.find(n => n.id === id);
        if (n) {
            if (payload.valor_vex  !== undefined) n.vex        = payload.valor_vex;
            if (payload.hex_cost   !== undefined) n.hex        = payload.hex_cost;
            if (payload.clase      !== undefined) n.clase      = payload.clase;
            if (payload.afinidad   !== undefined) n.afinidad   = payload.afinidad;
            if (payload.es_estado  !== undefined) n.esEstado   = payload.es_estado;
            if (payload.es_prioridad !== undefined) n.esPrioridad = payload.es_prioridad;
            if (payload.es_conocido !== undefined) {
                n.esConocido = payload.es_conocido;
                n.radio = payload.es_conocido ? 35 : 28;
            }
        }
        ok++;
    }
    calcSetsGlobales();
    return { ok, err };
}

// ── Asignar hechizos a PJ ────────────────────────────────────
export async function asignarHechizosAPJ(nombresHz, pj) {
    const { data: existentes } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre')
        .eq('personaje_nombre', pj);

    const yaEstan = new Set((existentes || []).map(h => h.hechizo_nombre.toLowerCase().trim()));
    const nuevos  = nombresHz.filter(n => !yaEstan.has(n.toLowerCase().trim()));
    if (nuevos.length === 0) return { ok: 0, total: nombresHz.length, yaEstan: nombresHz.length };

    const rows = nuevos.map(n => ({
        personaje_nombre: pj,
        hechizo_nombre:   n,
        hechizo_afinidad: st.nodos.find(nd => nd.nombre === n)?.afinidad || '',
        hechizo_hex:      st.nodos.find(nd => nd.nombre === n)?.hex || 0,
    }));
    const { error } = await supabase.from('hechizos_inventario').insert(rows);
    if (error) return { ok: 0, err: error.message };

    if (st.jugadorPanel === pj) await cargarInventarioPJ(pj);
    return { ok: nuevos.length, total: nombresHz.length };
}
