// ============================================================
// personajes-data.js — Capa de datos (Supabase)
// /personajes/personajes-data.js
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes, formulas, pushFormulas, pushUmbrales, pushCooldown,
         colaCambios, limpiarCola, PUSH_FORMULAS_DEFAULT, PUSH_UMBRALES_DEFAULT } from './personajes-state.js';
import { mapPersonaje, serializarPersonaje } from './personajes-logic.js';

// ── Carga inicial ─────────────────────────────────────────────
export async function cargarDatos(barra) {
    try {
        if (barra) barra.style.width = '20%';

        const [pjRes, fRes, pushFRes, pushURes] = await Promise.all([
            supabase.from('personajes').select('*').order('nombre'),
            supabase.from('config_formulas').select('*'),
            supabase.from('config_push').select('*'),
            supabase.from('config_push_umbrales').select('*').order('orden')
        ]);

        if (barra) barra.style.width = '70%';

        // Poblar personajes
        for (const k in personajes) delete personajes[k];
        (pjRes.data || []).forEach(row => {
            personajes[row.nombre] = mapPersonaje(row);
        });

        // Poblar fórmulas de stats
        (fRes.data || []).forEach(row => {
            if (formulas[row.clave]) {
                formulas[row.clave].expr   = row.expresion;
                formulas[row.clave].aplica = row.aplica_a;
            }
        });

        // Poblar fórmulas de push
        (pushFRes.data || []).forEach(row => {
            if (pushFormulas[row.clave]) {
                pushFormulas[row.clave].expr       = row.expresion;
                pushFormulas[row.clave].descripcion = row.descripcion || '';
            }
        });

        // Poblar umbrales de push
        if (pushURes.data && pushURes.data.length > 0) {
            pushUmbrales.vex    = [];
            pushUmbrales.guarda = [];
            pushURes.data.forEach(row => {
                const u = {
                    id:          row.id,
                    descripcion: row.descripcion,
                    condicion:   row.condicion,
                    pushes:      row.pushes,
                    orden:       row.orden
                };
                if (row.recurso === 'vex')    pushUmbrales.vex.push(u);
                if (row.recurso === 'guarda') pushUmbrales.guarda.push(u);
            });
        }

        // Cooldown: leer de config_push si existe
        const cdVex    = pushFRes.data?.find(r => r.clave === 'cooldown_vex');
        const cdGuarda = pushFRes.data?.find(r => r.clave === 'cooldown_guarda');
        if (cdVex)    pushCooldown.vex    = parseFloat(cdVex.expresion)    || 60;
        if (cdGuarda) pushCooldown.guarda = parseFloat(cdGuarda.expresion) || 30;

        if (barra) barra.style.width = '100%';
        return true;
    } catch(e) {
        console.error('cargarDatos:', e);
        return false;
    }
}

// ── Sincronizar cola de cambios ───────────────────────────────
export async function sincronizarCola() {
    const errores = [];
    const upserts = [];
    const deletes = [];

    for (const [nombre, cambios] of Object.entries(colaCambios)) {
        if (cambios.__delete__) {
            deletes.push(nombre);
        } else {
            const p = personajes[nombre];
            if (p) upserts.push(serializarPersonaje(nombre, p));
        }
    }

    if (upserts.length > 0) {
        const { error } = await supabase.from('personajes')
            .upsert(upserts, { onConflict: 'nombre' });
        if (error) errores.push('upsert personajes: ' + error.message);
    }

    for (const nombre of deletes) {
        const { error } = await supabase.from('personajes')
            .delete().eq('nombre', nombre);
        if (error) errores.push('delete ' + nombre + ': ' + error.message);
    }

    if (errores.length > 0) return { ok: false, errores };
    limpiarCola();
    return { ok: true };
}

// ── Push inmediato a Supabase para un personaje ───────────────
// Se llama cada vez que el jugador o OP ejecuta un push
export async function persistirPush(nombre, p) {
    const { error } = await supabase.from('personajes').update({
        vex_actual:         p.vex_actual,
        guarda_actual:      p.guarda_actual,
        push_vex_actual:    p.push_vex_actual,
        push_guarda_actual: p.push_guarda_actual,
        push_vex_ts:        p.push_vex_ts,
        push_guarda_ts:     p.push_guarda_ts
    }).eq('nombre', nombre);
    return !error;
}

// ── Persistir campos arbitrarios de un personaje inmediatamente ──
// Se llama tras cada cambio en el panel de stats (afinidades, vex, guarda, etc.)
export async function persistirCampos(nombre, campos) {
    const { error } = await supabase.from('personajes')
        .update(campos)
        .eq('nombre', nombre);
    return !error;
}

// ── Guardar fórmulas de stats en DB ──────────────────────────
export async function guardarFormulasBD() {
    const rows = Object.entries(formulas).map(([clave, f]) => ({
        clave,
        label:     f.label,
        expresion: f.expr,
        aplica_a:  f.aplica
    }));
    console.log('[guardarFormulasBD] rows:', rows);
    const { error } = await supabase.from('config_formulas')
        .upsert(rows, { onConflict: 'clave' });
    if (error) console.error('[guardarFormulasBD] error:', error);
    return error ? error.message : null;  // null = éxito
}

// ── Guardar fórmulas de push en DB ───────────────────────────
export async function guardarPushFormulasBD() {
    const rows = Object.entries(pushFormulas).map(([clave, f]) => ({
        clave,
        label:       f.label,
        expresion:   f.expr,
        descripcion: f.descripcion || ''
    }));
    // Incluir cooldowns como filas especiales
    rows.push({ clave: 'cooldown_vex',    label: 'Cooldown VEX (min)',    expresion: String(pushCooldown.vex),    descripcion: 'Minutos entre pushes de VEX' });
    rows.push({ clave: 'cooldown_guarda', label: 'Cooldown Guarda (min)', expresion: String(pushCooldown.guarda), descripcion: 'Minutos entre pushes de Guarda' });
    const { error } = await supabase.from('config_push')
        .upsert(rows, { onConflict: 'clave' });
    return !error;
}

// ── Guardar umbrales de push en DB ───────────────────────────
export async function guardarPushUmbralesBD() {
    const errores = [];
    for (const recurso of ['vex', 'guarda']) {
        const umbrales = pushUmbrales[recurso] || [];
        for (const u of umbrales) {
            const row = { recurso, descripcion: u.descripcion, condicion: u.condicion, pushes: u.pushes, orden: u.orden };
            if (u.id && typeof u.id === 'number') {
                const { error } = await supabase.from('config_push_umbrales').update(row).eq('id', u.id);
                if (error) errores.push(error.message);
            } else {
                const { error } = await supabase.from('config_push_umbrales').insert(row);
                if (error) errores.push(error.message);
            }
        }
    }
    return errores.length === 0;
}

// ── Eliminar un umbral de push de DB ────────────────────────
export async function eliminarUmbralDB(id) {
    const { error } = await supabase.from('config_push_umbrales').delete().eq('id', id);
    return !error;
}
