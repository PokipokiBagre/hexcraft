// ============================================================
// mapa-main.js — Punto de entrada del mapa de hechizos
// /hechizos/mapa-main.js
// ============================================================

import { supabase, currentConfig } from '../hex-auth.js';
import { st } from './mapa-state.js';
import { cargarDatos, cargarInventarioPJ, calcSetsGlobales } from './mapa-data.js';
import { redimensionar, centrarCamara, iniciarLoop, renderInfoStats } from './mapa-render.js';
import { iniciarEventos } from './mapa-eventos.js';
import { renderToolbar, renderDrawer } from './mapa-ui.js';

async function init() {
    // ── Canvas ───────────────────────────────────────────────
    st.canvas = document.getElementById('hm-canvas');
    st.ctx    = st.canvas.getContext('2d');

    // ── Exponer currentConfig globalmente (para _sb() en mapa-ui.js) ──
    window.currentConfig = currentConfig;

    // ── Detectar rol (admin) + favicon ───────────────────────
    try {
        // hexAuth.init() detecta rol, setea favicon y badge
        if (window.hexAuth) await window.hexAuth.init();

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: perfil } = await supabase
                .from('perfiles_usuario')
                .select('rol')
                .eq('id', user.id)   // ← corregido: era 'user_id'
                .single();
            st.esAdmin = perfil?.rol === 'master' || perfil?.rol === 'admin';
        }
    } catch(e) {
        console.warn('[mapa-main] No se pudo detectar rol:', e?.message);
    }

    // ── Cargar datos desde Supabase ──────────────────────────
    await cargarDatos();
    calcSetsGlobales();
    await cargarInventarioPJ(st.jugadorPanel);

    // ── Montar UI ────────────────────────────────────────────
    renderToolbar();
    renderDrawer();       // Grimorio + admin (respeta st.esAdmin)
    renderInfoStats();

    // ── Iniciar canvas ───────────────────────────────────────
    redimensionar();
    centrarCamara();
    iniciarEventos();
    iniciarLoop();

    // ── Resize listener ──────────────────────────────────────
    window.addEventListener('resize', redimensionar);
}

init();
