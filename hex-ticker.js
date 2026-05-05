// ============================================================
// hex-ticker.js — Regeneración en tiempo real + sync a Supabase
// Coloca este archivo en la RAÍZ del proyecto (junto a hex-auth.js)
//
// Uso en cualquier página que necesite regen en vivo:
//
//   import { hexTicker } from './hex-ticker.js';
//
//   hexTicker.iniciar({
//       personajes,          // objeto mutable { nombre: pjData, ... }
//       calcularStats,       // función de personajes-logic.js
//       onTick: () => {      // callback opcional para re-renderizar UI
//           renderCatalogo();
//           if (panelAbierto) renderDetalle(pjSeleccionado);
//       }
//   });
//
//   hexTicker.detener();     // al salir de la página
//
// ─────────────────────────────────────────────────────────────
// Arquitectura:
//   • Tick cada TICK_SEG segundos → aplica regen proporcional en memoria
//   • Cada FLUSH_SEG segundos     → persiste SOLO vex_actual/guarda_actual a Supabase
//   • Supabase Realtime           → recibe cambios de otros clientes y actualiza memoria
// ============================================================

import { supabase } from './hex-auth.js';

// ── Constantes configurables ──────────────────────────────────
const TICK_SEG  = 10;   // frecuencia de cálculo en memoria (segundos)
const FLUSH_SEG = 30;   // frecuencia de escritura a Supabase (segundos)

// ── Estado interno ────────────────────────────────────────────
let _personajes      = null;
let _calcularStats   = null;
let _onTick          = null;
let _tickInterval    = null;
let _flushInterval   = null;
let _realtimeChannel = null;

// Nombres de personajes con regen pendiente de escribir a Supabase
let _pendienteFlush = new Set();

// ─────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────
export const hexTicker = {

    /**
     * iniciar({ personajes, calcularStats, onTick? })
     *
     * personajes    — el objeto reactivo { nombre: pjData }
     * calcularStats — función importada de personajes-logic.js
     * onTick        — callback llamado cuando algún valor cambia en memoria
     */
    iniciar({ personajes, calcularStats, onTick = null } = {}) {
        if (!personajes || !calcularStats) {
            console.error('[hex-ticker] Se necesita personajes y calcularStats');
            return;
        }
        _personajes    = personajes;
        _calcularStats = calcularStats;
        _onTick        = onTick;

        this.detener(); // limpiar instancia previa si existe

        _tickInterval  = setInterval(_aplicarTick,    TICK_SEG  * 1000);
        _flushInterval = setInterval(_flushASupabase, FLUSH_SEG * 1000);
        _suscribirRealtime();

        console.log(`[hex-ticker] Iniciado — tick cada ${TICK_SEG}s, flush cada ${FLUSH_SEG}s`);
    },

    /** Detiene el ticker y cierra la suscripción realtime */
    detener() {
        if (_tickInterval)     { clearInterval(_tickInterval);  _tickInterval  = null; }
        if (_flushInterval)    { clearInterval(_flushInterval); _flushInterval = null; }
        if (_realtimeChannel)  { supabase.removeChannel(_realtimeChannel); _realtimeChannel = null; }
    },

    /** Fuerza un flush inmediato (útil antes de navegar a otra página) */
    async flushAhora() {
        return _flushASupabase();
    },

    /** True si hay valores de regen pendientes de escribir */
    tienePendientes() {
        return _pendienteFlush.size > 0;
    }
};

// ─────────────────────────────────────────────────────────────
// TICK — aplica regen proporcional en memoria cada TICK_SEG s
// ─────────────────────────────────────────────────────────────
function _aplicarTick() {
    if (!_personajes || !_calcularStats) return;

    let huboCambio = false;

    for (const [nombre, p] of Object.entries(_personajes)) {
        if (!p.isActive) continue;

        const s = _calcularStats(p);

        // ── VEX ──────────────────────────────────────────────
        const regenVex = s.regen_vex_total ?? s.regen_vex ?? 0;
        if (regenVex > 0 && s.vex_max > 0 && Math.floor(p.vex_actual || 0) < s.vex_max) {
            p._vex_frac = (p._vex_frac || 0) + (regenVex / 3600 * TICK_SEG);
            if (p._vex_frac >= 1) {
                const entero = Math.floor(p._vex_frac);
                p._vex_frac -= entero;
                p.vex_actual = Math.min(s.vex_max, Math.floor(p.vex_actual || 0) + entero);
                _pendienteFlush.add(nombre);
                huboCambio = true;
            }
        }

        // ── GUARDA DORADA ─────────────────────────────────────
        const regenGuarda = s.regen_guarda_total ?? s.regen_guarda ?? 0;
        if (regenGuarda > 0 && s.guarda_max > 0 && Math.floor(p.guarda_actual || 0) < s.guarda_max) {
            p._guarda_frac = (p._guarda_frac || 0) + (regenGuarda / 3600 * TICK_SEG);
            if (p._guarda_frac >= 1) {
                const entero = Math.floor(p._guarda_frac);
                p._guarda_frac -= entero;
                p.guarda_actual = Math.min(s.guarda_max, Math.floor(p.guarda_actual || 0) + entero);
                _pendienteFlush.add(nombre);
                huboCambio = true;
            }
        }
    }

    if (huboCambio && _onTick) _onTick();
}

