// ============================================================
// hexcast-logic.js — Lógica de negocio del sistema HexCast
// ============================================================

import { supabase, currentConfig } from '../hex-auth.js';
import { personajes } from './personajes-state.js';
import { hxState, SLOT_COLORS, calcularMultCooldown, ncNecesario } from './hexcast-state.js';

// ── Helpers ──────────────────────────────────────────────────
export function _norm(s) {
  return s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
}

function _sb() { return currentConfig?.storageUrl || ''; }

export function imgPj(nombre) {
  const p = personajes[nombre];
  const icono = p?.iconoOverride || nombre;
  return `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
}

export function imgFallback() {
  return `${_sb()}/imginterfaz/no_encontrado.png`;
}

// Obtiene la afinidad efectiva del personaje para un hechizo dado
export function getAfinidadEfectiva(pjNombre, afinidadHz) {
  const p = personajes[pjNombre];
  if (!p) return 0;
  const afKey = _norm(afinidadHz);
  const mapa = {
    fisica: 'fisica', energetica: 'energetica', espiritual: 'espiritual',
    mando: 'mando', psiquica: 'psiquica', oscura: 'oscura'
  };
  const k = mapa[afKey];
  if (!k) return 0;
  const base  = (p.afin_base  || p.afinidadesBase || {})[k] || 0;
  const extra = (p.afin_extra || p.afinidadesBf   || {})[k] || 0;
  const alter = (p.afin_alter || p.afinidadesEf   || {})[k] || 0;
  return base + extra + alter;
}

// Inicializa cooldowns del PJ desde su objeto de personaje
export function initCdPj(pjNombre) {
  const p = personajes[pjNombre];
  if (!p) return;
  hxState.cdPorPj[pjNombre] = {
    fisica:     p.cd_fisica     ?? 0.5,
    energetica: p.cd_energetica ?? 0.5,
    espiritual: p.cd_espiritual ?? 0.5,
    mando:      p.cd_mando      ?? 0.5,
    psiquica:   p.cd_psiquica   ?? 0.5,
    oscura:     p.cd_oscura     ?? 0.5,
  };
}

// ── DB ───────────────────────────────────────────────────────
export async function cargarSesiones() {
  const { data, error } = await supabase
    .from('sesiones_hexcast')
    .select('*')
    .order('creada_en', { ascending: false });
  if (!error) hxState.sesiones = data || [];
}

export async function crearSesion(nombre, descripcion = '') {
  const { data, error } = await supabase
    .from('sesiones_hexcast')
    .insert({ nombre, descripcion })
    .select()
    .single();
  if (error) throw new Error(error.message);
  hxState.sesiones.unshift(data);
  return data;
}

export async function seleccionarSesion(sesionId) {
  hxState.sesionActiva = hxState.sesiones.find(s => s.id === sesionId) || null;
  const { data } = await supabase
    .from('hexcast_turnos')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('numero');
  hxState.turnos = data || [];
  if (hxState.turnos.length > 0) {
    hxState.turnoActivo = hxState.turnos[hxState.turnos.length - 1];
  } else {
    hxState.turnoActivo = await crearTurno(sesionId, 1);
  }
  hxState.stack = [];
  hxState.vistaActiva = 'cast';
}

export async function crearTurno(sesionId, numero, nombre = '') {
  const { data, error } = await supabase
    .from('hexcast_turnos')
    .insert({ sesion_id: sesionId, numero, nombre })
    .select()
    .single();
  if (error) throw new Error(error.message);
  hxState.turnos.push(data);
  return data;
}

export async function cargarInventarioPJ(pjNombre) {
  if (hxState.inventarioPJ[pjNombre]) return;
  const { data } = await supabase
    .from('hechizos_inventario')
    .select('hechizo_nombre, hechizo_afinidad, hechizo_hex')
    .eq('personaje_nombre', pjNombre);
  const inv = (data || []).map(row => {
    const cat = hxState.catalogoDB.find(h =>
      _norm(h.nombre || h.hechizo_id) === _norm(row.hechizo_nombre) ||
      _norm(h.hechizo_id) === _norm(row.hechizo_nombre)
    );
    return cat ? { ...cat, _inv: row } : {
      hechizo_id: _norm(row.hechizo_nombre),
      nombre: row.hechizo_nombre,
      afinidad: row.hechizo_afinidad || '',
      hex_cost: row.hechizo_hex || 0,
      _inv: row
    };
  });
  hxState.inventarioPJ[pjNombre] = inv;
}

export async function cargarCatalogo() {
  const { data } = await supabase.from('hechizos_nodos').select('*');
  hxState.catalogoDB = data || [];
}

/**
 * Carga el historial de lanzamientos de todos los turnos con numero < turnoNumero
 * y construye el mapa { 'PJ:afinidad': count } en hxState.historialSesion.
 * Se llama siempre que cambia el turno activo.
 */
export async function cargarHistorialSesion(sesionId, turnoNumeroActivo) {
  hxState.historialSesion = {};
  if (!sesionId) return;

  // Obtener IDs de turnos anteriores
  const turnosAnteriores = hxState.turnos.filter(t => t.numero < turnoNumeroActivo);
  if (!turnosAnteriores.length) return;

  const ids = turnosAnteriores.map(t => t.id);
  const { data } = await supabase
    .from('hexcast_lanzamientos')
    .select('personaje_nombre, hechizo_afinidad')
    .in('turno_id', ids);

  const hist = {};
  for (const row of (data || [])) {
    const k = `${row.personaje_nombre}:${(row.hechizo_afinidad || '').toLowerCase()}`;
    hist[k] = (hist[k] || 0) + 1;
  }
  hxState.historialSesion = hist;
}

// ── Stack de hechizos ────────────────────────────────────────
export function agregarHechizo(pjNombre, grupo, slotIdx, hechizo) {
  const color = SLOT_COLORS[grupo]?.[slotIdx] || SLOT_COLORS.A[0];
  const afinidadEfectiva = getAfinidadEfectiva(pjNombre, hechizo.afinidad);
  const mult = calcularMultCooldown(pjNombre, hechizo.afinidad, hxState.stack);
  const costoBase = hechizo.hex_cost || 0;
  // ncNecesario = umbral para el éxito (costoBase × mult). NO es el HEX cobrado.
  const ncNec = ncNecesario(costoBase, mult);

  const item = {
    id: 'local_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    pjNombre, grupo, slotIdx, color,
    hechizo,
    infalible: false,
    forceFallo: false,
    cobrarHex: true,
    esPrioridad: !!(hechizo.es_prioridad),  // auto-prioridad si el hechizo lo requiere
    dado: '',
    afinidadEfectiva,
    mult,
    costoBase,       // HEX que se cobra si éxito (NO se multiplica por CD)
    ncNecesario: ncNec,  // NC mínimo para el éxito (costoBase × mult)
    abierto: false,
    resultado: null,
    ncCalc: null,
    hexGastado: 0
  };
  hxState.stack.push(item);
  // Si el hechizo es de prioridad y no es el primero, moverlo al frente
  if (hechizo.es_prioridad && hxState.stack.length > 1) {
    const idx = hxState.stack.length - 1;
    const [added] = hxState.stack.splice(idx, 1);
    hxState.stack.unshift(added);
    _recalcCooldowns();
  }
  return item;
}

export function removerHechizo(itemId) {
  hxState.stack = hxState.stack.filter(i => i.id !== itemId);
  _recalcCooldowns();
}

export function moverAPrioridad(itemId) {
  const idx = hxState.stack.findIndex(i => i.id === itemId);
  if (idx <= 0) return;
  const [item] = hxState.stack.splice(idx, 1);
  item.esPrioridad = true;
  hxState.stack.unshift(item);
  _recalcCooldowns();
}

function _recalcCooldowns() {
  // Count within current stack
  const vistoStack = {};
  hxState.stack.forEach(item => {
    const afKey = (item.hechizo?.afinidad || '').toLowerCase();
    const k = `${item.pjNombre}:${afKey}`;
    const previosStack = vistoStack[k] || 0;
    const previosSesion = hxState.historialSesion[k] || 0;
    const totalPrevios = previosSesion + previosStack;
    const cd = hxState.cdPorPj[item.pjNombre]?.[afKey] ?? 0.5;
    item.mult = totalPrevios === 0 ? 1.0 : 1 + totalPrevios * cd;
    item.ncNecesario = ncNecesario(item.costoBase, item.mult);
    // costoBase (HEX cobrado) NO cambia con el CD
    vistoStack[k] = previosStack + 1;
  });
}

export function evaluarItem(item) {
  if (item.forceFallo) {
    item.resultado = 'fallo';
    item.ncCalc = null;
    return;
  }
  if (item.infalible) {
    item.resultado = 'infalible';
    item.ncCalc = null;
    return;
  }
  const dado = parseInt(item.dado);
  if (!dado || isNaN(dado)) { item.resultado = null; item.ncCalc = null; return; }
  const nc = dado * item.afinidadEfectiva;
  item.ncCalc = nc;
  // Éxito si NC alcanza el umbral (costoBase × mult). El HEX cobrado es siempre costoBase.
  item.resultado = nc >= item.ncNecesario ? 'exito' : 'fallo';
}

export function evaluarStack() {
  hxState.stack.forEach(item => evaluarItem(item));
}

export async function confirmarTurno() {
  if (!hxState.turnoActivo) return { ok: false, msg: 'Sin turno activo' };
  evaluarStack();

  const rows = [];
  for (const item of hxState.stack) {
    const dado = parseInt(item.dado) || null;
    // HEX cobrado = costoBase (sin multiplicar por CD). Solo si éxito/infalible.
    const hexGastado = (item.resultado === 'exito' || item.resultado === 'infalible') && item.cobrarHex
      ? item.costoBase : 0;
    item.hexGastado = hexGastado;

    if (hexGastado > 0) {
      const p = personajes[item.pjNombre];
      if (p) {
        const nuevoHex = Math.max(0, (p.hex || 0) - hexGastado);
        p.hex = nuevoHex;
        await supabase.from('personajes')
          .update({ hex: nuevoHex })
          .eq('nombre', item.pjNombre);
      }
    }

    rows.push({
      turno_id:           hxState.turnoActivo.id,
      sesion_id:          hxState.sesionActiva.id,
      personaje_nombre:   item.pjNombre,
      grupo:              item.grupo,
      hechizo_id:         item.hechizo.hechizo_id,
      hechizo_nombre:     item.hechizo.nombre,
      hechizo_afinidad:   item.hechizo.afinidad || '',
      hechizo_hex_cost:   item.costoBase,
      dado_d100:          dado,
      afinidad_efectiva:  item.afinidadEfectiva,
      infalible:          item.infalible,
      cobrar_hex:         item.cobrarHex,
      es_prioridad:       item.esPrioridad,
      nc:                 item.ncCalc,
      costo_efectivo:     item.ncNecesario,   // guardamos el NC umbral (no el HEX)
      multiplicador_cd:   item.mult,
      resultado:          item.resultado,
      hex_gastado:        hexGastado,
      orden:              hxState.stack.indexOf(item)
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('hexcast_lanzamientos').insert(rows);
    if (error) return { ok: false, msg: error.message };
  }

  const nuevoNum = hxState.turnos.length + 1;
  const nuevoTurno = await crearTurno(hxState.sesionActiva.id, nuevoNum);
  hxState.turnoActivo = nuevoTurno;
  hxState.stack = [];
  // El nuevo turno no tiene previos propios, pero el historial se actualiza
  await cargarHistorialSesion(hxState.sesionActiva.id, nuevoTurno.numero);
  return { ok: true };
}
