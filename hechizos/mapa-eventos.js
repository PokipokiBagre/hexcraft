import { st } from './mapa-state.js';
import { calcSetsGlobales, persistirEnlace } from './mapa-data.js';
import { renderInfoBar } from './mapa-render.js';
import { toast, actualizarBadgeSel } from './mapa-ui.js';

export function iniciarEventos() {
    const wrap = document.getElementById('hm-canvas-wrap');
    if (!wrap) return;

    // ── Helpers ──────────────────────────────────────────────
    const worldPos = (cx, cy) => {
        const r = st.canvas.getBoundingClientRect();
        return {
            x: (cx - r.left - st.camara.x) / st.camara.zoom,
            y: (cy - r.top  - st.camara.y) / st.camara.zoom,
        };
    };

    const nodoEn = (wx, wy) => {
        for (let i = st.nodos.length - 1; i >= 0; i--) {
            const n = st.nodos[i];
            if (n.esEstado) {
                const h = n.radio * 0.88;
                if (Math.abs(n.x-wx) <= h && Math.abs(n.y-wy) <= h) return n;
            } else {
                if (Math.hypot(n.x-wx, n.y-wy) <= n.radio) return n;
            }
        }
        return null;
    };

    // Distancia punto a segmento (espacio mundo)
    const _distSeg = (px, py, ax, ay, bx, by) => {
        const dx = bx-ax, dy = by-ay;
        const lenSq = dx*dx + dy*dy;
        if (lenSq === 0) return Math.hypot(px-ax, py-ay);
        const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
        return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
    };

    const enlaceEn = (wx, wy) => {
        const threshold = 14 / st.camara.zoom;
        let best = null, bestD = threshold;
        st.enlaces.forEach(e => {
            const d = _distSeg(wx, wy, e.source.x, e.source.y, e.target.x, e.target.y);
            if (d < bestD) { bestD = d; best = e; }
        });
        return best;
    };

    // ── MOUSE DOWN ───────────────────────────────────────────
    wrap.addEventListener('mousedown', e => {
        const wp   = worldPos(e.clientX, e.clientY);
        const nodo = nodoEn(wp.x, wp.y);

        // Modo eliminar flecha: click en enlace lo borra
        if (st.modoEliminarFlecha) {
            const enlace = enlaceEn(wp.x, wp.y);
            if (enlace) _eliminarEnlace(enlace);
            return;
        }

        if (st.modoConexion) {
            if (nodo) st.tempFlecha = { source: nodo, endX: wp.x, endY: wp.y };
            return;
        }

        if (nodo) {
            st.drag.nodoCandidate = nodo;
            st.drag.nodo          = null;
            st.drag.hasMoved      = false;
        } else {
            st.drag.nodoCandidate = null;
            if (st.modoSelMulti) {
                st.rectSel.activo = true;
                st.rectSel.startX = wp.x; st.rectSel.startY = wp.y;
                st.rectSel.endX   = wp.x; st.rectSel.endY   = wp.y;
                st.drag.activo = false;
            } else {
                st.drag.activo = true;
                st.nodoSel = null;
                renderInfoBar(null);
            }
        }

        st.drag.lastX  = e.clientX; st.drag.lastY  = e.clientY;
        st.drag.startX = e.clientX; st.drag.startY = e.clientY;
    });

    // ── MOUSE MOVE ───────────────────────────────────────────
    wrap.addEventListener('mousemove', e => {
        const dx = e.clientX - st.drag.lastX;
        const dy = e.clientY - st.drag.lastY;
        const wp = worldPos(e.clientX, e.clientY);

        // Modo eliminar: resaltar enlace bajo cursor
        if (st.modoEliminarFlecha) {
            st.enlaceHover = enlaceEn(wp.x, wp.y);
            wrap.style.cursor = st.enlaceHover ? 'pointer' : 'crosshair';
            st.drag.lastX = e.clientX; st.drag.lastY = e.clientY;
            return;
        }

        if (st.modoConexion && st.tempFlecha) {
            st.tempFlecha.endX = wp.x;
            st.tempFlecha.endY = wp.y;
            st.drag.lastX = e.clientX;
            st.drag.lastY = e.clientY;
            return;
        }

        const moved = Math.hypot(
            e.clientX - (st.drag.startX||e.clientX),
            e.clientY - (st.drag.startY||e.clientY)
        ) > 4;

        if (st.drag.nodoCandidate && moved && st.esAdmin) {
            st.drag.nodo          = st.drag.nodoCandidate;
            st.drag.nodoCandidate = null;
            st.drag.hasMoved      = true;
        }

        if (st.drag.nodo) {
            st.drag.nodo.x += dx / st.camara.zoom;
            st.drag.nodo.y += dy / st.camara.zoom;
            st.drag.nodo._dirty = true;
        } else if (st.rectSel.activo) {
            st.rectSel.endX = wp.x;
            st.rectSel.endY = wp.y;
        } else if (st.drag.activo) {
            st.camara.x += dx;
            st.camara.y += dy;
        }

        st.drag.lastX = e.clientX;
        st.drag.lastY = e.clientY;

        const n = nodoEn(wp.x, wp.y);
        wrap.style.cursor = st.modoConexion ? 'crosshair' : (n ? 'pointer' : 'grab');
    });

    // ── MOUSE UP ─────────────────────────────────────────────
    wrap.addEventListener('mouseup', e => {
        if (st.modoEliminarFlecha) return; // ya manejado en mousedown

        const wp   = worldPos(e.clientX, e.clientY);
        const nodo = nodoEn(wp.x, wp.y);

        if (st.modoConexion && st.tempFlecha) {
            if (nodo && nodo !== st.tempFlecha.source) {
                _crearEnlace(st.tempFlecha.source, nodo);
            }
            st.tempFlecha = null;
        }

        if (st.rectSel.activo) {
            st.rectSel.activo = false;
            const minX = Math.min(st.rectSel.startX, st.rectSel.endX);
            const maxX = Math.max(st.rectSel.startX, st.rectSel.endX);
            const minY = Math.min(st.rectSel.startY, st.rectSel.endY);
            const maxY = Math.max(st.rectSel.startY, st.rectSel.endY);
            if (maxX - minX > 5 || maxY - minY > 5) {
                st.nodos.forEach(n => {
                    if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
                        st.seleccionados.add(n);
                });
                actualizarBadgeSel();
            }
        }

        if (st.drag.nodoCandidate && !st.drag.hasMoved) {
            _seleccionarNodo(st.drag.nodoCandidate);
        }

        st.drag.activo        = false;
        st.drag.nodo          = null;
        st.drag.nodoCandidate = null;
        st.drag.hasMoved      = false;
    });

    // ── WHEEL (zoom centrado en cursor) ──────────────────────
    wrap.addEventListener('wheel', e => {
        e.preventDefault();
        const r     = st.canvas.getBoundingClientRect();
        const mx    = e.clientX - r.left;
        const my    = e.clientY - r.top;
        const delta = e.deltaY > 0 ? 0.85 : 1.15;
        const nz    = Math.max(0.05, Math.min(st.camara.zoom * delta, 4));
        st.camara.x = mx - (mx - st.camara.x) * (nz / st.camara.zoom);
        st.camara.y = my - (my - st.camara.y) * (nz / st.camara.zoom);
        st.camara.zoom = nz;
    }, { passive: false });

    // ── TOUCH (pinch zoom) ───────────────────────────────────
    let lastTouchDist = 0;
    wrap.addEventListener('touchstart', e => {
        if (e.touches.length === 2)
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
        if (e.touches.length !== 2) return;
        const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist > 0) {
            const nz = Math.max(0.05, Math.min(st.camara.zoom * (d/lastTouchDist), 4));
            st.camara.zoom = nz;
        }
        lastTouchDist = d;
    }, { passive: true });
}