// ─────────────────────────────────────────────────────────────
// FLUSH — escribe vex_actual y guarda_actual a Supabase
// Solo estos dos campos; no pisa ediciones manuales de otros campos
// ─────────────────────────────────────────────────────────────
async function _flushASupabase() {
    if (!_personajes || _pendienteFlush.size === 0) return;

    // Copiar y limpiar ANTES del await para no perder ticks concurrentes
    const cola = [..._pendienteFlush];
    _pendienteFlush.clear();

    const filas = cola
        .map(nombre => {
            const p = _personajes[nombre];
            if (!p) return null;
            return {
                nombre,
                vex_actual:    Math.floor(p.vex_actual    || 0),
                guarda_actual: Math.floor(p.guarda_actual || 0)
            };
        })
        .filter(Boolean);

    if (filas.length === 0) return;

    const { error } = await supabase
        .from('personajes')
        .upsert(filas, { onConflict: 'nombre' });

    if (error) {
        console.error('[hex-ticker] Error flush:', error.message);
        // Re-encolar para el próximo intento
        cola.forEach(n => _pendienteFlush.add(n));
    } else {
        console.debug(`[hex-ticker] Flush OK — ${filas.length} personaje(s) persistidos`);
    }
}

// ─────────────────────────────────────────────────────────────
// REALTIME — recibe cambios hechos por otros clientes
// ─────────────────────────────────────────────────────────────
function _suscribirRealtime() {
    _realtimeChannel = supabase
        .channel('hex-ticker-personajes')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'personajes' },
            _recibirCambioExterno
        )
        .subscribe(status => {
            console.log('[hex-ticker] Realtime:', status);
        });
}

function _recibirCambioExterno(payload) {
    if (!_personajes) return;
    const row = payload.new;
    if (!row?.nombre) return;

    const pLocal = _personajes[row.nombre];
    if (!pLocal) return; // personaje de otra campaña, ignorar

    // ── ¿El cambio de vex/guarda supera lo que nuestro tick pudo producir?
    // Si sí → fue una edición manual externa → aceptar valores remotos
    const s = _calcularStats ? _calcularStats(pLocal) : null;
    const maxTickVex    = s ? (s.regen_vex_total    || 0) / 3600 * (FLUSH_SEG + TICK_SEG) + 2 : 5;
    const maxTickGuarda = s ? (s.regen_guarda_total || 0) / 3600 * (FLUSH_SEG + TICK_SEG) + 2 : 5;

    const diffVex    = Math.abs((row.vex_actual    || 0) - Math.floor(pLocal.vex_actual    || 0));
    const diffGuarda = Math.abs((row.guarda_actual || 0) - Math.floor(pLocal.guarda_actual || 0));

    if (diffVex > maxTickVex || diffGuarda > maxTickGuarda) {
        pLocal.vex_actual    = row.vex_actual    || 0;
        pLocal.guarda_actual = row.guarda_actual || 0;
        pLocal._vex_frac     = 0;
        pLocal._guarda_frac  = 0;
        console.log(`[hex-ticker] Cambio externo recibido para "${row.nombre}"`);
    }

    // Siempre sincronizar campos no-regen (afinidades, hex, buffs, estados…)
    _mergeNoRegen(pLocal, row);

    if (_onTick) _onTick();
}

// ─────────────────────────────────────────────────────────────
// MERGE — actualiza campos que NO son vex/guarda de regen
// ─────────────────────────────────────────────────────────────
function _mergeNoRegen(pLocal, row) {
    // Recursos y flags
    pLocal.hex              = row.hex              ?? pLocal.hex;
    pLocal.asistencia       = row.asistencia       ?? pLocal.asistencia;
    pLocal.vida_roja_actual = row.vida_roja_actual ?? pLocal.vida_roja_actual;
    pLocal.vida_azul_max    = row.vida_azul_max    ?? pLocal.vida_azul_max;
    pLocal.vex_max          = row.vex_max          ?? pLocal.vex_max;
    pLocal.guarda_max       = row.guarda_max       ?? pLocal.guarda_max;
    pLocal.isActive         = row.is_active        ?? pLocal.isActive;
    pLocal.isPlayer         = row.is_player        ?? pLocal.isPlayer;

    // Afinidades base
    if (row.af_fisica !== undefined) {
        pLocal.afinidadesBase = {
            fisica:     row.af_fisica     || 0,
            energetica: row.af_energetica || 0,
            espiritual: row.af_espiritual || 0,
            mando:      row.af_mando      || 0,
            psiquica:   row.af_psiquica   || 0,
            oscura:     row.af_oscura     || 0,
        };
    }
    // Buffs
    if (row.bf_fisica !== undefined) {
        pLocal.afinidadesBf = {
            fisica:     row.bf_fisica     || 0,
            energetica: row.bf_energetica || 0,
            espiritual: row.bf_espiritual || 0,
            mando:      row.bf_mando      || 0,
            psiquica:   row.bf_psiquica   || 0,
            oscura:     row.bf_oscura     || 0,
        };
    }
    // Alteraciones
    if (row.ef_fisica !== undefined) {
        pLocal.afinidadesEf = {
            fisica:     row.ef_fisica     || 0,
            energetica: row.ef_energetica || 0,
            espiritual: row.ef_espiritual || 0,
            mando:      row.ef_mando      || 0,
            psiquica:   row.ef_psiquica   || 0,
            oscura:     row.ef_oscura     || 0,
        };
    }
    // Modificadores de regen
    pLocal.regen_vex_bf    = row.regen_vex_bf    ?? pLocal.regen_vex_bf    ?? 0;
    pLocal.regen_vex_ef    = row.regen_vex_ef    ?? pLocal.regen_vex_ef    ?? 0;
    pLocal.regen_guarda_bf = row.regen_guarda_bf ?? pLocal.regen_guarda_bf ?? 0;
    pLocal.regen_guarda_ef = row.regen_guarda_ef ?? pLocal.regen_guarda_ef ?? 0;
    // Estados
    if (row.estados !== undefined) pLocal.estados = row.estados;
}
