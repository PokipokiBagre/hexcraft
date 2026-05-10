// ============================================================
// mapa-eventos.js — Interacción con el canvas (mouse, touch)
// /hechizos/mapa-eventos.js
// ============================================================

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
        // Iterar en orden inverso para respetar z-order visual
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

    // ── MOUSE DOWN ───────────────────────────────────────────
    wrap.addEventListener('mousedown', e => {
        const wp   = worldPos(e.clientX, e.clientY);
        const nodo = nodoEn(wp.x, wp.y);

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
            st.drag.activo        = true;
            // Clic en vacío sin multi-sel: deseleccionar
            if (!st.modoSelMulti) {
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

        // Modo conexión: arrastrar flecha temporal
        if (st.modoConexion && st.tempFlecha) {
            st.tempFlecha.endX = wp.x;
            st.tempFlecha.endY = wp.y;
            st.drag.lastX = e.clientX;
            st.drag.lastY = e.clientY;
            return;
        }

        // Detectar si supera umbral de movimiento (4px) para activar drag
        const moved = Math.hypot(
            e.clientX - (st.drag.startX||e.clientX),
            e.clientY - (st.drag.startY||e.clientY)
        ) > 4;

        if (st.drag.nodoCandidate && moved && st.esAdmin) {
            // Activar drag del nodo candidato
            st.drag.nodo          = st.drag.nodoCandidate;
            st.drag.nodoCandidate = null;
            st.drag.hasMoved      = true;
        }

        if (st.drag.nodo) {
            // Mover nodo seleccionado
            st.drag.nodo.x += dx / st.camara.zoom;
            st.drag.nodo.y += dy / st.camara.zoom;
            st.drag.nodo._dirty = true;
        } else if (st.drag.activo) {
            // Pan de cámara
            st.camara.x += dx;
            st.camara.y += dy;
        }

        st.drag.lastX = e.clientX;
        st.drag.lastY = e.clientY;

        // Cursor
        const n = nodoEn(wp.x, wp.y);
        wrap.style.cursor = st.modoConexion ? 'crosshair' : (n ? 'pointer' : 'grab');
    });

    // ── MOUSE UP ─────────────────────────────────────────────
    wrap.addEventListener('mouseup', e => {
        const wp   = worldPos(e.clientX, e.clientY);
        const nodo = nodoEn(wp.x, wp.y);

        // Modo conexión: crear enlace al soltar
        if (st.modoConexion && st.tempFlecha) {
            if (nodo && nodo !== st.tempFlecha.source) {
                _crearEnlace(st.tempFlecha.source, nodo);
            }
            st.tempFlecha = null;
        }

        // Candidato sin movimiento → fue un clic simple
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
        // Toggle en multi-sel
        if (st.seleccionados.has(nodo)) st.seleccionados.delete(nodo);
        else st.seleccionados.add(nodo);
        actualizarBadgeSel();
    }
    // Siempre actualizar el nodo activo para la info bar
    st.nodoSel = nodo;
    renderInfoBar(nodo);
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
