// ============================================================
// personajes-data.js — Capa de datos (Supabase)
// /personajes/personajes-data.js
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes, formulas, regenConfig, colaCambios, limpiarCola } from './personajes-state.js';
import { mapPersonaje, serializarPersonaje } from './personajes-logic.js';

// ── Carga inicial ─────────────────────────────────────────────
export async function cargarDatos(barra) {
    try {
        if (barra) barra.style.width = '20%';

        const [pjRes, fRes, rRes] = await Promise.all([
            supabase.from('personajes').select('*').order('nombre'),
            supabase.from('config_formulas').select('*'),
            supabase.from('config_regen').select('*')
        ]);

        if (barra) barra.style.width = '70%';

        // Poblar personajes
        for (const k in personajes) delete personajes[k];
        (pjRes.data || []).forEach(row => {
            personajes[row.nombre] = mapPersonaje(row);
        });

        // Poblar fórmulas (si existen en DB, sobreescribir defaults)
        (fRes.data || []).forEach(row => {
            if (formulas[row.clave]) {
                formulas[row.clave].expr   = row.expresion;
                formulas[row.clave].aplica = row.aplica_a;
            }
        });

        // Poblar regen
        (rRes.data || []).forEach(row => {
            if (regenConfig[row.recurso]) {
                regenConfig[row.recurso].expr      = row.expresion;
                regenConfig[row.recurso].intervalo = row.intervalo_horas;
            }
        });

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

    const upserts   = [];
    const deletes   = [];

    for (const [nombre, cambios] of Object.entries(colaCambios)) {
        if (cambios.__delete__) {
            deletes.push(nombre);
        } else {
            // Si es full upsert (personaje nuevo o editado entero)
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

// ── Guardar fórmulas en DB ────────────────────────────────────
export async function guardarFormulasBD() {
    const rows = Object.entries(formulas).map(([clave, f]) => ({
        clave,
        label:     f.label,
        expresion: f.expr,
        aplica_a:  f.aplica
    }));
    const { error } = await supabase.from('config_formulas')
        .upsert(rows, { onConflict: 'clave' });
    return !error;
}

// ── Guardar config regen en DB ────────────────────────────────
export async function guardarRegenBD() {
    const rows = Object.entries(regenConfig).map(([recurso, r]) => ({
        recurso,
        label:          r.label,
        expresion:      r.expr,
        intervalo_horas: r.intervalo
    }));
    const { error } = await supabase.from('config_regen')
        .upsert(rows, { onConflict: 'recurso' });
    return !error;
}

// ── Ejecutar regeneración manual vía función SQL ──────────────
export async function ejecutarRegenBD() {
    const { data, error } = await supabase.rpc('aplicar_regeneracion');
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true, mensaje: data };
}