// ── Seleccionar nodo ─────────────────────────────────────────
function _seleccionarNodo(nodo) {
    if (st.modoSelMulti) {
        if (st.seleccionados.has(nodo)) st.seleccionados.delete(nodo);
        else st.seleccionados.add(nodo);
        actualizarBadgeSel();
    }
    st.nodoSel = nodo;
    renderInfoBar(nodo);
    import('./mapa-ui.js').then(m => {
        m.abrirOpPanel(nodo);
    }).catch(()=>{});
}

// ── Crear enlace (con DB) ─────────────────────────────────────
async function _crearEnlace(src, tgt) {
    const existe = st.enlaces.some(e => e.source===src && e.target===tgt);
    if (existe) return;
    st.enlaces.push({ source:src, target:tgt });
    tgt.incomingSources.push(src);
    calcSetsGlobales();
    const ok = await persistirEnlace(src, tgt);
    toast(ok ? '✓ Enlace creado' : '✓ Enlace creado (guardado pendiente para nodos nuevos)');
}

// ── Eliminar enlace (con DB) ──────────────────────────────────
async function _eliminarEnlace(enlace) {
    // Quitar del estado local
    st.enlaces = st.enlaces.filter(e => e !== enlace);
    enlace.target.incomingSources = enlace.target.incomingSources.filter(s => s !== enlace.source);
    if (st.enlaceHover === enlace) st.enlaceHover = null;
    calcSetsGlobales();

    // Eliminar de DB
    try {
        const { supabase } = await import('../hex-auth.js');
        await supabase.from('hechizos_strings')
            .delete()
            .eq('source_id', enlace.source.id)
            .eq('target_id', enlace.target.id);
        toast('🗑 Flecha eliminada');
    } catch(err) {
        toast('Flecha eliminada (sin conexión DB)');
    }
}
