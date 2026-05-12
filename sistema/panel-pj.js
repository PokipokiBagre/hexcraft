// ============================================================
// panel-pj.js — Panel lateral de personaje con 5 pestañas
// /personajes/panel-pj.js
// ============================================================

import { personajes, estadoUI, formulas } from './personajes-state.js';
import {
    calcularStats, buildContext, evalExpr,
    calcularPushDisponibles, calcularValorPush, calcularCooldownPush
} from './personajes-logic.js';
import { currentConfig, supabase } from '../hex-auth.js';
import { encolarCambio } from './personajes-state.js';
import { abrirMinimapa, cerrarMinimapa, centrarEnHechizo } from '../panel-mapa-hechizos.js';
import { renderTabMisiones, cerrarTabMisiones } from './panel-mis.js';
// panel-objetos-op.js se carga dinámicamente al abrir la tab Objetos como admin

// ── Helpers ───────────────────────────────────────────────────
const _sb   = () => currentConfig.storageUrl;
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';

const _imgPj   = (icono) => `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
const _imgIcon = (icono) => `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
const _fallback = () => `${_sb()}/imginterfaz/no_encontrado.png`;

// Lee afinidades del schema nuevo (afin_base) O del viejo (afinidadesBase)
const _getAfin = (p) => ({
    base:  p.afin_base  || p.afinidadesBase || {},
    extra: p.afin_extra || p.afinidadesBf   || {},
    alter: p.afin_alter || p.afinidadesEf   || {}
});

const _tabActivo = {};

const _rarColor = (r) => ({ 'Legendario':'#d4af37','Raro':'#9a50dc','Común':'#5a5a78' })[r] || '#4a4a68';
const _rarOrd   = (r) => ({ 'Legendario':3,'Raro':2,'Común':1 })[r] || 0;

function _tiempoRelativo(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)    return 'hace un momento';
    if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    const d = Math.floor(diff/86400);
    return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('panel-pj-styles')) return;
    const st = document.createElement('style');
    st.id = 'panel-pj-styles';
    st.textContent = `
#panel-pj-root{position:fixed;inset:0;background:transparent;border:none;z-index:1200;pointer-events:none;font-family:'Inter',system-ui,sans-serif;}
#panel-pj-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1199;opacity:0;pointer-events:none;transition:opacity 0.28s;}
#panel-pj-overlay.open{opacity:1;pointer-events:all;}
/* Col HEX: borde izquierdo, width 50vw — se muestra/oculta por JS */
#ppj-col-main{position:fixed;top:0;left:0;width:50vw;height:100vh;background:#08080f;border-right:1px solid rgba(212,175,55,0.18);display:none;flex-direction:column;overflow:hidden;box-shadow:8px 0 40px rgba(0,0,0,0.6);z-index:1200;pointer-events:auto;}
/* Col STATS: borde derecho, width 25vw — siempre visible cuando el panel está abierto */
#ppj-col-stats{position:fixed;top:0;right:0;width:25vw;min-width:280px;height:100vh;background:#070710;border-left:1px solid rgba(255,255,255,0.06);display:none;flex-direction:column;overflow:hidden;z-index:1200;pointer-events:auto;}
#ppj-col-stats .ppj-header{border-bottom:1px solid rgba(255,255,255,0.06);background:#070710;}
#ppj-col-stats .ppj-tabs{flex-shrink:0;background:#0a0a14;}
#ppj-col-stats .ppj-body{padding-bottom:20px;}
#ppj-col-stats .ppj-section{padding:10px 12px;}
.ppj-header{display:flex;align-items:center;gap:12px;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;min-height:68px;}
.ppj-avatar{width:44px;height:44px;border-radius:8px;object-fit:cover;object-position:top;border:1px solid rgba(212,175,55,0.3);flex-shrink:0;cursor:pointer;background:#111;}
.ppj-header-info{flex:1;min-width:0;}
.ppj-nombre{font-family:'Cinzel',serif;font-size:0.95em;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.5px;}
.ppj-tags{display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;}
.ppj-tag{font-size:0.63em;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;font-weight:500;text-transform:uppercase;}
.ppj-tag-jugador{background:rgba(212,175,55,0.12);color:#d4af37;border:1px solid rgba(212,175,55,0.25);}
.ppj-tag-npc{background:rgba(90,90,120,0.2);color:#aaa;border:1px solid rgba(90,90,120,0.3);}
.ppj-tag-activo{background:rgba(62,207,110,0.1);color:#3ecf6e;border:1px solid rgba(62,207,110,0.2);}
.ppj-tag-inactivo{background:rgba(200,60,60,0.1);color:#c44;border:1px solid rgba(200,60,60,0.2);}
.ppj-header-btns{display:flex;gap:6px;align-items:center;}
.ppj-btn-icon{background:none;border:none;color:#5a5a78;font-size:1.05em;cursor:pointer;padding:4px 6px;border-radius:5px;line-height:1;transition:color 0.15s,background 0.15s;}
.ppj-btn-icon:hover{color:#d4af37;background:rgba(212,175,55,0.08);}
.ppj-close{font-size:1.3em;}
.ppj-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;background:#0a0a14;}
.ppj-tab{flex:1;background:none;border:none;color:#4a4a68;font-size:0.66em;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:10px 2px 9px;cursor:pointer;border-bottom:2px solid transparent;transition:color 0.15s,border-color 0.15s;font-family:'Inter',system-ui,sans-serif;}
.ppj-tab:hover{color:#888;}
.ppj-tab.active{color:#d4af37;border-bottom-color:#d4af37;}
.ppj-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 0 70px;scrollbar-width:thin;scrollbar-color:rgba(212,175,55,0.2) transparent;}
.ppj-body::-webkit-scrollbar{width:4px;}.ppj-body::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.2);border-radius:2px;}
.ppj-section{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);}
.ppj-section-title{font-size:0.62em;letter-spacing:1.5px;text-transform:uppercase;color:#3a3a58;font-weight:600;margin-bottom:10px;}
.ppj-hex-val{font-family:'Cinzel',serif;font-size:2.4em;color:#d4af37;text-align:center;padding:12px 0 8px;letter-spacing:2px;}
.ppj-hex-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:5px;}
.ppj-hex-btn{background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:6px;color:#d4af37;font-size:0.74em;padding:6px 2px;cursor:pointer;transition:background 0.15s;font-weight:600;}
.ppj-hex-btn:hover{background:rgba(212,175,55,0.15);}
.ppj-hex-btn.neg{color:#e06060;border-color:rgba(220,80,80,0.2);background:rgba(220,80,80,0.05);}
.ppj-hex-btn.neg:hover{background:rgba(220,80,80,0.12);}
.ppj-hpush-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;}
.ppj-hpush-card{background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:12px 8px;text-align:center;transition:all 0.15s;}
.ppj-hpush-card.available{border-color:rgba(212,175,55,0.45);background:rgba(212,175,55,0.09);box-shadow:0 0 12px rgba(212,175,55,0.08);}
.ppj-hpush-label{font-size:0.62em;color:#7a6a30;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;font-weight:600;}
.ppj-hpush-amt{font-size:1.15em;font-weight:700;color:#d4af37;font-family:'Cinzel',serif;margin-bottom:4px;}
.ppj-hpush-cd{font-size:0.6em;color:#4a4a68;margin-bottom:6px;min-height:14px;}
.ppj-hpush-btn{width:100%;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);border-radius:6px;color:#d4af37;font-size:0.7em;font-weight:700;padding:6px 4px;cursor:pointer;transition:background 0.15s;font-family:'Cinzel',serif;letter-spacing:0.5px;}
.ppj-hpush-btn:hover:not(:disabled){background:rgba(212,175,55,0.28);}
.ppj-hpush-btn:disabled{opacity:0.3;cursor:default;}
.ppj-contenido-row{display:flex;gap:6px;align-items:center;margin-top:5px;}
.ppj-contenido-input{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:#d4af37;font-size:0.8em;padding:4px 6px;font-weight:700;text-align:center;}
.ppj-hlog-item{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid rgba(255,255,255,0.04);margin-bottom:5px;}
.ppj-hlog-tipo{font-size:0.62em;font-weight:700;letter-spacing:0.5px;padding:2px 7px;border-radius:10px;flex-shrink:0;}
.hlog-asistencia{background:rgba(62,207,110,0.1);color:#3ecf6e;border:1px solid rgba(62,207,110,0.2);}
.hlog-turno_extra{background:rgba(74,179,232,0.1);color:#4ab3e8;border:1px solid rgba(74,179,232,0.2);}
.hlog-contenido{background:rgba(212,175,55,0.1);color:#d4af37;border:1px solid rgba(212,175,55,0.2);}
.ppj-hlog-amt{font-size:0.9em;font-weight:700;color:#d4af37;font-family:'Cinzel',serif;min-width:48px;}
.ppj-hlog-meta{flex:1;min-width:0;}
.ppj-hlog-time{font-size:0.65em;color:#4a4a68;}
.ppj-hlog-nota{font-size:0.68em;color:#5a5a78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ppj-hlog-del{background:none;border:none;color:#3a3a58;font-size:0.9em;cursor:pointer;padding:2px 5px;border-radius:3px;transition:color 0.15s;}
.ppj-hlog-del:hover{color:#c44;}
.ppj-vida-block{margin-bottom:12px;}
.ppj-vida-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
.ppj-vida-label{font-size:0.78em;color:#888;font-weight:500;}
.ppj-vida-ctrl{display:flex;align-items:center;gap:6px;}
.ppj-vida-xy{font-size:0.88em;font-weight:600;color:#ccc;}
.ppj-vida-xy .actual{color:#e8e8e8;}.ppj-vida-xy .sep{color:#3a3a58;margin:0 2px;}.ppj-vida-xy .maximo{color:#5a5a78;}
.ppj-ctrl-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#888;width:22px;height:22px;font-size:0.85em;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s,color 0.15s;}
.ppj-ctrl-btn:hover{background:rgba(255,255,255,0.1);color:#ccc;}
.ppj-seg-bar{display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden;}
.ppj-seg{height:100%;border-radius:1px;}
.ppj-seg.on-vida{background:#d4af37;}.ppj-seg.off-vida{background:rgba(212,175,55,0.12);}
.ppj-seg.on-azul{background:#4ab3e8;}.ppj-seg.off-azul{background:rgba(74,179,232,0.1);}
.ppj-seg.on-guarda{background:#d4af37;opacity:0.8;}.ppj-seg.off-guarda{background:rgba(212,175,55,0.08);}
.ppj-vex-bar{height:6px;border-radius:3px;background:rgba(160,80,220,0.12);overflow:hidden;margin-top:5px;}
.ppj-vex-fill{height:100%;background:#9a50dc;border-radius:3px;transition:width 0.3s;}
.ppj-formula{font-size:0.62em;color:#2e2e48;font-family:monospace;margin-top:3px;}
.ppj-max-row{display:flex;align-items:center;gap:6px;margin:4px 0 8px;padding:5px 8px;background:rgba(255,255,255,0.02);border-radius:5px;border:1px solid rgba(255,255,255,0.04);}
.ppj-max-label{font-size:0.68em;color:#3a3a58;flex:1;}
.ppj-max-val{font-size:0.8em;color:#888;min-width:28px;text-align:center;font-weight:600;}
.ppj-max-val.formula{color:#4a4a68;}.ppj-max-val.manual{color:#d4af37;}
.ppj-hint{font-size:0.6em;color:#3a3a58;}.ppj-hint.manual{color:rgba(212,175,55,0.5);}
.ppj-afin-block{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:10px 12px;margin-bottom:7px;}
.ppj-afin-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.ppj-afin-name{font-size:0.78em;color:#9090b0;font-weight:500;}
.ppj-afin-total{font-size:1em;color:#d4af37;font-weight:700;}
.ppj-afin-row{display:flex;align-items:center;gap:6px;margin-top:4px;}
.ppj-afin-src-lbl{font-size:0.6em;font-weight:700;letter-spacing:0.5px;padding:1px 5px;border-radius:3px;width:28px;text-align:center;}
.src-b{background:rgba(100,150,255,0.12);color:#6496ff;}.src-ext{background:rgba(212,175,55,0.1);color:#d4af37;}.src-alt{background:rgba(220,100,100,0.1);color:#e08080;}
.ppj-afin-val{font-size:0.82em;color:#ccc;min-width:24px;text-align:center;font-weight:600;}
.ppj-cd-row{display:flex;align-items:center;gap:6px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.04);}
.ppj-cd-label{font-size:0.62em;color:#4a4a68;flex:1;}
.ppj-cd-val{font-size:0.78em;color:#9090b0;font-weight:600;min-width:36px;text-align:center;}
.ppj-cd-input{width:56px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#9090b0;font-size:0.75em;padding:3px 6px;text-align:center;}
.ppj-push-block{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:10px 12px;margin-bottom:8px;}
.ppj-push-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.ppj-push-label{font-size:0.78em;color:#9090b0;font-weight:600;}
.ppj-push-dots{display:flex;gap:4px;}
.ppj-dot{width:8px;height:8px;border-radius:50%;}
.ppj-dot.used{background:#d4af37;}.ppj-dot.avail{background:rgba(212,175,55,0.2);border:1px solid rgba(212,175,55,0.3);}
.ppj-push-info{display:flex;align-items:center;justify-content:space-between;margin-top:6px;}
.ppj-push-valor{font-size:0.72em;color:#5a5a78;}
.ppj-push-cd{font-size:0.7em;color:#e09040;margin-top:4px;}
.btn-push-pj{background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:5px;color:#d4af37;font-size:0.72em;font-weight:600;padding:5px 12px;cursor:pointer;transition:background 0.15s;font-family:'Cinzel',serif;letter-spacing:0.5px;}
.btn-push-pj:hover:not(:disabled){background:rgba(212,175,55,0.2);}
.btn-push-pj:disabled{opacity:0.4;cursor:default;}
.ppj-hz-card{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:10px 12px;margin-bottom:6px;}
.ppj-hz-header{display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;}
.ppj-hz-af{font-size:0.58em;font-weight:700;letter-spacing:0.5px;padding:2px 6px;border-radius:4px;flex-shrink:0;margin-top:2px;text-transform:uppercase;}
.ppj-hz-nombre{font-size:0.88em;font-weight:700;color:#d0d0e0;flex:1;}
.ppj-hz-clase{font-size:0.66em;color:#5a5a7a;flex-shrink:0;align-self:center;}
.ppj-hz-hex{display:inline-flex;align-items:center;gap:3px;font-size:0.75em;color:#c9953a;font-family:'Cinzel',serif;background:rgba(212,175,55,0.07);border:1px solid rgba(212,175,55,0.2);border-radius:4px;padding:1px 6px;margin-left:6px;flex-shrink:0;}
.ppj-hz-fields{display:flex;flex-direction:column;gap:3px;}
.ppj-hz-field{font-size:0.7em;color:#5a5a78;line-height:1.4;}
.ppj-hz-field strong{color:#888;font-weight:600;}
.ppj-obj-search{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#ccc;font-size:0.8em;padding:7px 10px;margin-bottom:10px;box-sizing:border-box;}
.ppj-obj-search::placeholder{color:#5a5a80;}
.ppj-obj-card{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:10px 12px;margin-bottom:6px;}
.ppj-obj-card.equipado{border-color:rgba(212,175,55,0.2);background:rgba(212,175,55,0.03);}
.ppj-obj-header{display:flex;align-items:center;gap:8px;}
.ppj-obj-cant{font-size:0.8em;font-weight:700;color:#d4af37;min-width:28px;text-align:center;}
.ppj-obj-nombre{font-size:0.82em;color:#ccc;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ppj-obj-rar{font-size:0.6em;font-weight:700;padding:1px 6px;border-radius:3px;flex-shrink:0;}
.ppj-obj-det{font-size:0.7em;color:#a8a8c4;margin-top:4px;line-height:1.4;}
.ppj-obj-footer{display:flex;align-items:center;justify-content:space-between;margin-top:7px;}
.ppj-obj-tipo{font-size:0.62em;color:#9898b8;}
.ppj-eqp-btn{font-size:0.65em;font-weight:700;padding:3px 10px;border-radius:10px;cursor:pointer;border:1px solid;transition:background 0.15s;}
.ppj-eqp-btn.on{background:rgba(212,175,55,0.1);color:#d4af37;border-color:rgba(212,175,55,0.3);}
.ppj-eqp-btn.off{background:rgba(255,255,255,0.03);color:#4a4a68;border-color:rgba(255,255,255,0.06);}
.ppj-obj-seccion-titulo{font-size:0.62em;letter-spacing:1.5px;text-transform:uppercase;color:#7878a0;font-weight:600;margin:12px 0 6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);}
.ppj-obj-vehiculo{margin-top:5px;display:flex;gap:10px;}
.ppj-obj-vida-pill{font-size:0.65em;padding:2px 8px;border-radius:10px;font-weight:600;}
.ppj-obj-vida-roja{background:rgba(212,175,55,0.1);color:#d4af37;border:1px solid rgba(212,175,55,0.2);}
.ppj-obj-vida-azul{background:rgba(74,179,232,0.1);color:#4ab3e8;border:1px solid rgba(74,179,232,0.2);}
.ppj-contenedor-items{margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:5px;border:1px solid rgba(255,255,255,0.04);}
.ppj-contenedor-item{font-size:0.7em;color:#5a5a78;padding:2px 0;}
.ppj-mision-card{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:11px 13px;margin-bottom:7px;}
.ppj-mis-header{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:5px;}
.ppj-mis-titulo{font-size:0.82em;font-weight:600;color:#c8c8d8;flex:1;}
.ppj-mis-clase{font-size:0.62em;color:#4a4a68;flex-shrink:0;}
.ppj-mis-badge{font-size:0.62em;padding:2px 8px;border-radius:10px;margin-bottom:5px;display:inline-block;}
.ppj-mis-0{background:rgba(100,100,100,0.1);color:#666;border:1px solid rgba(100,100,100,0.2);}
.ppj-mis-1{background:rgba(212,175,55,0.1);color:#d4af37;border:1px solid rgba(212,175,55,0.2);}
.ppj-mis-2{background:rgba(74,179,232,0.1);color:#4ab3e8;border:1px solid rgba(74,179,232,0.2);}
.ppj-mis-3{background:rgba(62,207,110,0.1);color:#3ecf6e;border:1px solid rgba(62,207,110,0.2);}
.ppj-mis-desc{font-size:0.7em;color:#5a5a78;line-height:1.5;margin-top:4px;}
.ppj-img-wrap{position:relative;margin-bottom:10px;cursor:pointer;border-radius:8px;overflow:hidden;}
.ppj-img-preview{width:100%;max-height:190px;object-fit:cover;object-position:top;border-radius:8px;border:1px solid rgba(255,255,255,0.06);display:block;background:#111;}
.ppj-img-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);opacity:0;display:flex;align-items:center;justify-content:center;font-size:0.75em;color:#d4af37;border-radius:8px;transition:opacity 0.2s;font-family:'Cinzel',serif;letter-spacing:1px;}
.ppj-img-wrap:hover .ppj-img-overlay{opacity:1;}
.ppj-empty{text-align:center;color:#2e2e48;font-size:0.75em;padding:24px 0;}
.ppj-empty-icon{font-size:1.6em;margin-bottom:8px;opacity:0.4;}
.ppj-loader{display:flex;align-items:center;justify-content:center;padding:20px;color:#3a3a58;font-size:0.75em;gap:8px;}
.ppj-loader::before{content:'';width:14px;height:14px;border:2px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:ppj-spin 0.8s linear infinite;}
@keyframes ppj-spin{to{transform:rotate(360deg);}}
.ppj-footer{position:sticky;bottom:0;padding:10px 16px;background:linear-gradient(to top,#08080f 80%,transparent);display:flex;gap:8px;flex-shrink:0;}
.ppj-btn-editar{flex:1;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:6px;color:#d4af37;font-size:0.78em;font-weight:600;padding:9px;cursor:pointer;font-family:'Cinzel',serif;letter-spacing:0.5px;transition:background 0.15s;}
.ppj-btn-editar:hover{background:rgba(212,175,55,0.15);}
.ppj-hz-new-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;font-size:0.75em;font-family:'Cinzel',serif;cursor:pointer;transition:all 0.15s;letter-spacing:0.5px;border:1px solid;margin:10px 0 8px;width:100%;box-sizing:border-box;text-align:left;}
.ppj-hz-new-inv{background:rgba(212,175,55,0.09);color:#d4af37;border-color:rgba(212,175,55,0.28);}
.ppj-hz-new-inv:hover{background:rgba(212,175,55,0.18);border-color:rgba(212,175,55,0.45);}
.ppj-hz-new-cat{background:rgba(0,200,200,0.06);color:#00cccc;border-color:rgba(0,200,200,0.22);}
.ppj-hz-new-cat:hover{background:rgba(0,200,200,0.14);border-color:rgba(0,200,200,0.4);}
.ppj-hz-new-icon{font-size:1.3em;flex-shrink:0;}
.ppj-hz-new-text-main{font-weight:700;font-size:1em;}
.ppj-hz-new-text-sub{font-size:0.8em;opacity:0.65;font-family:'Inter',system-ui,sans-serif;font-weight:400;letter-spacing:0;margin-top:1px;}
.ppj-hz-assign-notice{background:rgba(212,175,55,0.07);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:11px 14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px;}
.ppj-hz-assign-icon{font-size:1.4em;flex-shrink:0;line-height:1.2;}
.ppj-hz-assign-title{font-size:0.76em;color:#d4af37;font-family:'Cinzel',serif;letter-spacing:0.5px;margin-bottom:3px;}
.ppj-hz-assign-sub{font-size:0.68em;color:#888;line-height:1.4;}
.ppj-cat-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:5px;font-size:0.7em;font-family:'Inter',system-ui,sans-serif;cursor:pointer;border:1px solid;transition:all 0.15s;white-space:nowrap;}
.ppj-cat-free{background:rgba(80,200,80,0.1);color:#50c864;border-color:rgba(80,200,80,0.3);}
.ppj-cat-free:hover{background:rgba(80,200,80,0.22);}
.ppj-cat-half{background:rgba(0,160,255,0.1);color:#4eb4ff;border-color:rgba(0,160,255,0.3);}
.ppj-cat-half:hover{background:rgba(0,160,255,0.22);}
.ppj-cat-full{background:rgba(212,175,55,0.1);color:#d4af37;border-color:rgba(212,175,55,0.3);}
.ppj-cat-full:hover{background:rgba(212,175,55,0.22);}
.ppj-cat-over{background:rgba(220,60,60,0.1);color:#ff6060;border-color:rgba(220,60,60,0.3);}
.ppj-cat-over:hover{background:rgba(220,60,60,0.22);}
.ppj-cat-deasign{background:rgba(120,120,120,0.08);color:#888;border-color:rgba(120,120,120,0.2);}
.ppj-cat-deasign:hover{background:rgba(120,120,120,0.18);color:#bbb;}
.ppj-hz-badge{display:inline-flex;align-items:center;gap:3px;font-size:0.62em;padding:1px 6px;border-radius:10px;border:1px solid;flex-shrink:0;white-space:nowrap;}
.ppj-hz-badge-estado{background:rgba(212,175,55,0.08);color:#c9953a;border-color:rgba(212,175,55,0.25);}
.ppj-hz-badge-prioridad{background:rgba(100,180,255,0.08);color:#6eb4ff;border-color:rgba(100,180,255,0.25);}
.ppj-hz-badge-cast{background:rgba(100,180,255,0.07);color:#7ab8e8;border-color:rgba(100,180,255,0.2);}
.ppj-hz-badge-afecta{background:rgba(140,100,220,0.07);color:#a07ad0;border-color:rgba(140,100,220,0.2);}
.ppj-hz-btn-danger{background:rgba(200,50,50,0.12);color:#ff5555;border:1px solid rgba(200,50,50,0.35);border-radius:6px;padding:10px 18px;font-size:0.8em;font-family:'Cinzel',serif;cursor:pointer;transition:background 0.15s;}
.ppj-hz-btn-danger:hover{background:rgba(200,50,50,0.28);}
`;
    document.head.appendChild(st);
}

// ─────────────────────────────────────────────────────────────
// ESTRUCTURA
// ─────────────────────────────────────────────────────────────
function _crearEstructura() {
    if (document.getElementById('panel-pj-root')) return;
    _inyectarEstilos();
    const overlay = document.createElement('div');
    overlay.id = 'panel-pj-overlay';
    overlay.onclick = cerrarPanelPJ;
    document.body.appendChild(overlay);
    const root = document.createElement('div');
    root.id = 'panel-pj-root';
    // Col-main (50vw): header + tabs + body + footer — muestra HEX o Hechizos/Objetos/Misiones
    // Col-stats (25vw): siempre Stats+Afinidades cuando tab=stats, vacío/oculto en otras tabs
    root.innerHTML = `
        <div id="ppj-col-main">
            <div class="ppj-body"   id="ppj-hex-body"></div>
        </div>
        <div id="ppj-col-stats">
            <div class="ppj-header" id="ppj-header"></div>
            <div class="ppj-tabs"   id="ppj-tabs"></div>
            <div class="ppj-body"   id="ppj-body"></div>
            <div class="ppj-body"   id="ppj-stats-body" style="display:none;"></div>
            <div class="ppj-footer" id="ppj-footer"></div>
        </div>`;
    document.body.appendChild(root);
}

// ─────────────────────────────────────────────────────────────
// ABRIR / CERRAR
// ─────────────────────────────────────────────────────────────
export function abrirPanelPJ(nombre) {
    _crearEstructura();
    estadoUI.pjSeleccionado = nombre;
    estadoUI.panelAbierto   = true;
    document.getElementById('ppj-col-main').style.display  = 'none'; // se muestra solo en tab stats
    document.getElementById('ppj-col-stats').style.display = 'flex';
    document.getElementById('panel-pj-overlay').classList.add('open');
    _renderHeader(nombre);
    _renderTabs(nombre);
    _renderTab(nombre, _tabActivo[nombre] || 'stats');
}

export function cerrarPanelPJ() {
    estadoUI.panelAbierto = false;
    document.getElementById('ppj-col-main')?.style  && (document.getElementById('ppj-col-main').style.display  = 'none');
    document.getElementById('ppj-col-stats')?.style && (document.getElementById('ppj-col-stats').style.display = 'none');
    document.getElementById('panel-pj-overlay')?.classList.remove('open');
    cerrarMinimapa();
    _cerrarPanelObjetos();
    cerrarTabMisiones();
}

// ─────────────────────────────────────────────────────────────
// HEADER — sin re-crear img para evitar parpadeo
// ─────────────────────────────────────────────────────────────
function _renderHeader(nombre) {
    const p = personajes[nombre]; if (!p) return;
    const icono = p.iconoOverride || nombre;
    const safe  = nombre.replace(/'/g, "\\'");
    const tags  = [
        p.isPlayer ? `<span class="ppj-tag ppj-tag-jugador">Jugador</span>` : `<span class="ppj-tag ppj-tag-npc">NPC</span>`,
        p.isActive ? `<span class="ppj-tag ppj-tag-activo">Activo</span>` : `<span class="ppj-tag ppj-tag-inactivo">Inactivo</span>`
    ].join('');

    const header = document.getElementById('ppj-header');
    if (!header.querySelector('.ppj-avatar')) {
        header.innerHTML = `
            <img class="ppj-avatar" src="${_imgIcon(icono)}"
                 onerror="if(this.src!=='${_fallback()}')this.src='${_fallback()}'"
                 onclick="window._ppjAbrirImgGrande('${safe}')" title="Ver imagen">
            <div class="ppj-header-info">
                <div class="ppj-nombre" id="ppj-nombre-txt"></div>
                <div class="ppj-tags"  id="ppj-tags-txt"></div>
            </div>
            <div class="ppj-header-btns" id="ppj-header-btns"></div>`;
    }
    const img = header.querySelector('.ppj-avatar');
    const newSrc = _imgIcon(icono);
    if (img && img.getAttribute('data-pj') !== nombre) { img.src = newSrc; img.setAttribute('data-pj', nombre); }
    const n = document.getElementById('ppj-nombre-txt'); if (n) n.textContent = nombre;
    const t = document.getElementById('ppj-tags-txt');   if (t) t.innerHTML  = tags;
    const b = document.getElementById('ppj-header-btns'); if (b) b.innerHTML = `
        ${(estadoUI.esAdmin || !p.isPlayer) ? `<button class="ppj-btn-icon" onclick="window.editarPersonaje('${safe}')">✏️</button>` : ''}
        <button class="ppj-btn-icon ppj-close" onclick="window.cerrarDetalle()">×</button>`;
    const f = document.getElementById('ppj-footer'); if (f) f.innerHTML = (estadoUI.esAdmin || !p.isPlayer)
        ? `<button class="ppj-btn-editar" onclick="window.editarPersonaje('${safe}')">Editar personaje</button>` : '';
}

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────
function _renderTabs(nombre) {
    const p = personajes[nombre]; if (!p) return;
    const tabs = [
        { id:'stats',    label:'Stats' },
        { id:'hechizos', label:'Hechizos' },
        { id:'objetos',  label:'Objetos' },
        ...( p.isPlayer ? [{ id:'misiones', label:'Misiones' }] : [] )
    ];
    document.getElementById('ppj-tabs').innerHTML = tabs.map(t =>
        `<button class="ppj-tab ${(_tabActivo[nombre]||'stats')===t.id?'active':''}"
                 onclick="window._ppjCambiarTab('${nombre.replace(/'/g,"\\'")}','${t.id}')">${t.label}</button>`
    ).join('');
}

function _renderTab(nombre, tab) {
    _tabActivo[nombre] = tab;
    document.querySelectorAll('.ppj-tab').forEach(b =>
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${tab}'`))
    );
    const hexBody   = document.getElementById('ppj-hex-body');
    const colMain   = document.getElementById('ppj-col-main');
    const body      = document.getElementById('ppj-body');
    const statsBody = document.getElementById('ppj-stats-body');

    if (tab === 'stats') {
        // Mostrar col-main con contenido HEX
        if (colMain)   colMain.style.display = 'flex';
        if (body)      { body.style.display = 'none'; body.innerHTML = ''; }
        if (statsBody) { statsBody.style.display = ''; const _sy = statsBody.scrollTop; statsBody.innerHTML = _tabStats(nombre); if (_sy > 0) statsBody.scrollTop = _sy; }
        if (hexBody)   _tabHex(nombre, hexBody);
    } else {
        // Ocultar col-main
        if (colMain)   colMain.style.display = 'none';
        if (statsBody) { statsBody.style.display = 'none'; }
        if (body)      { body.style.display = ''; body.innerHTML = `<div class="ppj-loader">Cargando…</div>`; }
    }

    if (tab !== 'hechizos') {
        cerrarMinimapa();
        document.getElementById('panel-pj-root')?.classList.remove('hz-mode');
    } else {
        document.getElementById('panel-pj-root')?.classList.add('hz-mode');
    }
    if (tab !== 'objetos')  _cerrarPanelObjetos();
    if (tab !== 'misiones') cerrarTabMisiones();

    switch(tab) {
        case 'hechizos': _tabHechizosConMapa(nombre, body);  break;
        case 'objetos':  _tabObjetos(nombre, body);           break;
        case 'misiones': renderTabMisiones(nombre, body);      break;
    }
}

// Wrapper que abre el minimapa junto con la tab de hechizos
async function _tabHechizosConMapa(nombre, body) {
    abrirMinimapa(nombre, estadoUI.esAdmin, (nodo) => {
        // Cuando se selecciona un nodo en el mapa, hacer scroll+flash en el grimorio
        const af = (nodo.afinidad || '').toLowerCase();

        // Función helper para flashear una tarjeta
        const _flash = (cardEl) => {
            if (!cardEl) return;
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.style.outline = '2px solid rgba(212,175,55,0.8)';
            cardEl.style.background = 'rgba(212,175,55,0.08)';
            setTimeout(() => { cardEl.style.outline = ''; cardEl.style.background = ''; }, 1800);
        };

        // Abrir acordeón genérico si está cerrado
        const _abrirAcc = (acc) => {
            if (acc && !acc.classList.contains('open')) {
                acc.classList.add('open');
            }
        };

        // Buscar en grimorio completo (siempre, independientemente de si el PJ lo posee)
        const catCard = document.querySelector(
            `[data-cat-id="${nodo.id}"], [data-cat-nombre="${(nodo.nombre||'').toLowerCase()}"]`
        );
        if (catCard) {
            const accPadre = catCard.closest('.ppj-af-acc, .ppj-cat-acc');
            if (accPadre) _abrirAcc(accPadre);
            setTimeout(() => _flash(catCard), 80);
            return;
        }

        // Último recurso: abrir acordeón de la afinidad por nombre
        const acc = document.querySelector(`[data-cat-af="${af}"]`);
        if (acc) {
            _abrirAcc(acc);
            setTimeout(() => {
                const c2 = document.querySelector(`[data-cat-id="${nodo.id}"]`);
                if (c2) _flash(c2);
            }, 150);
        }
    });
    await _tabHechizos(nombre, body);
}

// ─────────────────────────────────────────────────────────────
// BARRAS SEGMENTADAS
// ─────────────────────────────────────────────────────────────
function _barraSegs(actual, max, tipo, maxCells = 26) {
    if (!max || max <= 0) return '';
    const n = Math.min(maxCells, max);
    const hpc = max / n;
    return `<div class="ppj-seg-bar">${Array.from({length:n},(_,i) =>
        `<span class="ppj-seg ${actual>hpc*i?'on':'off'}-${tipo}"></span>`).join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB: HEX
// ─────────────────────────────────────────────────────────────
async function _tabHex(nombre, body) {
    const p = personajes[nombre]; if (!p) { body.innerHTML = ''; return; }
    const safe = nombre.replace(/'/g, "\\'");
    const canEdit = estadoUI.esAdmin || !p.isPlayer;

    const { data: logs } = await supabase
        .from('hex_push_log')
        .select('id, tipo, cantidad, nota, created_at')
        .eq('personaje', nombre)
        .order('created_at', { ascending: false })
        .limit(30);

    const historial = logs || [];
    const _ultimoDe = (tipo) => historial.find(h => h.tipo === tipo);
    const _horasPasadas = (h) => h ? (Date.now() - new Date(h.created_at).getTime()) / 3600000 : Infinity;

    const cdA = _horasPasadas(_ultimoDe('asistencia'));
    const cdT = _horasPasadas(_ultimoDe('turno_extra'));
    const cdC = _horasPasadas(_ultimoDe('contenido'));

    const _cdRest = (pasadas, limite) => {
        if (pasadas >= limite) return '✓ Disponible';
        const s = Math.ceil((limite - pasadas) * 3600);
        return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
    };

    const _pushCard = (tipo, label, monto, disp, cdTxt) => `
        <div class="hex-pcard ${disp?'avail':''}">
            <div class="hex-pcard-label">${label}</div>
            <div class="hex-pcard-amt">${typeof monto==='string'?monto:('+'+monto.toLocaleString())}</div>
            <div class="hex-pcard-cd">${cdTxt}</div>
            ${estadoUI.esAdmin && tipo!=='contenido' ? `
                <button class="hex-pcard-btn" ${disp?'':'disabled'}
                    onclick="window._ppjEjecutarHexPush('${safe}','${tipo}',${monto})">Otorgar</button>` : ''}
            ${estadoUI.esAdmin && tipo==='contenido' ? `
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <input class="hex-pcard-input" id="ppj-cv-${_norm(nombre)}" type="number" value="500" min="100" max="1000" step="100">
                    <button class="hex-pcard-btn" ${disp?'':'disabled'}
                        onclick="window._ppjEjecutarHexPush('${safe}','contenido',parseInt(document.getElementById('ppj-cv-${_norm(nombre)}')?.value)||500)">OK</button>
                </div>` : ''}
        </div>`;
        </div>`;

    const _tCls = { asistencia:'hlog-asistencia', turno_extra:'hlog-turno_extra', contenido:'hlog-contenido' };
    const _tLbl = { asistencia:'Asistencia', turno_extra:'Turno extra', contenido:'Contenido' };

    const histHTML = historial.length===0
        ? `<div class="ppj-empty" style="padding:8px 0;font-size:0.72em;"><div style="font-size:1.4em;margin-bottom:6px;opacity:0.3;">📋</div>Sin registros</div>`
        : historial.map(h => `<div class="hlog-item">
            <span class="hlog-chip ${h.tipo||''}">${{asistencia:'Asistencia',turno_extra:'Turno extra',contenido:'Contenido'}[h.tipo]||h.tipo}</span>
            <span class="hlog-amt">+${h.cantidad.toLocaleString()}</span>
            <div style="flex:1;min-width:0;">
                <div class="hlog-time" title="${new Date(h.created_at).toUTCString()}">${_tiempoRelativo(h.created_at)}</div>
                ${h.nota?`<div class="hlog-nota">${h.nota}</div>`:''}
            </div>
            ${estadoUI.esAdmin?`<button class="hlog-del" onclick="window._ppjDeleteHexLog(${h.id},'${safe}')">✕</button>`:''}
        </div>`).join('');

    const deltas = [1000,500,300,100,50,10,5,1];
    const btnsN = deltas.map(d=>canEdit?`<button class="ppj-hex-btn neg" onclick="window.modStat('${safe}','hex',${-d})">−${d}</button>`:'').join('');
    const btnsP = deltas.map(d=>canEdit?`<button class="ppj-hex-btn" onclick="window.modStat('${safe}','hex',${d})">+${d}</button>`:'').join('');

    // ── VEX + Pushes (van en la col-main junto con HEX) ──────────
    const s = calcularStats(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';
    const pctVex = s.vex_max>0?Math.min(100,Math.round((p.vex_actual||0)/s.vex_max*100)):0;

    const _push = (recurso, label, emoji) => {
        const hasMax = recurso==='vex'?s.vex_max>0:s.guarda_max>0; if (!hasMax) return '';
        const disp   = calcularPushDisponibles(p, s, recurso);
        const usados = recurso==='vex'?(p.push_vex_actual||0):(p.push_guarda_actual||0);
        const rest   = Math.max(0, disp-usados);
        const val    = calcularValorPush(p, recurso);
        const cd     = calcularCooldownPush(p, recurso);
        const canPush= rest>0 && cd.disponible;
        const dots   = Array.from({length:Math.max(disp,1)},(_,i)=>
            `<span class="ppj-dot ${i<usados?'used':'avail'}"></span>`).join('');
        const cdTxt  = !cd.disponible
            ? `<div class="ppj-push-cd">⏳ ${Math.floor(cd.restaSeg/60)}m ${String(cd.restaSeg%60).padStart(2,'0')}s</div>` : '';
        return `<div class="ppj-push-block">
            <div class="ppj-push-header"><span class="ppj-push-label">${emoji} ${label}</span><div class="ppj-push-dots">${dots}</div><span style="font-size:0.68em;color:#4a4a68;">${usados}/${disp}</span></div>
            ${cdTxt}
            <div class="ppj-push-info"><span class="ppj-push-valor">+${val} por push</span>
                <button class="btn-push-pj" ${canPush?'':'disabled'} onclick="window.ejecutarPush('${safe}','${recurso}')">
                    ${!cd.disponible?'Cooldown':(rest>0?`Push ${label}`:'Sin pushes')}</button>
            </div>
            ${estadoUI.esAdmin?`<div style="display:flex;gap:6px;align-items:center;margin-top:6px;">
                <span style="font-size:0.62em;color:#3a3a58;">Extra OP</span>
                <button class="ppj-ctrl-btn" onclick="window.modPushExtra('${safe}','${recurso}',-1)">−</button>
                <span style="font-size:0.75em;color:#888;">${recurso==='vex'?(p.push_vex_limit||0):(p.push_guarda_limit||0)}</span>
                <button class="ppj-ctrl-btn" onclick="window.modPushExtra('${safe}','${recurso}',1)">+</button>
                <button class="ppj-ctrl-btn" onclick="window.resetPushes('${safe}','${recurso}')" style="margin-left:4px;">↺</button>
            </div>`:''}
        </div>`;
    };

    const vexHtml = s.vex_max>0?`
    <div class="ppj-section" style="padding:0;">
        <!-- VEX — mismo peso visual que HEX -->
        <div style="background:linear-gradient(135deg,rgba(154,80,220,0.08),rgba(80,0,140,0.12));border-bottom:1px solid rgba(154,80,220,0.15);padding:14px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-family:'Cinzel',serif;font-size:0.7em;letter-spacing:2px;color:#9a50dc;text-transform:uppercase;">⚡ VEX</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',-50)" style="border-color:rgba(154,80,220,0.3);">−50</button>`:''}
                    <span style="font-family:'Cinzel',serif;font-size:1.6em;color:#b070e8;letter-spacing:1px;">${Math.floor(p.vex_actual||0)}<span style="font-size:0.45em;color:#6a3a9a;margin-left:4px;">/ ${s.vex_max}</span></span>
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',50)" style="border-color:rgba(154,80,220,0.3);">+50</button>`:''}
                </div>
            </div>
            <div class="ppj-vex-bar" style="height:8px;border-radius:4px;"><div class="ppj-vex-fill" style="width:${pctVex}%;border-radius:4px;"></div></div>
            <div class="ppj-formula" style="margin-top:5px;">${esJugador?(formulas.vex_max?.expr||''):'Fijo (NPC sistema)'}</div>
        </div>
        <!-- Pushes VEX/Guarda -->
        <div style="padding:10px 16px;">
            <div style="font-size:0.6em;letter-spacing:1.5px;text-transform:uppercase;color:#3a3a58;font-weight:600;margin-bottom:8px;">Pushes</div>
            ${_push('vex','VEX','⚡')}${_push('guarda','Guarda','🛡')}
            ${!s.vex_max&&!s.guarda_max?'<div class="ppj-empty" style="padding:8px 0;">Sin pushes disponibles</div>':''}
        </div>
    </div>`:'';

    body.innerHTML = `
    <style>
        .hex-tab-root { font-family: 'Inter', sans-serif; color: #c8c0d8; }
        /* ── Header arcano ── */
        .hex-hero {
            position: relative; overflow: hidden;
            background: linear-gradient(180deg, #0d0a1a 0%, #080612 100%);
            padding: 28px 20px 20px; text-align: center;
            border-bottom: 1px solid rgba(212,175,55,0.18);
        }
        .hex-hero::before {
            content: ''; position: absolute; inset: 0;
            background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.07) 0%, transparent 70%);
            pointer-events: none;
        }
        /* Hexágono SVG centrado */
        .hex-svg-wrap { position: relative; display: inline-block; margin-bottom: 10px; }
        .hex-svg-wrap svg { display: block; }
        .hex-inner-val {
            position: absolute; inset: 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .hex-label {
            font-family: 'Cinzel', serif; font-size: 0.52em;
            letter-spacing: 3px; color: rgba(212,175,55,0.5);
            text-transform: uppercase; line-height: 1; margin-bottom: 2px;
        }
        .hex-amount {
            font-family: 'Cinzel', serif; font-size: 2em;
            color: #d4af37; letter-spacing: 2px; line-height: 1;
            text-shadow: 0 0 24px rgba(212,175,55,0.4);
        }
        /* Botones HEX */
        .hex-btns-wrap { padding: 0 16px 4px; }
        .hex-btns-row {
            display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; margin-bottom: 4px;
        }
        .hex-btn {
            background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.15);
            border-radius: 6px; color: #c9953a; font-size: 0.72em; font-weight: 700;
            padding: 7px 2px; cursor: pointer; transition: all 0.13s; font-family: inherit;
        }
        .hex-btn:hover { background: rgba(212,175,55,0.14); border-color: rgba(212,175,55,0.4); color: #d4af37; }
        .hex-btn.neg { color: #e06060; border-color: rgba(220,80,80,0.2); background: rgba(220,80,80,0.05); }
        .hex-btn.neg:hover { background: rgba(220,80,80,0.14); border-color: rgba(220,80,80,0.45); }

        /* ── VEX block ── */
        .vex-block {
            margin: 0; padding: 16px 20px 14px;
            background: linear-gradient(135deg, rgba(90,40,160,0.12) 0%, rgba(40,10,80,0.18) 100%);
            border-bottom: 1px solid rgba(130,60,220,0.18);
            position: relative;
        }
        .vex-block::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
            background: linear-gradient(180deg, rgba(154,80,220,0.8), rgba(80,20,140,0.3));
            border-radius: 0 2px 2px 0;
        }
        .vex-header {
            display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
        }
        .vex-title {
            font-family: 'Cinzel', serif; font-size: 0.65em;
            letter-spacing: 2px; color: #9a50dc; text-transform: uppercase;
            display: flex; align-items: center; gap: 5px;
        }
        .vex-title::before { content: '⚡'; font-size: 1.1em; }
        .vex-values {
            display: flex; align-items: baseline; gap: 4px;
        }
        .vex-current {
            font-family: 'Cinzel', serif; font-size: 1.8em; color: #b070e8; line-height: 1;
            text-shadow: 0 0 16px rgba(154,80,220,0.5);
        }
        .vex-sep { color: rgba(130,60,220,0.35); font-size: 1em; }
        .vex-max { font-size: 0.75em; color: #6a3a9a; font-family: 'Cinzel', serif; }
        .vex-ctrls { display: flex; gap: 5px; align-items: center; }
        .vex-ctrl-btn {
            background: rgba(154,80,220,0.1); border: 1px solid rgba(154,80,220,0.25);
            border-radius: 5px; color: #9a50dc; font-size: 0.7em; font-weight: 700;
            padding: 3px 8px; cursor: pointer; transition: all 0.12s; font-family: inherit;
        }
        .vex-ctrl-btn:hover { background: rgba(154,80,220,0.22); }
        .vex-bar-track {
            height: 6px; border-radius: 3px;
            background: rgba(154,80,220,0.1); overflow: hidden;
        }
        .vex-bar-fill {
            height: 100%; border-radius: 3px;
            background: linear-gradient(90deg, #6a20c0, #b070e8);
            box-shadow: 0 0 8px rgba(154,80,220,0.5);
            transition: width 0.4s ease;
        }
        .vex-formula { font-size: 0.58em; color: #3a2a58; margin-top: 5px; font-family: monospace; }

        /* ── Pushes VEX/Guarda ── */
        .pushes-block {
            padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .pushes-title {
            font-size: 0.58em; letter-spacing: 2px; text-transform: uppercase;
            color: #3a3a58; font-weight: 700; margin-bottom: 10px;
        }
        .push-card {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 12px; border-radius: 8px; margin-bottom: 6px;
            background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
            gap: 10px;
        }
        .push-card-left { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .push-card-name {
            font-size: 0.75em; font-weight: 600; color: #9090b0;
            display: flex; align-items: center; gap: 6px;
        }
        .push-dots { display: flex; gap: 3px; }
        .push-dot { width: 7px; height: 7px; border-radius: 50%; }
        .push-dot.used { background: #d4af37; box-shadow: 0 0 4px rgba(212,175,55,0.5); }
        .push-dot.avail { background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); }
        .push-card-sub { font-size: 0.65em; color: #4a4a68; }
        .push-card-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .push-count { font-size: 0.62em; color: #3a3a58; }
        .push-cd-txt { font-size: 0.65em; color: #e09040; }

        /* ── Pushes HEX ── */
        .hex-pushes-block {
            padding: 16px 20px;
            background: linear-gradient(180deg, rgba(212,175,55,0.03) 0%, transparent 100%);
            border-bottom: 1px solid rgba(212,175,55,0.1);
        }
        .hex-pushes-title {
            display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .hex-pushes-title-line {
            flex: 1; height: 1px; background: linear-gradient(90deg, rgba(212,175,55,0.3), transparent);
        }
        .hex-pushes-title-line.rev {
            background: linear-gradient(90deg, transparent, rgba(212,175,55,0.3));
        }
        .hex-pushes-title-txt {
            font-family: 'Cinzel', serif; font-size: 0.6em;
            letter-spacing: 2.5px; color: #d4af37; text-transform: uppercase;
        }
        .hex-push-cards {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
        }
        .hex-pcard {
            background: rgba(212,175,55,0.04); border: 1px solid rgba(212,175,55,0.18);
            border-radius: 10px; padding: 12px 8px; text-align: center;
            transition: all 0.15s; position: relative; overflow: hidden;
        }
        .hex-pcard.avail {
            border-color: rgba(212,175,55,0.4); background: rgba(212,175,55,0.08);
        }
        .hex-pcard.avail::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent);
        }
        .hex-pcard-label {
            font-size: 0.58em; color: #7a6a30; letter-spacing: 1px;
            text-transform: uppercase; font-weight: 700; margin-bottom: 6px;
        }
        .hex-pcard-amt {
            font-family: 'Cinzel', serif; font-size: 1.1em; color: #d4af37;
            font-weight: 700; margin-bottom: 4px;
            text-shadow: 0 0 12px rgba(212,175,55,0.3);
        }
        .hex-pcard-cd { font-size: 0.58em; color: #4a4a58; margin-bottom: 8px; min-height: 13px; }
        .hex-pcard-btn {
            width: 100%; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);
            border-radius: 6px; color: #d4af37; font-size: 0.68em; font-weight: 700;
            padding: 6px 4px; cursor: pointer; transition: all 0.15s; font-family: 'Cinzel', serif;
            letter-spacing: 0.5px;
        }
        .hex-pcard-btn:hover:not(:disabled) { background: rgba(212,175,55,0.25); border-color: rgba(212,175,55,0.6); }
        .hex-pcard-btn:disabled { opacity: 0.3; cursor: default; }
        .hex-pcard-input {
            width: 52px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px; color: #d4af37; font-size: 0.78em; padding: 3px 4px;
            font-weight: 700; text-align: center; font-family: 'Cinzel', serif; margin-bottom: 5px;
        }

        /* ── Historial ── */
        .hlog-block { padding: 14px 20px; }
        .hlog-title {
            font-size: 0.58em; letter-spacing: 2px; text-transform: uppercase;
            color: #3a3a58; font-weight: 700; margin-bottom: 10px;
        }
        .hlog-item {
            display: flex; align-items: center; gap: 8px; padding: 8px 10px;
            background: rgba(255,255,255,0.02); border-radius: 7px;
            border: 1px solid rgba(255,255,255,0.04); margin-bottom: 5px;
        }
        .hlog-chip {
            font-size: 0.6em; font-weight: 700; letter-spacing: 0.5px;
            padding: 2px 8px; border-radius: 10px; flex-shrink: 0;
        }
        .hlog-chip.asistencia { background:rgba(62,207,110,0.1);color:#3ecf6e;border:1px solid rgba(62,207,110,0.2); }
        .hlog-chip.turno_extra { background:rgba(74,179,232,0.1);color:#4ab3e8;border:1px solid rgba(74,179,232,0.2); }
        .hlog-chip.contenido { background:rgba(212,175,55,0.1);color:#d4af37;border:1px solid rgba(212,175,55,0.2); }
        .hlog-amt { font-family: 'Cinzel', serif; font-size: 0.9em; color: #d4af37; font-weight: 700; min-width: 44px; }
        .hlog-time { font-size: 0.64em; color: #3a3a58; flex: 1; }
        .hlog-nota { font-size: 0.66em; color: #5a5a78; }
        .hlog-del { background:none;border:none;color:#2e2e48;font-size:0.9em;cursor:pointer;padding:2px 5px;border-radius:3px;transition:color 0.15s; }
        .hlog-del:hover { color: #c44; }

        /* ── Imagen ── */
        .img-block { padding: 0 20px 20px; }
    </style>
    <div class="hex-tab-root">

    <!-- ═══ HEX HERO ═══ -->
    <div class="hex-hero">
        <div class="hex-svg-wrap">
            <svg width="160" height="140" viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="60,3 112,30 112,74 60,101 8,74 8,30" stroke="rgba(212,175,55,0.25)" stroke-width="1.5"/>
                <polygon points="60,15 100,37 100,67 60,89 20,67 20,37" stroke="rgba(212,175,55,0.1)" stroke-width="1"/>
                <polygon points="60,28 88,44 88,60 60,76 32,60 32,44" stroke="rgba(212,175,55,0.06)" stroke-width="1"/>
                <!-- rayos decorativos en las esquinas -->
                <line x1="60" y1="3" x2="60" y2="0" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>
                <line x1="112" y1="30" x2="115" y2="28" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>
                <line x1="112" y1="74" x2="115" y2="76" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>
            </svg>
            <div class="hex-inner-val">
                <span class="hex-label">Saldo HEX</span>
                <span class="hex-amount">${(p.hex||0).toLocaleString()}</span>
            </div>
        </div>
    </div>

    <!-- Botones +/- HEX -->
    ${canEdit?`<div class="hex-btns-wrap" style="padding-top:14px;">
        <div class="hex-btns-row">
            ${deltas.map(d=>`<button class="hex-btn neg" onclick="window.modStat('${safe}','hex',${-d})">−${d}</button>`).join('')}
        </div>
        <div class="hex-btns-row">
            ${deltas.map(d=>`<button class="hex-btn" onclick="window.modStat('${safe}','hex',${d})">+${d}</button>`).join('')}
        </div>
    </div>`:''}

    <!-- ═══ VEX ═══ -->
    ${s.vex_max>0?`<div class="vex-block">
        <div class="vex-header">
            <span class="vex-title">VEX</span>
            <div style="display:flex;align-items:center;gap:8px;">
                ${canEdit?`<button class="vex-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',-50)">−50</button>`:''}
                <div class="vex-values">
                    <span class="vex-current">${Math.floor(p.vex_actual||0)}</span>
                    <span class="vex-sep">/</span>
                    <span class="vex-max">${s.vex_max}</span>
                </div>
                ${canEdit?`<button class="vex-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',50)">+50</button>`:''}
            </div>
        </div>
        <div class="vex-bar-track"><div class="vex-bar-fill" style="width:${pctVex}%"></div></div>
        <div class="vex-formula">${esJugador?(formulas.vex_max?.expr||''):'Fijo (NPC sistema)'}</div>
    </div>`:''}

    <!-- ═══ PUSHES VEX / GUARDA ═══ -->
    ${(s.vex_max>0||s.guarda_max>0)?`<div class="pushes-block">
        <div class="pushes-title">Pushes</div>
        ${_push('vex','VEX','⚡')}
        ${_push('guarda','Guarda','🛡')}
    </div>`:''}

    <!-- ═══ PUSHES DE HEX ═══ -->
    ${estadoUI.esAdmin?`<div class="hex-pushes-block">
        <div class="hex-pushes-title">
            <div class="hex-pushes-title-line"></div>
            <span class="hex-pushes-title-txt">Pushes de HEX</span>
            <div class="hex-pushes-title-line rev"></div>
        </div>
        <div class="hex-push-cards">
            ${_pushCard('asistencia','Asistencia',300,cdA>=24,_cdRest(cdA,24)+' · diario')}
            ${_pushCard('turno_extra','Turno Extra',500,cdT>=72,_cdRest(cdT,72)+' · c/3 días')}
            ${_pushCard('contenido','Contenido','100–1000',cdC>=72,_cdRest(cdC,72)+' · c/3 días')}
        </div>
    </div>`:''}

    <!-- ═══ HISTORIAL ═══ -->
    <div class="hlog-block">
        <div class="hlog-title">Historial de pushes</div>
        ${histHTML}
    </div>

    <!-- ═══ IMAGEN ═══ -->
    ${(estadoUI.esAdmin||!p.isPlayer)?`<div class="img-block">
        <div class="ppj-img-wrap" onclick="window.abrirSubirImagen('${safe}')">
            <img class="ppj-img-preview" src="${_imgPj(p.iconoOverride||nombre)}"
                 onerror="this.onerror=null;this.src='${_fallback()}'">
            <div class="ppj-img-overlay">📷 Cambiar imagen</div>
        </div>
    </div>`:''}

    </div>`;
}


// ─────────────────────────────────────────────────────────────
// TAB: STATS
// ─────────────────────────────────────────────────────────────
function _tabStats(nombre) {
    const p = personajes[nombre]; if (!p) return '';
    const s = calcularStats(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';
    const canEdit   = estadoUI.esAdmin || !p.isPlayer;
    const safe = nombre.replace(/'/g, "\\'");
    const af = _getAfin(p);

    const _vida = (label, campo, actual, max, tipo, color, nSeg) => {
        const barra = _barraSegs(actual, max, tipo, nSeg);
        const esOver = actual > max;
        return `<div class="ppj-vida-block">
            <div class="ppj-vida-header">
                <span class="ppj-vida-label" style="color:${color};">${label}</span>
                <div class="ppj-vida-ctrl">
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','${campo}',-1)">−</button>`:''}
                    <span class="ppj-vida-xy"><span class="actual ${esOver?'val-over':''}" style="color:${color};">${actual}</span><span class="sep">/</span><span class="maximo">${max}</span></span>
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','${campo}',1)">+</button>`:''}
                </div>
            </div>${barra}</div>`;
    };

    const _maxOvAditivo = (label, campoOverride, override, formula, maxTotal) => {
        if (!estadoUI.esAdmin) return '';
        return `<div class="ppj-max-row">
            <span class="ppj-max-label">Máx ${label}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campoOverride}',-1)">−</button>
            <span class="ppj-max-val" title="Fórmula: ${formula}${override!==0?' + '+override+' manual':''}">${maxTotal}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campoOverride}',1)">+</button>
            ${override!==0?`<button class="ppj-ctrl-btn" onclick="window.resetStatMax('${safe}','${campoOverride}')">↺</button>`:''}
        </div>`;
    };

    const _push = (_recurso, _label, _emoji) => ''; // movido a _tabHex

    const AFINS = [
        {key:'fisica',label:'Física'},{key:'energetica',label:'Energética'},
        {key:'espiritual',label:'Espiritual'},{key:'mando',label:'Mando'},
        {key:'psiquica',label:'Psíquica'},{key:'oscura',label:'Oscura'}
    ];

    const afinRows = AFINS.map(a => {
        const base  = af.base?.[a.key]  || 0;
        const extra = af.extra?.[a.key] || 0;
        const alter = af.alter?.[a.key] || 0;
        const total = base + extra + alter;
        const cdVal = p[`cd_${a.key}`] ?? 0.5;
        return `<div class="ppj-afin-block">
            <div class="ppj-afin-header"><span class="ppj-afin-name">${a.label}</span><span class="ppj-afin-total">${total}</span></div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-b">B</span>
                ${estadoUI.esAdmin?`<button class="ppj-ctrl-btn" onclick="window.modAfin('${safe}','${a.key}',-1)">−</button>`:''}
                <span class="ppj-afin-val">${base}</span>
                ${estadoUI.esAdmin?`<button class="ppj-ctrl-btn" onclick="window.modAfin('${safe}','${a.key}',1)">+</button>`:''}
            </div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-ext">Ext</span>
                ${estadoUI.esAdmin?`<button class="ppj-ctrl-btn" onclick="window.modAfinExtra('${safe}','${a.key}',-1)">−</button>`:''}
                <span class="ppj-afin-val">${extra>=0?'+':''}${extra}</span>
                ${estadoUI.esAdmin?`<button class="ppj-ctrl-btn" onclick="window.modAfinExtra('${safe}','${a.key}',1)">+</button>`:''}
            </div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-alt">Alt</span>
                ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modAfinAlter('${safe}','${a.key}',-1)">−</button>`:''}
                <span class="ppj-afin-val">${alter>=0?'+':''}${alter}</span>
                ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modAfinAlter('${safe}','${a.key}',1)">+</button>`:''}
            </div>
            <div class="ppj-cd-row">
                <span class="ppj-cd-label">Cd · cooldown</span>
                ${estadoUI.esAdmin
                    ? `<button class="ppj-ctrl-btn" onclick="window._ppjSetCd('${safe}','${a.key}',-5)">−5%</button>
                       <span class="ppj-cd-val" id="ppj-cd-${safe}-${a.key}">${(cdVal*100).toFixed(0)}%</span>
                       <button class="ppj-ctrl-btn" onclick="window._ppjSetCd('${safe}','${a.key}',5)">+5%</button>`
                    : `<span class="ppj-cd-val">${(cdVal*100).toFixed(0)}%</span>`}
            </div>
        </div>`;
    }).join('');


    return `
    <div class="ppj-section">
        <div class="ppj-section-title">Recursos vitales</div>
        ${_vida('Vida Roja','vida_roja_actual',p.vida_roja_actual||0,s.vida_roja_max,'vida','#d4af37',26)}
        ${_maxOvAditivo('Vida Roja','vida_roja_max_override',s.vida_roja_max_override||0,s.vida_roja_max_formula,s.vida_roja_max)}
        <div class="ppj-formula">${formulas.vida_roja_max?.expr||''} ${s.vida_roja_max_override!==0?`<span style="color:#888;">+ ${s.vida_roja_max_override} manual</span>`:''}</div>

        ${s.vida_azul_total > 0 || s.vida_azul_base > 0 ? `
        <div class="ppj-vida-block">
            <div class="ppj-vida-header">
                <span class="ppj-vida-label" style="color:#4ab3e8;">Vida Azul</span>
                <div class="ppj-vida-ctrl">
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vida_azul_actual',-1)">−</button>`:''}
                    <span class="ppj-vida-xy">
                        <span class="actual" style="color:#4ab3e8;">${s.vida_azul_total}</span>
                        <span style="font-size:0.7em;color:#3a3a58;margin-left:4px;">(base ${s.vida_azul_base}${s.vida_azul_mod!==0?` ${s.vida_azul_mod>0?'+':''}${s.vida_azul_mod}`:''})
                        </span>
                    </span>
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vida_azul_actual',1)">+</button>`:''}
                </div>
            </div>
            <div style="font-size:0.6em;color:#3a3a58;padding:2px 0 4px;">Valor libre · no tiene techo</div>
        </div>
        <div class="ppj-formula">${formulas.vida_azul_max?.expr||''} <span style="color:#3a3a58;">(base)</span></div>
        ` : ''}

        ${s.guarda_max > 0 ? `
        ${_vida('Guarda Dorada','guarda_actual',p.guarda_actual||0,s.guarda_max,'guarda','#d4af37',20)}
        ${_maxOvAditivo('Guarda','guarda_max_override',s.guarda_max_override||0,s.guarda_max_formula,s.guarda_max)}
        <div class="ppj-formula">${formulas.guarda_max?.expr||''} ${s.guarda_max_override!==0?`<span style="color:#888;">+ ${s.guarda_max_override} manual</span>`:''}</div>
        ` : ''}

    </div>
    <div class="ppj-section"><div class="ppj-section-title">Afinidades</div>${afinRows}</div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB: HECHIZOS
// ─────────────────────────────────────────────────────────────
async function _tabHechizos(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando hechizos…</div>';

    const p = personajes[nombre]; if (!p) return;
    const esAdmin = estadoUI.esAdmin;
    const safe = nombre.replace(/'/g, "\\'");

    // ── Inventario del personaje ─────────────────────────────────
    const { data: invHz } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre, hechizo_afinidad, hechizo_hex, tipo, origen')
        .eq('personaje_nombre', nombre);

    const lista = (invHz || []).filter(h => (h.hechizo_afinidad || '').toLowerCase() !== 'hex');
    const invSet = new Set(lista.map(h => (h.hechizo_nombre || '').toLowerCase().trim()));

    const hNombres = lista.map(h => h.hechizo_nombre);
    let nodosMapInv = {};
    if (hNombres.length > 0) {
        const { data: nd } = await supabase.from('hechizos_nodos')
            .select('nombre, afinidad, clase, resumen, efecto, overcast, undercast, especial, hex_cost, es_conocido, hechizo_id, backcast, nextcast, es_estado, es_prioridad, afecta_hechizos, afecta_usuario, afecta_objetivo, valor_vex, nota')
            .in('nombre', hNombres);
        (nd||[]).forEach(n => { nodosMapInv[n.nombre] = n; });
    }

    // ── Catálogo completo ────────────────────────────────────────
    const { data: catalogo } = await supabase.from('hechizos_nodos')
        .select('id, nombre, hechizo_id, afinidad, clase, resumen, efecto, overcast, undercast, especial, hex_cost, es_conocido, backcast, nextcast, es_estado, es_prioridad, afecta_hechizos, afecta_usuario, afecta_objetivo, valor_vex, nota')
        .order('clase').order('nombre');

    // ── Strings (dependencias) ───────────────────────────────────
    const { data: allStrings } = await supabase.from('hechizos_strings').select('source_id, target_id');

    const _colAf = (af) => ({
        'Física':'#e2a673','Energética':'#f3e57a','Espiritual':'#7df0a7',
        'Mando':'#a4d3f2','Psíquica':'#dcb1f0','Oscura':'#ff526f',
        'Desconocida':'#888'
    })[af] || '#888';

    // ── Inyectar estilos ─────────────────────────────────────────
    if (!document.getElementById('ppj-hz-acc-styles')) {
        const s = document.createElement('style');
        s.id = 'ppj-hz-acc-styles';
        s.textContent = `
.ppj-hz-search{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#ccc;font-size:0.8em;padding:7px 10px;margin-bottom:10px;box-sizing:border-box;outline:none;}
.ppj-hz-search::placeholder{color:#3a3a58;}.ppj-hz-search:focus{border-color:rgba(212,175,55,0.3);}
.ppj-af-acc{margin-bottom:6px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);}
.ppj-af-acc-header{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;background:rgba(255,255,255,0.03);}
.ppj-af-acc-header:hover{background:rgba(255,255,255,0.05);}
.ppj-af-arrow{font-size:0.7em;color:#4a4a68;transition:transform 0.2s;display:inline-block;}
.ppj-af-acc.open .ppj-af-arrow{transform:rotate(90deg);}
.ppj-af-acc-title{font-size:0.78em;font-weight:600;flex:1;}
.ppj-af-acc-count{font-size:0.65em;color:#4a4a68;background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:10px;}
.ppj-af-acc-body{display:none;padding:0 8px 8px;}
.ppj-af-acc.open .ppj-af-acc-body{display:block;}
.ppj-cl-acc{margin-top:6px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.04);}
.ppj-cl-acc-header{display:flex;align-items:center;gap:6px;padding:7px 10px;cursor:pointer;user-select:none;background:rgba(255,255,255,0.02);}
.ppj-cl-acc-header:hover{background:rgba(255,255,255,0.04);}
.ppj-cl-arrow{font-size:0.62em;color:#4a4a68;transition:transform 0.2s;display:inline-block;}
.ppj-cl-acc.open .ppj-cl-arrow{transform:rotate(90deg);}
.ppj-cl-acc-title{font-size:0.68em;font-weight:600;color:#888;flex:1;}
.ppj-cl-acc-count{font-size:0.6em;color:#4a4a68;}
.ppj-cl-acc-body{display:none;padding:4px 0;}
.ppj-cl-acc.open .ppj-cl-acc-body{display:block;}
.ppj-hz-oculto-badge{font-size:0.58em;color:#4a4a68;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);padding:1px 6px;border-radius:10px;letter-spacing:0.5px;}
.ppj-hz-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;}
.ppj-hz-modal{background:linear-gradient(160deg,#110020,#07060e);border:1px solid rgba(212,175,55,0.25);border-radius:14px;padding:24px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;}
.ppj-hz-modal h3{font-family:Cinzel,serif;color:#d4af37;font-size:0.95em;margin:0 0 18px;letter-spacing:1px;}
.ppj-hz-modal label{font-size:0.7em;color:#5a5a78;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;margin-top:12px;}
.ppj-hz-modal input,.ppj-hz-modal textarea,.ppj-hz-modal select{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#ccc;padding:8px 10px;font-size:0.82em;box-sizing:border-box;outline:none;font-family:inherit;}
.ppj-hz-modal textarea{resize:vertical;min-height:60px;}
.ppj-hz-modal input:focus,.ppj-hz-modal textarea:focus,.ppj-hz-modal select:focus{border-color:rgba(212,175,55,0.4);}
.ppj-hz-modal-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ppj-hz-modal-footer{display:flex;gap:8px;margin-top:18px;justify-content:flex-end;}
.ppj-hz-modal-footer button{padding:8px 18px;border-radius:6px;font-size:0.8em;font-family:Cinzel,serif;cursor:pointer;border:1px solid;}
.ppj-hz-btn-save{background:rgba(212,175,55,0.15);color:#d4af37;border-color:rgba(212,175,55,0.4);}
.ppj-hz-btn-save:hover{background:rgba(212,175,55,0.3);}
.ppj-hz-btn-cancel{background:transparent;color:#5a5a78;border-color:rgba(255,255,255,0.1);}
.ppj-hz-strings-wrap{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;padding:8px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid rgba(255,255,255,0.06);min-height:36px;}
.ppj-hz-str-tag{font-size:0.7em;padding:3px 8px;border-radius:12px;background:rgba(212,175,55,0.12);color:#d4af37;border:1px solid rgba(212,175,55,0.25);cursor:pointer;display:flex;align-items:center;gap:4px;}
.ppj-hz-str-tag .rm{color:#ff526f;}
.ppj-hz-str-add{font-size:0.72em;color:#4a4a68;cursor:pointer;padding:3px 8px;border-radius:12px;border:1px dashed rgba(255,255,255,0.1);}
.ppj-hz-str-add:hover{color:#888;border-color:rgba(255,255,255,0.2);}
`;
        document.head.appendChild(s);
    }

    const _campo = (label, val) => {
        if (!val || val==='0' || val===0 || val==='EMPTY' || val==='null') return '';
        return `<div class="ppj-hz-field"><strong>${label}:</strong> ${val}</div>`;
    };

    // ── Sección 1: Aprendidos ────────────────────────────────────
    const grupos = {};
    lista.forEach(h => {
        const af = h.hechizo_afinidad || 'Sin afinidad';
        const nd = nodosMapInv[h.hechizo_nombre] || {};
        const cl = nd.clase ? String(nd.clase) : '?';
        if (!grupos[af]) grupos[af] = {};
        if (!grupos[af][cl]) grupos[af][cl] = [];
        grupos[af][cl].push(h);
    });

    const _hzCard = (h, color) => {
        const nd  = nodosMapInv[h.hechizo_nombre] || {};
        const cls = nd.clase ? `Clase ${nd.clase}` : '';
        const safeHzId = (nd.hechizo_id || '').replace(/'/g, "\\'");
        const editBtn = esAdmin && nd.hechizo_id
            ? `<button class="ppj-ctrl-btn" style="margin-left:auto;font-size:0.65em;" onclick="window._ppjAbrirEditorHz('${safeHzId}','${safe}','inv')">✏️</button>`
            : '';
        const hexInv   = h.hechizo_hex > 0 ? `<span class="ppj-hz-hex">⬡ ${h.hechizo_hex}</span>` : '';
        const vexInv   = nd.valor_vex  > 0 ? `<span class="ppj-hz-hex" style="color:#b060e8;border-color:rgba(150,80,220,0.35);">⬡ ${nd.valor_vex} VEX</span>` : '';
        const notaInv  = nd.nota ? `<span style="font-size:0.6em;color:#d4a830;margin-left:4px;">📌 ${nd.nota}</span>` : '';
        const clsBadge = cls ? `<span class="ppj-hz-clase">${cls}</span>` : '';
        const estadoBadge    = nd.es_estado    ? `<span class="ppj-hz-badge ppj-hz-badge-estado">⬛ Estado</span>` : '';
        const prioridadBadge = nd.es_prioridad ? `<span class="ppj-hz-badge ppj-hz-badge-prioridad">⚡ Prioridad</span>` : '';
        const castParts = [];
        if (nd.backcast > 0) castParts.push(`←${nd.backcast}`);
        if (nd.nextcast > 0) castParts.push(`→${nd.nextcast}`);
        const castBadge = castParts.length ? `<span class="ppj-hz-badge ppj-hz-badge-cast">⟳ ${castParts.join(' ')}</span>` : '';
        const afTargets = [nd.afecta_hechizos?'🌀':'', nd.afecta_usuario?'🧙':'', nd.afecta_objetivo?'🎯':''].filter(Boolean).join('');
        const afBadge  = afTargets ? `<span class="ppj-hz-badge ppj-hz-badge-afecta">${afTargets}</span>` : '';
        return `<div class="ppj-hz-card" data-hz-nombre="${(h.hechizo_nombre||'').toLowerCase()}"
            style="cursor:pointer;"
            onclick="if(window.centrarEnHechizo && '${safeHzId}') window.centrarEnHechizo('${safeHzId}')">
            <div class="ppj-hz-header">
                <span class="ppj-hz-nombre">${h.hechizo_nombre}</span>
                ${hexInv}${vexInv}${clsBadge}
                ${notaInv}
                ${editBtn}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">${estadoBadge}${prioridadBadge}${castBadge}${afBadge}</div>
            <div class="ppj-hz-fields">
                ${_campo('Efecto',nd.efecto)}${_campo('Resumen',nd.resumen)}
                ${_campo('Overcast',nd.overcast)}${_campo('Undercast',nd.undercast)}${_campo('Especial',nd.especial)}
            </div>
        </div>`;
    };

    let html = `<div class="ppj-section">
        <div class="ppj-section-title">
            Hechizos aprendidos${lista.length?' ('+lista.length+')':''}
        </div>
        <input class="ppj-hz-search" id="ppj-hz-buscador" placeholder="Buscar hechizo aprendido…" oninput="window._ppjBuscarHz(this.value)">
        ${esAdmin?`<button class="ppj-hz-new-btn ppj-hz-new-inv" onclick="window._ppjNuevoHechizoPj('${safe}')">
            <span class="ppj-hz-new-icon">✨</span>
            <div>
                <div class="ppj-hz-new-text-main">Nuevo hechizo para ${nombre}</div>
                <div class="ppj-hz-new-text-sub">Crea y asigna un hechizo directamente al personaje</div>
            </div>
        </button>`:''}
        <div id="ppj-hz-inv-list">`;

    if (lista.length === 0) {
        html += `<div class="ppj-empty"><div class="ppj-empty-icon">📖</div>Sin hechizos en el inventario</div>`;
    } else {
        Object.entries(grupos).forEach(([af, clases]) => {
            const color   = _colAf(af);
            const totalAf = Object.values(clases).reduce((s,a)=>s+a.length,0);
            html += `<div class="ppj-af-acc" data-af="${af.toLowerCase()}">
                <div class="ppj-af-acc-header" onclick="window._ppjToggleAcc(this.parentElement)">
                    <span class="ppj-af-arrow">▶</span>
                    <span class="ppj-af-acc-title" style="color:${color};">${af}</span>
                    <span class="ppj-af-acc-count">${totalAf}</span>
                </div>
                <div class="ppj-af-acc-body">`;
            const clasesOrdenadas = Object.entries(clases).sort(([a],[b]) => (parseInt(a)||999)-(parseInt(b)||999));
            clasesOrdenadas.forEach(([cl, hechizos]) => {
                if (clasesOrdenadas.length === 1) {
                    hechizos.forEach(h => { html += _hzCard(h, color); });
                } else {
                    const clLabel = cl === '?' ? 'Sin clase' : `Clase ${cl}`;
                    html += `<div class="ppj-cl-acc" data-clase="${cl}">
                        <div class="ppj-cl-acc-header" onclick="window._ppjToggleAcc(this.parentElement)">
                            <span class="ppj-cl-arrow">▶</span>
                            <span class="ppj-cl-acc-title">${clLabel}</span>
                            <span class="ppj-cl-acc-count">${hechizos.length}</span>
                        </div>
                        <div class="ppj-cl-acc-body">`;
                    hechizos.forEach(h => { html += _hzCard(h, color); });
                    html += `</div></div>`;
                }
            });
            html += `</div></div>`;
        });
    }
    html += `</div></div>`;

    // ── Sección 2: Grimorio ──────────────────────────────────────
    const catGrupos = {};
    (catalogo || []).forEach(n => {
        const af = n.afinidad || 'Sin afinidad';
        if (!catGrupos[af]) catGrupos[af] = [];
        catGrupos[af].push(n);
    });

    html += `<div class="ppj-section">
        <div class="ppj-section-title" style="display:flex;align-items:center;gap:8px;">
            📖 Grimorio completo
            <span style="font-size:0.85em;color:#3a3a58;font-weight:400;letter-spacing:0;">(${(catalogo||[]).length} hechizos)</span>
        </div>
        <input class="ppj-hz-search" id="ppj-cat-buscador" placeholder="Buscar en catálogo…" oninput="window._ppjBuscarCat(this.value)">
        ${esAdmin?`<button class="ppj-hz-new-btn ppj-hz-new-cat" onclick="window._ppjNuevoHechizoCat('${safe}')">
            <span class="ppj-hz-new-icon">➕</span>
            <div>
                <div class="ppj-hz-new-text-main">Nuevo hechizo en catálogo</div>
                <div class="ppj-hz-new-text-sub">Crea un nodo en el mapa sin asignarlo a nadie</div>
            </div>
        </button>`:''}
        <div id="ppj-cat-lista">`;

    Object.entries(catGrupos).forEach(([af, nodos]) => {
        const color = _colAf(af);
        html += `<div class="ppj-af-acc ppj-cat-acc" data-cat-af="${af.toLowerCase()}">
            <div class="ppj-af-acc-header" onclick="window._ppjToggleAcc(this.parentElement)">
                <span class="ppj-af-arrow">▶</span>
                <span class="ppj-af-acc-title" style="color:${color};">${af}</span>
                <span class="ppj-af-acc-count">${nodos.length}</span>
            </div>
            <div class="ppj-af-acc-body">`;

        nodos.forEach(n => {
            const isAssigned = invSet.has((n.nombre || '').toLowerCase().trim());
            const showFull   = n.es_conocido || esAdmin;
            const displayNombre = showFull ? n.nombre : n.hechizo_id;
            const safeHzId  = (n.hechizo_id || '').replace(/'/g, "\\'");
            const hexCost   = n.hex_cost || 0;
            const half      = Math.round(hexCost * 0.5);
            const doble     = hexCost * 2;

            const btnsDeasign = `<button class="ppj-cat-btn ppj-cat-deasign" onclick="window._ppjDeasignarHz('${safe}','${safeHzId}')">✕ Deasignar</button>`;
            const btnsAsign = `<button class="ppj-cat-btn ppj-cat-free" onclick="window._ppjAsignarHz('${safe}','${safeHzId}','gratis')">✅ Gratis</button>
                ${hexCost > 0 ? `<button class="ppj-cat-btn ppj-cat-half" onclick="window._ppjAsignarHz('${safe}','${safeHzId}','50')">🔵 −${half}</button>
                <button class="ppj-cat-btn ppj-cat-full" onclick="window._ppjAsignarHz('${safe}','${safeHzId}','100')">🟡 −${hexCost}</button>
                <button class="ppj-cat-btn ppj-cat-over" onclick="window._ppjAsignarHz('${safe}','${safeHzId}','200')">🔴 −${doble}</button>` : ''}`;

            // Badge oculto solo para admin
            const ocultoBadge = esAdmin && !n.es_conocido
                ? `<span class="ppj-hz-oculto-badge">oculto</span>` : '';

            // Toggle visibilidad pública (solo admin)
            const toggleKnown = esAdmin
                ? `<button class="ppj-ctrl-btn" style="font-size:0.62em;" title="${n.es_conocido?'Ocultar':'Publicar'}" onclick="window._ppjToggleConocido('${safeHzId}',${!n.es_conocido},'${safe}')">${n.es_conocido?'👁':'🔒'}</button>`
                : '';

            const editBtn = esAdmin
                ? `<button class="ppj-ctrl-btn" style="font-size:0.62em;" onclick="window._ppjAbrirEditorHz('${safeHzId}','${safe}','cat')">✏️</button>`
                : '';

            const hexBadgeCat = hexCost > 0 && showFull ? `<span class="ppj-hz-hex">⬡ ${hexCost}</span>` : '';
            const vexBadgeCat = n.valor_vex > 0 && showFull ? `<span class="ppj-hz-hex" style="color:#b060e8;border-color:rgba(150,80,220,0.35);">⬡ ${n.valor_vex} VEX</span>` : '';
            const notaBadgeCat = n.nota && showFull ? `<span style="font-size:0.6em;color:#d4a830;white-space:nowrap;">📌 ${n.nota}</span>` : '';
            const clsBadgeCat = showFull ? `<span class="ppj-hz-clase">Cl.${n.clase||'?'}</span>` : `<span class="ppj-hz-clase">?</span>`;
            const estadoBadgeCat    = showFull && n.es_estado    ? `<span class="ppj-hz-badge ppj-hz-badge-estado">⬛ Estado</span>` : '';
            const prioridadBadgeCat = showFull && n.es_prioridad ? `<span class="ppj-hz-badge ppj-hz-badge-prioridad">⚡ Prioridad</span>` : '';
            const castPartsCat = [];
            if (showFull && n.backcast > 0) castPartsCat.push(`←${n.backcast}`);
            if (showFull && n.nextcast > 0) castPartsCat.push(`→${n.nextcast}`);
            const castBadgeCat = castPartsCat.length ? `<span class="ppj-hz-badge ppj-hz-badge-cast">⟳ ${castPartsCat.join(' ')}</span>` : '';
            const afTargetsCat = showFull ? [n.afecta_hechizos?'🌀':'', n.afecta_usuario?'🧙':'', n.afecta_objetivo?'🎯':''].filter(Boolean).join('') : '';
            const afBadgeCat   = afTargetsCat ? `<span class="ppj-hz-badge ppj-hz-badge-afecta">${afTargetsCat}</span>` : '';
            html += `<div class="ppj-hz-card ppj-cat-card ${isAssigned?'ppj-cat-assigned':''}"
                         data-cat-nombre="${(n.nombre||'').toLowerCase()}"
                         data-cat-id="${n.hechizo_id||''}"
                         onclick="centrarEnHechizo('${(n.hechizo_id||'').replace(/'/g,"\\'")}')"
                         style="cursor:pointer;">
                <div class="ppj-hz-header">
                    <span class="ppj-hz-nombre ${!showFull?'ppj-hz-oculto':''}">${displayNombre}</span>
                    ${hexBadgeCat}${vexBadgeCat}${clsBadgeCat}
                    ${notaBadgeCat}
                    ${ocultoBadge}
                    ${isAssigned?`<span class="ppj-cat-assigned-tag">✓ Aprendido</span>`:''}
                    <span style="margin-left:auto;display:flex;gap:4px;">${editBtn}${toggleKnown}</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">${estadoBadgeCat}${prioridadBadgeCat}${castBadgeCat}${afBadgeCat}</div>
                ${showFull ? ('<div class="ppj-hz-fields">' +
                    (n.efecto    ? '<div class="ppj-hz-field"><strong>Efecto:</strong> '    + n.efecto    + '</div>' : '') +
                    (n.resumen   ? '<div class="ppj-hz-field"><strong>Resumen:</strong> '   + n.resumen   + '</div>' : '') +
                    (n.overcast  ? '<div class="ppj-hz-field"><strong>Overcast:</strong> '  + n.overcast  + '</div>' : '') +
                    (n.undercast ? '<div class="ppj-hz-field"><strong>Undercast:</strong> ' + n.undercast + '</div>' : '') +
                    (n.especial  ? '<div class="ppj-hz-field"><strong>Especial:</strong> '  + n.especial  + '</div>' : '') +
                    '</div>') : ''}
                ${esAdmin?`<div class="ppj-cat-actions">${isAssigned?btnsDeasign:btnsAsign}</div>`:''}
            </div>`;
        });
        html += `</div></div>`;
    });

    html += `</div></div>`;
    body.innerHTML = html;
    // Guardar datos para el editor
    body._catalogoHz = catalogo || [];
    body._stringsHz  = allStrings || [];
}

async function _cargarAprendibles(nombre, body, lista, nodosMap, _colAf) {
    try {
        const { data: todosNodos } = await supabase.from('hechizos_nodos')
            .select('hechizo_id, nombre, afinidad, clase, es_conocido');
        const { data: strings } = await supabase.from('hechizos_strings').select('source, target');
        const invSet = new Set(lista.map(h => h.hechizo_nombre?.toLowerCase().trim()));
        const reqs = {}; (strings||[]).forEach(r => { if(!reqs[r.target])reqs[r.target]=[]; reqs[r.target].push(r.source); });
        const nById = {}; (todosNodos||[]).forEach(n => { nById[n.hechizo_id] = n; });
        const aprendibles = (todosNodos||[]).filter(n => {
            if (invSet.has(n.nombre?.toLowerCase().trim())) return false;
            if (!n.es_conocido) return false;
            const rs = reqs[n.hechizo_id]||[];
            return rs.length>0 && rs.some(r => { const nr=nById[r]; return nr && invSet.has(nr.nombre?.toLowerCase().trim()); });
        });
        const loader = document.getElementById('ppj-apr-loader');
        if (!loader) return;
        if (aprendibles.length === 0) {
            loader.outerHTML = `<div class="ppj-empty" style="padding:8px 0;"><div class="ppj-empty-icon" style="font-size:1em;">🔒</div>Sin nuevos hechizos disponibles</div>`;
        } else {
            loader.outerHTML = aprendibles.map(n => {
                const c = _colAf(n.afinidad);
                return `<div class="ppj-hz-card"><div class="ppj-hz-header">
                    <span class="ppj-hz-af" style="background:${c}22;color:${c};">${(n.afinidad||'?').split(' ')[0]}</span>
                    <span class="ppj-hz-nombre">${n.nombre}</span>
                    <span class="ppj-hz-clase">Clase ${n.clase||'?'}</span>
                </div></div>`;
            }).join('');
        }
    } catch(e) { /* silencioso */ }
}

// ─────────────────────────────────────────────────────────────
// TAB: OBJETOS — split izq(catálogo) / der(inventario PJ)
// Mismo patrón que tab Hechizos con minimapa
// ─────────────────────────────────────────────────────────────

let _objState = {
    catalogo: [], inventario: [], contenidores: {},
    busqCat: '', busqInv: '', filtroRar: 'Todos', filtroTipo: 'Todos',
    nombrePJ: null,
    modoCrear: false,
    objEditando: null,
    expandedConts: new Set(),
    modoTransfer: false,
    modoImagenes: false,
    modoForja: false,
    forjaN: 4,
    imgSelObj: null, imgBusq: '',
    // Transfer en vivo
    transferDest: null,          // nombre del personaje destino
    transferInvDest: [],         // inventario del personaje destino
    transferContenedoresDest: {}, // contenidores del destino
    transferExpandedDest: new Set(),
};

function _cerrarPanelObjetos() {
    document.getElementById('ppj-obj-panel-izq')?.remove();
    document.getElementById('panel-pj-root')?.classList.remove('obj-mode');
}

async function _tabObjetos(nombre, body) {
    _objState.nombrePJ     = nombre;
    _objState.busqCat      = '';
    _objState.busqInv      = '';
    _objState.filtroRar    = 'Todos';
    _objState.filtroTipo   = 'Todos';
    _objState.modoCrear    = false;
    _objState.objEditando  = null;
    _objState.expandedConts= new Set();

    // Activar modo wide igual que hechizos
    document.getElementById('panel-pj-root')?.classList.add('obj-mode');

    // Inyectar panel izquierdo (catálogo) si no existe
    _cerrarPanelObjetos();
    const izq = document.createElement('div');
    izq.id = 'ppj-obj-panel-izq';
    document.getElementById('panel-pj-root').insertAdjacentElement('beforebegin', izq);

    // Inyectar estilos obj si no existen
    if (!document.getElementById('ppj-obj-styles')) {
        const s = document.createElement('style');
        s.id = 'ppj-obj-styles';
        s.textContent = `
#ppj-obj-panel-izq{position:fixed;left:0;top:0;bottom:0;width:calc(100vw - 50vw);max-width:calc(100vw - 480px);display:flex;flex-direction:column;background:rgba(5,0,12,0.97);border-right:1px solid rgba(212,175,55,0.15);z-index:1200;font-family:'Inter',system-ui,sans-serif;overflow:hidden;}
#panel-pj-root.obj-mode{width:50vw;min-width:480px;}
@media(max-width:900px){#ppj-obj-panel-izq{display:none;}}
.pobj-izq-header{flex-shrink:0;padding:10px 14px 8px;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.05);}
.pobj-izq-scroll{flex:1;overflow-y:auto;padding:6px 10px 80px;scrollbar-width:thin;scrollbar-color:rgba(212,175,55,0.2) transparent;}
.pobj-search-izq{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:#ccc;padding:6px 9px;font-size:0.76em;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:6px;}
.pobj-search-izq:focus{border-color:rgba(212,175,55,0.35);}
.pobj-search-izq::placeholder{color:#5a5a80;}
.pobj-filtros{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;}
.pobj-fbtn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#b0b0c8;border-radius:4px;padding:2px 7px;font-size:0.6em;cursor:pointer;font-family:inherit;transition:all 0.12s;}
.pobj-fbtn:hover{color:#d4d4e8;}
.pobj-fbtn.on{color:#d4af37;border-color:rgba(212,175,55,0.35);background:rgba(212,175,55,0.08);}
.pobj-cat-card{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,0.03);background:rgba(255,255,255,0.015);transition:background 0.1s;}
.pobj-cat-card:hover{background:rgba(255,255,255,0.035);}
.pobj-cat-card.en-inv{border-color:rgba(212,175,55,0.15);}
.pobj-cat-img{width:38px;height:38px;border-radius:4px;object-fit:cover;background:#111;flex-shrink:0;border:1px solid rgba(255,255,255,0.05);}
.pobj-cat-info{flex:1;min-width:0;}
.pobj-cat-nombre{font-size:0.78em;font-weight:700;color:#d0d0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pobj-cat-sub{font-size:0.62em;color:#9898b8;margin-top:1px;}
.pobj-cat-eff{font-size:0.64em;color:#a8a8c4;margin-top:2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.pobj-rar-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:3px;}
.pobj-op-label-sm{font-size:0.6em;letter-spacing:1.2px;text-transform:uppercase;color:#7878a0;font-weight:700;display:block;margin:10px 0 4px;}
.pobj-input-sm{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:5px;color:#ccc;padding:6px 8px;font-size:0.76em;box-sizing:border-box;outline:none;font-family:inherit;}
.pobj-input-sm:focus{border-color:rgba(212,175,55,0.35);}
textarea.pobj-input-sm{resize:vertical;min-height:50px;}
select.pobj-input-sm{cursor:pointer;}
.pobj-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.pobj-btn-crear{width:100%;background:rgba(62,207,110,0.1);border:1px solid rgba(62,207,110,0.3);color:#3ecf6e;border-radius:5px;padding:7px;font-size:0.72em;cursor:pointer;font-family:'Cinzel',serif;letter-spacing:0.5px;transition:all 0.12s;margin-top:6px;}
.pobj-btn-crear:hover{background:rgba(62,207,110,0.22);}
.pobj-btn-gold{background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#d4af37;border-radius:5px;padding:5px 10px;font-size:0.7em;cursor:pointer;font-family:inherit;transition:all 0.12s;}
.pobj-btn-gold:hover{background:rgba(212,175,55,0.2);}
.pobj-btn-danger{background:rgba(220,60,60,0.08);border:1px solid rgba(220,60,60,0.25);color:#ff6060;border-radius:5px;padding:5px 10px;font-size:0.7em;cursor:pointer;font-family:inherit;transition:all 0.12s;}
.pobj-btn-danger:hover{background:rgba(220,60,60,0.18);}
.pobj-section-title{font-size:0.6em;letter-spacing:1.5px;text-transform:uppercase;color:#7878a0;font-weight:700;margin:10px 0 5px;}
.pobj-transfer-row{display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:5px;margin-bottom:3px;font-size:0.72em;cursor:pointer;transition:background 0.1s;}
.pobj-transfer-row:hover{background:rgba(255,255,255,0.05);}
.pobj-transfer-row.sel{border-color:rgba(212,175,55,0.35);background:rgba(212,175,55,0.06);color:#d4af37;}
.pobj-cat-card[draggable="true"]{cursor:grab;}.pobj-cat-card[draggable="true"]:active{cursor:grabbing;}
.pobj-drop-over,.ppj-obj-card.pobj-drop-over{outline:1px dashed rgba(212,175,55,0.5)!important;background:rgba(212,175,55,0.05)!important;}
        `;
        document.head.appendChild(s);
    }

    body.innerHTML = '<div class="ppj-loader">Cargando objetos…</div>';

    // Cargar datos
    const [catRes, invRes] = await Promise.all([
        supabase.from('objetos').select('nombre,tipo,material,efecto,rareza,vida_roja,vida_azul').eq('es_propuesta', false).order('nombre'),
        supabase.from('inventario_objetos').select('id,objeto_nombre,cantidad,equipado,contenedor_padre').eq('personaje_nombre', nombre).gt('cantidad', 0),
    ]);

    _objState.catalogo   = catRes.data || [];
    _objState.inventario = invRes.data || [];

    // Mapa contenedor → hijos
    _objState.contenidores = {};
    _objState.inventario.forEach(i => {
        if (i.contenedor_padre) {
            if (!_objState.contenidores[i.contenedor_padre]) _objState.contenidores[i.contenedor_padre] = [];
            _objState.contenidores[i.contenedor_padre].push(i.objeto_nombre);
        }
    });

    _renderObjIzq();
    _renderObjDer(nombre, body);

    // Limpiar al cambiar tab
    window._ppjObjLimpiar = _cerrarPanelObjetos;
}

// ── PANEL IZQUIERDO: catálogo + funciones OP ─────────────────
function _renderObjIzq() {
    const izq = document.getElementById('ppj-obj-panel-izq');
    if (!izq) return;

    const esAdmin  = estadoUI.esAdmin;
    // Filtros en orden: primero tipos, luego rareza
    const TIPOS_FIJO = ['Todos','Consumible','Herramienta','Accesorio','Equipo','Contenedor','Vehículo'];
    const tiposExtra = [...new Set(_objState.catalogo.map(o=>o.tipo).filter(t=>t&&t!=='-'&&!TIPOS_FIJO.includes(t)))].sort();
    const TIPOS_FILTRO = [...TIPOS_FIJO, ...tiposExtra];
    const RAREZAS  = ['Todos','Común','Raro','Legendario'];
    const RAR_COL  = {'Legendario':'#d4af37','Raro':'#9a50dc','Común':'#5a5a88','-':'#3a3a58'};
    const _imgObj  = (n) => { try{return `${currentConfig.storageUrl}/imgobjetos/${n.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}.png`;}catch{return '';} };
    const _fall    = () => { try{return `${currentConfig.storageUrl}/imginterfaz/no_encontrado.png`;}catch{return '';} };

    const q        = _objState.busqCat.toLowerCase().trim();
    const invSet   = new Set(_objState.inventario.map(i=>i.objeto_nombre));

    const lista = _objState.catalogo.filter(o => {
        if (_objState.filtroRar  !== 'Todos' && o.rareza !== _objState.filtroRar) return false;
        if (_objState.filtroTipo !== 'Todos' && o.tipo   !== _objState.filtroTipo) return false;
        if (q && !o.nombre.toLowerCase().includes(q) && !(o.efecto||'').toLowerCase().includes(q)) return false;
        return true;
    });

    let seccionIzq = 'catalogo';
    if (_objState.modoCrear)     seccionIzq = 'crear';
    if (_objState.objEditando)   seccionIzq = 'editar';
    if (_objState.modoTransfer)  seccionIzq = 'transfer';
    if (_objState.modoImagenes)  seccionIzq = 'imagenes';
    if (_objState.modoForja)     seccionIzq = 'forja';

    const btnVolver = `<button class="pobj-btn-gold" onclick="window._pobjVolverCatalogo()" style="margin-bottom:8px;">← Catálogo</button>`;

    let contenidoScroll = '';

    if (seccionIzq === 'crear' || seccionIzq === 'editar') {
        const obj     = seccionIzq === 'editar' ? _objState.catalogo.find(o=>o.nombre===_objState.objEditando) : null;
        const esNuevo = seccionIzq === 'crear';
        // Sin Equipamiento (duplicado), sin Vehículo como tipo editable aquí, sin contenedor padre
        const TIPOS   = ['Consumible','Herramienta','Accesorio','Equipo','Contenedor','Vehículo','-'];
        const MATS    = ['Cristal','Metal','Orgánico','Sagrado','-'];
        const RARS    = ['Común','Raro','Legendario','-'];

        contenidoScroll = `${btnVolver}
        <div class="pobj-section-title">${esNuevo?'Nuevo objeto':'Editar: '+_objState.objEditando}</div>
        <label class="pobj-op-label-sm">Nombre *</label>
        <input id="pobj-f-nombre" class="pobj-input-sm" value="${(obj?.nombre||'').replace(/"/g,'&quot;')}" placeholder="Nombre único" ${!esNuevo?'readonly style="opacity:0.5"':''}>
        <div class="pobj-grid2" style="margin-top:6px;">
            <div><label class="pobj-op-label-sm">Tipo</label>
            <select id="pobj-f-tipo" class="pobj-input-sm">${TIPOS.map(t=>`<option value="${t}" ${(obj?.tipo||'-')===t?'selected':''}>${t}</option>`).join('')}</select></div>
            <div><label class="pobj-op-label-sm">Material</label>
            <select id="pobj-f-mat" class="pobj-input-sm">${MATS.map(m=>`<option value="${m}" ${(obj?.material||'-')===m?'selected':''}>${m}</option>`).join('')}</select></div>
        </div>
        <div class="pobj-grid2" style="margin-top:4px;">
            <div><label class="pobj-op-label-sm">Rareza</label>
            <select id="pobj-f-rar" class="pobj-input-sm">${RARS.map(r=>`<option value="${r}" ${(obj?.rareza||'Común')===r?'selected':''}>${r}</option>`).join('')}</select></div>
            <div><label class="pobj-op-label-sm">Vida Roja + / Azul +</label>
            <div style="display:flex;gap:4px;"><input id="pobj-f-vr" type="number" class="pobj-input-sm" value="${obj?.vida_roja||0}" min="0" placeholder="VR"><input id="pobj-f-va" type="number" class="pobj-input-sm" value="${obj?.vida_azul||0}" min="0" placeholder="VA"></div></div>
        </div>
        <label class="pobj-op-label-sm" style="margin-top:6px;">Efecto / Descripción</label>
        <textarea id="pobj-f-eff" class="pobj-input-sm">${obj?.efecto||''}</textarea>
        ${esNuevo ? `<label class="pobj-op-label-sm" style="margin-top:8px;">Dar al personaje actual</label>
        <input id="pobj-f-cant-pj" type="number" class="pobj-input-sm" value="0" min="0">` : ''}
        <div style="display:flex;gap:6px;margin-top:10px;">
            <button class="pobj-btn-crear" onclick="window._pobjGuardarObjeto(${!esNuevo?`'${(_objState.objEditando||'').replace(/'/g,"\\'")}'`:'null'})">${esNuevo?'✨ Crear':'💾 Guardar'}</button>
            ${!esNuevo?`<button class="pobj-btn-danger" onclick="window._pobjEliminarObjeto('${(_objState.objEditando||'').replace(/'/g,"\\'")}')">🗑</button>`:''}
        </div>`;

    } else if (seccionIzq === 'forja') {
        // Forja múltiple: grid compacto, N configurable
        const N = _objState.forjaN || 4;
        const TIPOS_F = ['Consumible','Herramienta','Accesorio','Equipo','Contenedor','Vehículo','-'];
        const RARS_F  = ['Común','Raro','Legendario'];

        const miniCards = Array.from({length:N}, (_,i) => `
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:5px;">
                <div style="font-size:0.6em;color:#d4af37;font-family:'Cinzel',serif;letter-spacing:0.5px;">Objeto ${i+1}</div>
                <input id="pm-nombre-${i}" class="pobj-input-sm" placeholder="Nombre…" style="font-size:0.72em;">
                <div style="display:flex;gap:4px;">
                    <select id="pm-tipo-${i}" class="pobj-input-sm" style="flex:1;font-size:0.68em;">${TIPOS_F.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
                    <select id="pm-rar-${i}" class="pobj-input-sm" style="flex:1;font-size:0.68em;">${RARS_F.map(r=>`<option value="${r}">${r}</option>`).join('')}</select>
                </div>
                <input id="pm-eff-${i}" class="pobj-input-sm" placeholder="Efecto…" style="font-size:0.68em;">
                <div style="display:flex;gap:4px;align-items:center;">
                    <span style="font-size:0.6em;color:#888;flex-shrink:0;">❤</span>
                    <input id="pm-vr-${i}" class="pobj-input-sm" type="number" value="0" min="0" placeholder="Vida R" style="flex:1;font-size:0.68em;">
                    <span style="font-size:0.6em;color:#4ab3e8;flex-shrink:0;">💙</span>
                    <input id="pm-va-${i}" class="pobj-input-sm" type="number" value="0" min="0" placeholder="Vida A" style="flex:1;font-size:0.68em;">
                    <span style="font-size:0.6em;color:#d4af37;flex-shrink:0;">×</span>
                    <input id="pm-cant-${i}" class="pobj-input-sm" type="number" value="1" min="0" placeholder="Cant" style="flex:1;font-size:0.68em;" title="Cantidad a dar al personaje seleccionado">
                </div>
            </div>`).join('');

        contenidoScroll = `${btnVolver}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div class="pobj-section-title" style="margin:0;">Forja múltiple</div>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:0.65em;color:#555;">Cantidad:</span>
                ${[2,4,6,8].map(n=>`<button class="pobj-fbtn ${N===n?'on':''}" onclick="window._pobjForjaSetN(${n})">${n}</button>`).join('')}
            </div>
        </div>
        <label class="pobj-op-label-sm">Dar todos a (opcional)</label>
        <select id="pm-dest" class="pobj-input-sm" style="margin-bottom:8px;">
            <option value="">— Solo catálogo —</option>
            ${Object.keys(personajes).sort().map(p=>`<option value="${p.replace(/"/g,'&quot;')}">${p}</option>`).join('')}
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">${miniCards}</div>
        <button class="pobj-btn-crear" onclick="window._pobjEjecutarForja()">⚒️ Forjar todos</button>`;

    } else if (seccionIzq === 'transfer') {
        const personajesDisp = Object.keys(personajes).filter(p => p !== _objState.nombrePJ).sort();
        const selDest = _objState.transferDest || '';

        if (!selDest) {
            // ── Selector de personaje: grid con imagen ──
            const _imgPjT = (nombre) => {
                const p = personajes[nombre];
                const icono = p?.iconoOverride || nombre;
                return `${currentConfig.storageUrl}/imgpersonajes/${icono.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}icon.png`;
            };
            const jugadores = personajesDisp.filter(p => personajes[p]?.isPlayer);
            const npcs      = personajesDisp.filter(p => !personajes[p]?.isPlayer);

            const renderGrid = (lista) => lista.map(p => {
                const safe = p.replace(/'/g,"\'");
                return `<div onclick="window._pobjIniciarTransfer('${safe}')"
                    style="cursor:pointer;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:7px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:all 0.15s;"
                    onmouseover="this.style.borderColor='rgba(212,175,55,0.35)';this.style.background='rgba(212,175,55,0.06)'"
                    onmouseout="this.style.borderColor='rgba(255,255,255,0.07)';this.style.background='rgba(255,255,255,0.03)'">
                    <img src="${_imgPjT(p)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:#111;border:2px solid rgba(255,255,255,0.08);">
                    <span style="font-size:0.62em;color:#d0d0e0;text-align:center;line-height:1.2;word-break:break-word;max-width:70px;">${p}</span>
                </div>`;
            }).join('');

            contenidoScroll = `${btnVolver}
            <div style="font-size:0.72em;color:#d4af37;font-weight:700;letter-spacing:0.5px;margin-bottom:10px;">Transferir objetos</div>
            <input class="pobj-search-izq" placeholder="Buscar personaje…" oninput="window._pobjFiltrarDestTransfer(this.value)" style="margin-bottom:8px;">
            <div id="pobj-dest-grid">
            ${jugadores.length ? `<div style="font-size:0.58em;color:#7878a0;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Jugadores</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px;margin-bottom:10px;">${renderGrid(jugadores)}</div>` : ''}
            ${npcs.length ? `<div style="font-size:0.58em;color:#7878a0;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">NPCs</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px;">${renderGrid(npcs)}</div>` : ''}
            </div>`;
        } else {
            // ── Inventario del destino en panel izquierdo ──
            const destInv      = _objState.transferInvDest;
            const destExpanded = _objState.transferExpandedDest;
            const pDest        = personajes[selDest] || {};
            const _imgPjT2 = (nombre) => {
                const p = personajes[nombre]; const icono = p?.iconoOverride || nombre;
                return `${currentConfig.storageUrl}/imgpersonajes/${icono.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}icon.png`;
            };

            const _renderSlotDest = (slot) => {
                const cat  = _objState.catalogo.find(o=>o.nombre===slot.objeto_nombre)||{};
                const esContenedor = (cat.tipo||'-') === 'Contenedor';
                const safe = slot.objeto_nombre.replace(/'/g,"\'");
                const hijosSlots = destInv.filter(i => i.contenedor_padre === slot.objeto_nombre);
                const expanded   = destExpanded.has(slot.objeto_nombre);

                let html = `<div class="ppj-obj-card" style="margin-bottom:3px;"
                    draggable="true"
                    ondragstart="window._pobjTransferDragStart(event,${slot.id},'${safe}','dest')"
                    ondragend="event.target.style.opacity=''">
                    <div class="ppj-obj-header" style="gap:5px;">
                        <img src="${_imgObj(slot.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:28px;height:28px;border-radius:3px;object-fit:cover;background:#111;flex-shrink:0;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.74em;font-weight:600;color:#d0d0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.objeto_nombre}</div>
                            ${cat.efecto?`<div style="font-size:0.58em;color:#8888a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat.efecto}</div>`:''}
                        </div>
                        <span style="font-size:0.8em;font-weight:700;color:#d4af37;flex-shrink:0;">x${slot.cantidad}</span>
                        ${esContenedor?`<button class="ppj-ctrl-btn" style="font-size:0.6em;padding:0 4px;" onclick="window._pobjTransferToggleCont('${safe}')">${expanded?'▲':'▼'}</button>`:''}
                    </div>
                </div>`;

                if (esContenedor && expanded && hijosSlots.length > 0) {
                    html += `<div style="padding-left:10px;border-left:2px solid rgba(100,150,255,0.2);margin-bottom:3px;"
                        ondragover="event.preventDefault();event.stopPropagation();this.style.borderLeftColor='#d4af37';"
                        ondragleave="this.style.borderLeftColor='rgba(100,150,255,0.2)';"
                        ondrop="window._pobjTransferDropEnContenedor(event,'dest','${safe}');this.style.borderLeftColor='rgba(100,150,255,0.2)';">`;
                    html += hijosSlots.map(h => {
                        const hSafe = h.objeto_nombre.replace(/'/g,"\'");
                        const hCat  = _objState.catalogo.find(o=>o.nombre===h.objeto_nombre)||{};
                        return `<div class="ppj-obj-card" style="margin-bottom:2px;" draggable="true"
                            ondragstart="window._pobjTransferDragStart(event,${h.id},'${hSafe}','dest')"
                            ondragend="event.target.style.opacity=''">
                            <div class="ppj-obj-header" style="gap:5px;">
                                <img src="${_imgObj(h.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:24px;height:24px;border-radius:3px;object-fit:cover;background:#111;flex-shrink:0;">
                                <div style="flex:1;min-width:0;font-size:0.72em;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.objeto_nombre}</div>
                                <span style="font-size:0.75em;color:#d4af37;font-weight:700;">x${h.cantidad}</span>
                            </div>
                        </div>`;
                    }).join('');
                    html += `</div>`;
                }
                return html;
            };

            const destRaiz = destInv.filter(i => !i.contenedor_padre);

            contenidoScroll = `${btnVolver}
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                <img src="${_imgPjT2(selDest)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:32px;height:32px;border-radius:50%;object-fit:cover;background:#111;flex-shrink:0;border:2px solid rgba(212,175,55,0.3);">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.78em;font-weight:700;color:#d4af37;">${selDest}</div>
                    <div style="font-size:0.6em;color:#7878a0;">${pDest.isPlayer?'Jugador':'NPC'} · ${destRaiz.length} objeto${destRaiz.length!==1?'s':''}</div>
                </div>
                <button class="pobj-fbtn" onclick="window._pobjCambiarDestinoTransfer()" style="font-size:0.6em;flex-shrink:0;">Cambiar</button>
            </div>
            <div style="font-size:0.6em;color:#5a5a78;margin-bottom:8px;text-align:center;">← Arrastra aquí desde ${_objState.nombrePJ} · Arrastra al panel derecho para enviar →</div>
            <div id="ppj-transfer-dest-drop" style="min-height:80px;padding:4px;border-radius:5px;border:1px dashed rgba(255,255,255,0.08);transition:border-color 0.15s;"
                ondragover="event.preventDefault();event.stopPropagation();this.style.borderColor='rgba(212,175,55,0.4)';"
                ondragleave="this.style.borderColor='rgba(255,255,255,0.08)';"
                ondrop="window._pobjTransferDrop(event,'dest',null);this.style.borderColor='rgba(255,255,255,0.08)';">
                ${destRaiz.length===0?`<div style="font-size:0.62em;color:#3a3a58;padding:16px;text-align:center;">Inventario vacío</div>`:''}
                ${destRaiz.map(_renderSlotDest).join('')}
            </div>`;
        }

    } else if (seccionIzq === 'imagenes') {
        const selImg   = _objState.imgSelObj || '';
        const filt     = (_objState.imgBusq||'').toLowerCase();
        const listaImg = _objState.catalogo.filter(o=>!filt||o.nombre.toLowerCase().includes(filt));

        contenidoScroll = `${btnVolver}
        <div class="pobj-section-title">Subir imagen de objeto</div>
        <input class="pobj-search-izq" placeholder="Buscar objeto…" value="${_objState.imgBusq||''}" oninput="window._pobjImgBuscar(this.value)">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px;">
            ${listaImg.map(o=>`<div onclick="window._pobjImgSeleccionar('${o.nombre.replace(/'/g,"\\'")}')"
                style="cursor:pointer;border-radius:5px;overflow:hidden;border:2px solid ${selImg===o.nombre?'#d4af37':'transparent'};transition:all 0.12s;">
                <img src="${_imgObj(o.nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:100%;height:48px;object-fit:cover;display:block;background:#111;">
                <div style="font-size:0.55em;color:#555;padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.nombre}</div>
            </div>`).join('')}
        </div>
        ${selImg ? `
        <div style="padding:10px;background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.18);border-radius:6px;">
            <div style="font-size:0.75em;color:#d4af37;font-weight:700;margin-bottom:6px;">📍 ${selImg}</div>
            <div id="pobj-img-drop-zone" style="border:2px dashed rgba(212,175,55,0.25);border-radius:6px;padding:20px;text-align:center;color:#3a3a58;font-size:0.72em;cursor:pointer;transition:all 0.12s;"
                onclick="document.getElementById('pobj-img-file').click()"
                ondragover="event.preventDefault();this.style.borderColor='#d4af37';this.style.color='#d4af37';"
                ondragleave="this.style.borderColor='rgba(212,175,55,0.25)';this.style.color='#3a3a58';"
                ondrop="window._pobjImgDrop(event)">
                🖼️ Clic o arrastra imagen aquí
            </div>
            <input type="file" id="pobj-img-file" accept="image/*" style="display:none" onchange="window._pobjImgSubir(this.files[0])">
            <div id="pobj-img-status" style="font-size:0.68em;margin-top:6px;color:#555;"></div>
        </div>` : `<div class="ppj-empty" style="padding:16px 0;font-size:0.7em;">← Selecciona un objeto para subir su imagen</div>`}`;

    } else {
        // ── Catálogo normal ──
        const btnNuevo  = esAdmin ? `<button class="pobj-btn-gold" onclick="window._pobjAbrirCrear()" style="flex:1;">✨ Nuevo</button>` : '';
        const btnForja  = esAdmin ? `<button class="pobj-btn-gold" onclick="window._pobjAbrirForja()" style="flex:1;">⚒️ Forja</button>` : '';
        const btnTransf = esAdmin ? `<button class="pobj-btn-gold" onclick="window._pobjAbrirTransfer()" style="flex:1;">⇄ Mover</button>` : '';
        const btnImg    = `<button class="pobj-btn-gold" onclick="window._pobjAbrirImagenes()" style="flex:1;">🖼️ Imgs</button>`;

        const listaHTML = lista.length === 0
            ? `<div class="ppj-empty" style="padding:20px 0;font-size:0.72em;">Sin resultados</div>`
            : lista.map(o => {
                const enInv  = invSet.has(o.nombre);
                const oSafe  = o.nombre.replace(/'/g,"\\'");
                const rc     = RAR_COL[o.rareza]||'#888';
                const hijos  = (_objState.contenidores[o.nombre]||[]).length;
                const addBtn = esAdmin
                    ? `<button class="pobj-btn-gold" style="padding:2px 7px;font-size:0.6em;flex-shrink:0;" onclick="window._pobjDarAlPJ('${oSafe}',1)">${enInv?'+1':'Dar'}</button>` : '';
                const editBtn= esAdmin
                    ? `<button class="pobj-fbtn" style="padding:2px 6px;" onclick="window._pobjAbrirEditar('${oSafe}')">✏️</button>` : '';

                // Card arrastrable al inventario
                return `<div class="pobj-cat-card ${enInv?'en-inv':''}" 
                    draggable="${esAdmin?'true':'false'}"
                    ondragstart="window._pobjDragStart(event,'${oSafe}')"
                    ondragend="event.target.style.opacity=''">
                    <img class="pobj-cat-img" src="${_imgObj(o.nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" loading="lazy">
                    <div class="pobj-cat-info">
                        <div class="pobj-cat-nombre">${o.nombre}${hijos>0?`<span style="color:#6496ff;font-size:0.7em;margin-left:4px;">📦${hijos}</span>`:''}</div>
                        <div class="pobj-cat-sub">${o.tipo||'-'} · ${o.material||'-'} · <span style="color:${rc}">${o.rareza||'-'}</span></div>
                        <div class="pobj-cat-eff">${o.efecto||''}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;">${addBtn}${editBtn}</div>
                </div>`;
            }).join('');

        contenidoScroll = `
        <div style="display:flex;gap:4px;margin-bottom:6px;">${btnNuevo}${btnForja}${btnTransf}${btnImg}</div>
        <input class="pobj-search-izq" placeholder="Buscar en catálogo…" value="${_objState.busqCat}" oninput="window._pobjBusqCat(this.value)">
        <div class="pobj-filtros">
            ${TIPOS_FILTRO.map(t=>`<button class="pobj-fbtn ${_objState.filtroTipo===t?'on':''}" onclick="window._pobjFiltroTipo('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('')}
            <span style="color:#2e2e48;font-size:0.6em;align-self:center;">·</span>
            ${RAREZAS.map(r=>`<button class="pobj-fbtn ${_objState.filtroRar===r?'on':''}" onclick="window._pobjFiltroRar('${r}')">${r}</button>`).join('')}
        </div>
        ${esAdmin ? `<div id="pobj-cat-dropzone"
            style="border:1px dashed rgba(220,60,60,0.3);border-radius:6px;padding:5px 8px;margin-bottom:6px;font-size:0.6em;color:#7a3a3a;text-align:center;transition:all 0.18s;cursor:default;"
            ondragover="event.preventDefault();this.style.borderColor='rgba(220,60,60,0.7)';this.style.color='#ff7070';this.style.background='rgba(220,60,60,0.08)';"
            ondragleave="this.style.borderColor='rgba(220,60,60,0.3)';this.style.color='#7a3a3a';this.style.background='';"
            ondrop="window._pobjDropEnCatalogo(event);this.style.borderColor='rgba(220,60,60,0.3)';this.style.color='#7a3a3a';this.style.background='';">
            🗑 Arrastrar objeto del inventario aquí para quitarlo
        </div>` : ''}
        ${listaHTML}`;
    }

    izq.innerHTML = `
        <div class="pobj-izq-header">
            <span style="font-size:0.6em;letter-spacing:1.8px;text-transform:uppercase;color:#7878a0;font-weight:700;">🎒 Catálogo de Objetos</span>
        </div>
        <div class="pobj-izq-scroll">${contenidoScroll}</div>`;
}

// ── PANEL DERECHO: inventario del PJ ─────────────────────────
function _renderObjDer(nombre, body) {
    if (!body) { body = document.getElementById('ppj-body'); }
    if (!body) return;
    // En modo transfer, usar renderizado especial con drop zones
    if (_objState.modoTransfer && _objState.transferDest) {
        _renderTransferDer(nombre);
        return;
    }

    const esAdmin  = estadoUI.esAdmin;
    const safe     = nombre.replace(/'/g,"\\'");
    const EQUIPABLES = ['Equipamiento','Accesorio','Vehículo','Vehiculo'];
    const RAR_COL  = {'Legendario':'#d4af37','Raro':'#9a50dc','Común':'#5a5a88','-':'#3a3a58'};
    const _imgObj  = (n) => { try{return `${currentConfig.storageUrl}/imgobjetos/${n.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}.png`;}catch{return '';} };
    const _fall    = () => { try{return `${currentConfig.storageUrl}/imginterfaz/no_encontrado.png`;}catch{return '';} };

    const sorted = [..._objState.inventario].sort((a,b)=>{
        if (a.equipado!==b.equipado) return b.equipado-a.equipado;
        const rOrd = {'Legendario':3,'Raro':2,'Común':1,'-':0};
        const catA = _objState.catalogo.find(o=>o.nombre===a.objeto_nombre);
        const catB = _objState.catalogo.find(o=>o.nombre===b.objeto_nombre);
        return (rOrd[catB?.rareza]||0)-(rOrd[catA?.rareza]||0);
    });

    const q = (_objState.busqInv||'').toLowerCase();

    // Slots raíz = sin contenedor_padre
    const lista = sorted.filter(i => !i.contenedor_padre && (!q || i.objeto_nombre.toLowerCase().includes(q)));

    const _renderItem = (item) => {
        const cat      = _objState.catalogo.find(o=>o.nombre===item.objeto_nombre)||{};
        const isEqp    = item.equipado;
        const rarCol   = RAR_COL[cat.rareza]||'#888';
        const tipo     = cat.tipo||'-';
        const safeObj  = item.objeto_nombre.replace(/'/g,"\\'");
        const puedeEqp = EQUIPABLES.includes(tipo);
        const esContenedor = tipo==='Contenedor';
        const esVehiculo   = tipo==='Vehículo'||tipo==='Vehiculo';
        const hijosSlots = _objState.inventario.filter(i => i.contenedor_padre === item.objeto_nombre);
        const expanded = _objState.expandedConts.has(item.objeto_nombre);

        const itemId   = item.id;
        const ctrlHTML = esAdmin ? `
            <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">
                <button class="ppj-ctrl-btn" style="font-size:0.58em;width:auto;padding:0 4px;" onclick="window._pobjModCantId(${itemId},-5)">−5</button>
                <button class="ppj-ctrl-btn" onclick="window._pobjModCantId(${itemId},-1)">−</button>
                <span style="font-size:0.85em;font-weight:700;color:#d4af37;min-width:20px;text-align:center;">${item.cantidad}</span>
                <button class="ppj-ctrl-btn" onclick="window._pobjModCantId(${itemId},1)">+</button>
                <button class="ppj-ctrl-btn" style="font-size:0.58em;width:auto;padding:0 4px;" onclick="window._pobjModCantId(${itemId},5)">+5</button>
                <button class="ppj-ctrl-btn" style="color:#ff6060;font-size:0.62em;padding:0 4px;" onclick="window._pobjEliminarSlot(${itemId})" title="Quitar todos">✕</button>
            </div>` : `<span style="font-size:0.85em;font-weight:700;color:#d4af37;">×${item.cantidad}</span>`;

        let html = `<div class="ppj-obj-card ${isEqp?'equipado':''}" data-nombre="${item.objeto_nombre.toLowerCase()}"
            draggable="${esAdmin?'true':'false'}"
            ondragstart="window._pobjDragStartId(event,${itemId},'${safeObj}')"
            ondragend="event.target.style.opacity=''">
            <div class="ppj-obj-header" style="gap:6px;">
                <img src="${_imgObj(item.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:32px;height:32px;border-radius:4px;object-fit:cover;background:#111;flex-shrink:0;border:1px solid rgba(255,255,255,0.05);">
                <span class="ppj-obj-nombre" title="${item.objeto_nombre}">${item.objeto_nombre}
                    ${isEqp?`<span style="font-size:0.6em;background:rgba(212,175,55,0.15);color:#d4af37;border:1px solid rgba(212,175,55,0.3);border-radius:3px;padding:1px 4px;margin-left:4px;">EQP</span>`:''}
                </span>
                <span class="ppj-obj-rar" style="background:${rarCol}22;color:${rarCol};border:1px solid ${rarCol}44;">${cat.rareza||'-'}</span>
                ${ctrlHTML}
                ${esContenedor?`<button class="ppj-ctrl-btn" onclick="window._pobjToggleCont('${safeObj}')" title="Ver contenido">${expanded?'▲':'▼'}</button>`:''}
            </div>
            ${cat.efecto?`<div class="ppj-obj-det">${cat.efecto}</div>`:''}
            ${esVehiculo?`<div class="ppj-obj-vehiculo">
                ${(cat.vida_roja||0)>0?`<span class="ppj-obj-vida-pill ppj-obj-vida-roja">❤ ${cat.vida_roja}</span>`:''}
                ${(cat.vida_azul||0)>0?`<span class="ppj-obj-vida-pill ppj-obj-vida-azul">💙 ${cat.vida_azul}</span>`:''}
            </div>`:''}
            <div class="ppj-obj-footer">
                <span class="ppj-obj-tipo">${tipo}</span>
                ${puedeEqp?`<button class="ppj-eqp-btn ${isEqp?'on':'off'}" onclick="window._ppjToggleEquipar('${safe}','${safeObj}',${!isEqp})">${isEqp?'✓ Equipado':'Equipar'}</button>`:''}
            </div>
        </div>`;

        if (esContenedor && expanded) {
            const contId = 'pobj-cont-' + safeObj.replace(/[^a-z0-9]/gi,'_');
            html += `<div id="${contId}" style="padding-left:12px;border-left:2px solid rgba(100,150,255,0.2);margin-bottom:4px;transition:border-color 0.15s;"
                ${esAdmin?`ondragover="event.preventDefault();this.style.borderLeftColor='#d4af37';" ondragleave="this.style.borderLeftColor='rgba(100,150,255,0.2)';" ondrop="window._pobjDropEnContenedor(event,'${safeObj}');this.style.borderLeftColor='rgba(100,150,255,0.2)';"`:''}>`; 
            if (hijosSlots.length === 0) {
                html += `<div style="font-size:0.64em;color:#5a5a80;padding:8px 4px;font-style:italic;">${esAdmin?'Arrastra objetos aquí para guardarlos':'Contenedor vacío'}</div>`;
            } else {
                html += hijosSlots.map(hSlot => {
                    const hCat  = _objState.catalogo.find(o=>o.nombre===hSlot.objeto_nombre)||{};
                    const hSafe = hSlot.objeto_nombre.replace(/'/g,"\'");
                    const hId   = hSlot.id;
                    return `<div class="ppj-obj-card" style="margin-bottom:3px;" data-id="${hId}"
                        draggable="${esAdmin?'true':'false'}"
                        ondragstart="window._pobjDragStartId(event,${hId},'${hSafe}')"
                        ondragend="event.target.style.opacity=''">
                        <div class="ppj-obj-header" style="gap:6px;">
                            <img src="${_imgObj(hSlot.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall()}'" style="width:28px;height:28px;border-radius:3px;object-fit:cover;background:#111;flex-shrink:0;">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:0.76em;font-weight:600;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${hSlot.objeto_nombre}</div>
                                ${hCat.efecto?`<div style="font-size:0.6em;color:#8888a8;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${hCat.efecto}</div>`:''}
                            </div>
                            <span style="font-size:0.8em;color:#d4af37;font-weight:700;flex-shrink:0;">×${hSlot.cantidad}</span>
                            ${esAdmin?`
                            <button class="ppj-ctrl-btn" style="font-size:0.58em;width:auto;padding:0 4px;" onclick="window._pobjModCantId(${hId},-1)">−</button>
                            <button class="ppj-ctrl-btn" style="font-size:0.58em;width:auto;padding:0 4px;" onclick="window._pobjModCantId(${hId},1)">+</button>
                            <button class="ppj-ctrl-btn" style="color:#ff6060;font-size:0.6em;padding:0 3px;" onclick="window._pobjEliminarSlot(${hId})">✕</button>`:''}
                        </div>
                    </div>`;
                }).join('');
            }
            html += `</div>`;
        }

        return html;
    };

    const equipados   = lista.filter(i=>i.equipado);
    const noEquipados = lista.filter(i=>!i.equipado);

    body.innerHTML = `<div class="ppj-section">
        <input class="ppj-obj-search" placeholder="Buscar en inventario…" oninput="window._ppjFiltrarObjetos(this.value)">
        <div id="ppj-obj-lista" style="min-height:60px;"
            ${esAdmin?`ondragover="event.preventDefault();this.style.outline='1px dashed rgba(212,175,55,0.25)';" ondragleave="this.style.outline='';" ondrop="window._pobjDropEnInventario(event);this.style.outline='';"`:''}>
            ${lista.length===0?`<div class="ppj-empty" style="pointer-events:none;"><div class="ppj-empty-icon">🎒</div>${esAdmin?'Arrastra objetos del catálogo aquí':'Sin objetos'}</div>`:''}
            ${equipados.length?`<div class="ppj-obj-seccion-titulo">Equipados</div>${equipados.map(_renderItem).join('')}`:''}
            ${noEquipados.length?`<div class="ppj-obj-seccion-titulo">Inventario</div>${noEquipados.map(_renderItem).join('')}`:''}
        </div>
    </div>`;
}

// ── Helpers de recarga ────────────────────────────────────────
async function _recargarObjetos() {
    const nombre = _objState.nombrePJ;
    if (!nombre) return;
    const [catRes, invRes] = await Promise.all([
        supabase.from('objetos').select('nombre,tipo,material,efecto,rareza,vida_roja,vida_azul').eq('es_propuesta', false).order('nombre'),
        supabase.from('inventario_objetos').select('id,objeto_nombre,cantidad,equipado,contenedor_padre').eq('personaje_nombre', nombre).gt('cantidad', 0),
    ]);
    _objState.catalogo   = catRes.data || [];
    _objState.inventario = invRes.data || [];
    _objState.contenidores = {};
    _objState.inventario.forEach(i => {
        if (i.contenedor_padre) {
            if (!_objState.contenidores[i.contenedor_padre]) _objState.contenidores[i.contenedor_padre] = [];
            _objState.contenidores[i.contenedor_padre].push(i.objeto_nombre);
        }
    });
    _renderObjIzq();
    _renderObjDer(nombre, document.getElementById('ppj-body'));
    // Si en modo transfer, también refrescar inventario del destino desde BD
    if (_objState.modoTransfer && _objState.transferDest) {
        supabase.from('inventario_objetos')
            .select('id,objeto_nombre,cantidad,equipado,contenedor_padre')
            .eq('personaje_nombre', _objState.transferDest)
            .gt('cantidad', 0)
            .then(({data}) => {
                _objState.transferInvDest = data || [];
                _renderObjIzq();
            });
    }
}

// ── Funciones globales de objetos ─────────────────────────────
window._pobjVolverCatalogo = () => {
    _objState.modoCrear    = false;
    _objState.objEditando  = null;
    _objState.modoTransfer = false;
    _objState.modoImagenes = false;
    _objState.modoForja    = false;
    _renderObjIzq();
};
window._pobjAbrirCrear    = () => { _objState.modoCrear=true; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.modoForja=false; _renderObjIzq(); };
window._pobjAbrirEditar   = (n) => { _objState.objEditando=n; _objState.modoCrear=false; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.modoForja=false; _renderObjIzq(); };
window._pobjAbrirTransfer = () => { _objState.modoTransfer=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoImagenes=false; _objState.modoForja=false; _objState.transferDest=null; _objState.transferInvDest=[]; _objState.transferContenedoresDest={}; _objState.transferExpandedDest=new Set(); _renderObjIzq(); };
window._pobjAbrirImagenes = () => { _objState.modoImagenes=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoForja=false; _objState.imgSelObj=null; _renderObjIzq(); };
window._pobjAbrirForja    = () => { _objState.modoForja=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.forjaN=4; _renderObjIzq(); };
window._pobjForjaSetN     = (n) => { _objState.forjaN=n; _renderObjIzq(); };
window._pobjBusqCat       = (v) => { _objState.busqCat=v; _renderObjIzq(); };
window._pobjFiltroRar     = (v) => { _objState.filtroRar=v; _renderObjIzq(); };
window._pobjFiltroTipo    = (v) => { _objState.filtroTipo=v; _renderObjIzq(); };
window._pobjToggleCont    = (n) => { if(_objState.expandedConts.has(n))_objState.expandedConts.delete(n); else _objState.expandedConts.add(n); _renderObjDer(_objState.nombrePJ); };

// ── Drag & drop con slots por id ─────────────────────────────

window._pobjDragStartId = (e, slotId, nombre) => {
    e.dataTransfer.setData('text/plain', String(slotId));
    e.dataTransfer.setData('application/x-fuente', 'inventario');
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.target.style.opacity = '0.5';
};
window._pobjDragStart = (e, nombre, fuente) => {
    e.dataTransfer.setData('text/plain', nombre);
    e.dataTransfer.setData('application/x-fuente', fuente || 'catalogo');
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.target.style.opacity = '0.5';
};

window._pobjDropEnInventario = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    if (!estadoUI.esAdmin) return;
    if (fuente === 'inventario') {
        const slotId = parseInt(e.dataTransfer.getData('text/plain'));
        const slot = _objState.inventario.find(i => i.id === slotId);
        if (slot && slot.contenedor_padre) {
            await supabase.from('inventario_objetos').update({ contenedor_padre: null }).eq('id', slotId);
            await _recargarObjetos();
        }
    } else {
        const nombre = e.dataTransfer.getData('application/x-nombre');
        if (nombre) await window._pobjDarAlPJ(nombre, 1);
    }
};

window._pobjDropEnContenedor = async (e, contenedorNombre) => {
    e.preventDefault();
    e.stopPropagation(); // evita que el drop burbujee al inventario raíz
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    const nombre = e.dataTransfer.getData('application/x-nombre');
    if (!nombre || !estadoUI.esAdmin || nombre === contenedorNombre) return;

    if (fuente === 'inventario') {
        const slotId = parseInt(e.dataTransfer.getData('text/plain'));
        const slot = _objState.inventario.find(i => i.id === slotId);
        if (!slot) return;
        if (slot.cantidad === 1) {
            await _moverSlotAContenedor(slotId, slot, contenedorNombre, 1);
        } else {
            _modalCantidad(slot.cantidad, (cant) => _moverSlotAContenedor(slotId, slot, contenedorNombre, cant));
        }
    } else {
        await supabase.from('inventario_objetos').insert({
            personaje_nombre: _objState.nombrePJ, objeto_nombre: nombre,
            cantidad: 1, equipado: false, contenedor_padre: contenedorNombre
        });
        await _recargarObjetos();
    }
};

async function _moverSlotAContenedor(slotId, slot, contenedorNombre, cant) {
    if (cant <= 0) return;
    const slotEnCont = _objState.inventario.find(i =>
        i.objeto_nombre === slot.objeto_nombre && i.contenedor_padre === contenedorNombre
    );
    if (cant === slot.cantidad) {
        if (slotEnCont) {
            await supabase.from('inventario_objetos').update({ cantidad: slotEnCont.cantidad + cant }).eq('id', slotEnCont.id);
            await supabase.from('inventario_objetos').delete().eq('id', slotId);
        } else {
            await supabase.from('inventario_objetos').update({ contenedor_padre: contenedorNombre }).eq('id', slotId);
        }
    } else {
        await supabase.from('inventario_objetos').update({ cantidad: slot.cantidad - cant }).eq('id', slotId);
        if (slotEnCont) {
            await supabase.from('inventario_objetos').update({ cantidad: slotEnCont.cantidad + cant }).eq('id', slotEnCont.id);
        } else {
            await supabase.from('inventario_objetos').insert({
                personaje_nombre: _objState.nombrePJ, objeto_nombre: slot.objeto_nombre,
                cantidad: cant, equipado: false, contenedor_padre: contenedorNombre
            });
        }
    }
    await _recargarObjetos();
}

window._pobjDropEnCatalogo = async (e) => {
    e.preventDefault();
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    if (!estadoUI.esAdmin || fuente !== 'inventario') return;
    const slotId = parseInt(e.dataTransfer.getData('text/plain'));
    await supabase.from('inventario_objetos').delete().eq('id', slotId);
    _objState.inventario = _objState.inventario.filter(i => i.id !== slotId);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};

function _modalCantidad(max, onConfirm) {
    const ex = document.getElementById('ppj-modal-cant'); if (ex) ex.remove();
    const modal = document.createElement('div');
    modal.id = 'ppj-modal-cant';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div style="background:#12101e;border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:20px 24px;min-width:240px;font-family:inherit;">
        <div style="font-size:0.78em;color:#d4af37;font-weight:700;margin-bottom:12px;">¿Cuántos mover? (máx ${max})</div>
        <input id="ppj-cant-input" type="number" min="1" max="${max}" value="${max}"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:5px;color:#fff;padding:6px 10px;font-size:0.9em;box-sizing:border-box;outline:none;">
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button onclick="document.getElementById('ppj-modal-cant').remove()"
                style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#888;border-radius:5px;padding:6px;cursor:pointer;font-size:0.75em;">Cancelar</button>
            <button id="ppj-cant-ok"
                style="flex:1;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);color:#d4af37;border-radius:5px;padding:6px;cursor:pointer;font-size:0.75em;font-weight:700;">Mover</button>
        </div></div>`;
    document.body.appendChild(modal);
    const inp = document.getElementById('ppj-cant-input');
    inp.focus(); inp.select();
    document.getElementById('ppj-cant-ok').onclick = () => {
        const v = Math.min(max, Math.max(1, parseInt(inp.value)||1));
        modal.remove(); onConfirm(v);
    };
    inp.onkeydown = (e) => { if (e.key==='Enter') document.getElementById('ppj-cant-ok')?.click(); };
}

window._pobjEliminarSlot = async (slotId) => {
    if (!estadoUI.esAdmin) return;
    await supabase.from('inventario_objetos').delete().eq('id', slotId);
    _objState.inventario = _objState.inventario.filter(i => i.id !== slotId);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};

window._pobjModCantId = async (slotId, delta) => {
    if (!estadoUI.esAdmin) return;
    const slot = _objState.inventario.find(i => i.id === slotId);
    const nueva = Math.max(0, (slot?.cantidad||0) + delta);
    if (nueva === 0) {
        await window._pobjEliminarSlot(slotId);
    } else {
        await supabase.from('inventario_objetos').update({ cantidad: nueva }).eq('id', slotId);
        if (slot) slot.cantidad = nueva;
        _renderObjDer(_objState.nombrePJ);
        _recargarObjetos();
    }
};

window._pobjModCant = window._pobjModCantId; // retrocompat alias

window._pobjQuitarTodos = async (nombreObj) => {
    if (!estadoUI.esAdmin) return;
    await supabase.from('inventario_objetos').delete()
        .eq('personaje_nombre', _objState.nombrePJ).eq('objeto_nombre', nombreObj);
    _objState.inventario = _objState.inventario.filter(i => i.objeto_nombre !== nombreObj);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};

window._pobjDarAlPJ = async (nombreObj, cantidad) => {
    if (!estadoUI.esAdmin) return;
    const slotRaiz = _objState.inventario.find(i => i.objeto_nombre === nombreObj && !i.contenedor_padre);
    if (slotRaiz) {
        await supabase.from('inventario_objetos').update({ cantidad: slotRaiz.cantidad + cantidad }).eq('id', slotRaiz.id);
    } else {
        await supabase.from('inventario_objetos').insert({
            personaje_nombre: _objState.nombrePJ, objeto_nombre: nombreObj,
            cantidad, equipado: false, contenedor_padre: null
        });
    }
    await _recargarObjetos();
};

// Guardar objeto (crear o editar)
window._pobjGuardarObjeto = async (nombreExistente) => {
    const esNuevo = !nombreExistente;
    const nombre  = (document.getElementById('pobj-f-nombre')?.value||'').trim();
    const tipo    = document.getElementById('pobj-f-tipo')?.value||'-';
    const mat     = document.getElementById('pobj-f-mat')?.value||'-';
    const rar     = document.getElementById('pobj-f-rar')?.value||'Común';
    const eff     = (document.getElementById('pobj-f-eff')?.value||'').trim();
    const vr      = parseInt(document.getElementById('pobj-f-vr')?.value)||0;
    const va      = parseInt(document.getElementById('pobj-f-va')?.value)||0;
    const cont    = document.getElementById('pobj-f-cont')?.value||null;
    if (!nombre) { alert('El nombre es obligatorio.'); return; }
    const payload = {nombre,tipo,material:mat,rareza:rar,efecto:eff,vida_roja:vr,vida_azul:va,contenedor_padre:cont||null,es_propuesta:false};
    let error;
    if (esNuevo) { ({error}=await supabase.from('objetos').insert(payload)); }
    else         { ({error}=await supabase.from('objetos').update(payload).eq('nombre',nombreExistente)); }
    if (error) { alert('Error: '+error.message); return; }
    if (esNuevo) {
        const cantPJ = parseInt(document.getElementById('pobj-f-cant-pj')?.value)||0;
        if (cantPJ>0) await supabase.from('inventario_objetos').upsert({personaje_nombre:_objState.nombrePJ,objeto_nombre:nombre,cantidad:cantPJ,equipado:false},{onConflict:'personaje_nombre,objeto_nombre'});
    }
    window.mostrarToast?.(esNuevo?'✨ Objeto creado':'💾 Guardado');
    _objState.modoCrear=false; _objState.objEditando=null;
    await _recargarObjetos();
};

window._pobjEliminarObjeto = async (nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? Se quitará de todos los inventarios.`)) return;
    const {error}=await supabase.from('objetos').delete().eq('nombre',nombre);
    if (error) { alert('Error: '+error.message); return; }
    window.mostrarToast?.('🗑 Eliminado');
    _objState.objEditando=null;
    await _recargarObjetos();
};

// Imágenes
window._pobjImgSeleccionar = (n) => { _objState.imgSelObj=n; _renderObjIzq(); };
window._pobjImgBuscar = (v) => { _objState.imgBusq=v; _renderObjIzq(); };
// ── TRANSFER EN VIVO ─────────────────────────────────────────

window._pobjIniciarTransfer = async (destNombre) => {
    _objState.transferDest = destNombre;
    _objState.transferExpandedDest = new Set();
    const { data } = await supabase.from('inventario_objetos')
        .select('id,objeto_nombre,cantidad,equipado,contenedor_padre')
        .eq('personaje_nombre', destNombre).gt('cantidad', 0);
    _objState.transferInvDest = data || [];
    _renderObjIzq();
    // Refrescar panel derecho para añadir drop zones
    _renderTransferDer(_objState.nombrePJ);
};

window._pobjCambiarDestinoTransfer = () => {
    _objState.transferDest = null;
    _objState.transferInvDest = [];
    _objState.transferExpandedDest = new Set();
    _renderObjIzq();
    // Restaurar panel derecho normal
    _renderObjDer(_objState.nombrePJ);
};

window._pobjFiltrarDestTransfer = (q) => {
    const grid = document.getElementById('pobj-dest-grid');
    if (!grid) return;
    const items = grid.querySelectorAll('[onclick]');
    items.forEach(el => {
        const nombre = el.querySelector('span')?.textContent || '';
        el.style.display = nombre.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
};

window._pobjTransferToggleCont = (nombre) => {
    const key = nombre;
    if (_objState.transferExpandedDest.has(key)) _objState.transferExpandedDest.delete(key);
    else _objState.transferExpandedDest.add(key);
    _renderObjIzq();
};

window._pobjTransferDragStart = (e, slotId, nombre, origen) => {
    e.dataTransfer.setData('text/plain', String(slotId));
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.dataTransfer.setData('application/x-origen', origen);
    e.stopPropagation();
    e.target.style.opacity = '0.5';
};

// Drop en zona raíz del destino (izq=dest, der=local)
window._pobjTransferDrop = async (e, zonaDestino, contenedorDestino) => {
    e.preventDefault();
    e.stopPropagation();
    if (!estadoUI.esAdmin) return;

    const slotId = parseInt(e.dataTransfer.getData('text/plain'));
    const nombre = e.dataTransfer.getData('application/x-nombre');
    const origen = e.dataTransfer.getData('application/x-origen');
    if (!nombre || origen === zonaDestino) return;

    const destNombre = _objState.transferDest;
    const srcPJ  = origen  === 'local' ? _objState.nombrePJ : destNombre;
    const dstPJ  = zonaDestino === 'local' ? _objState.nombrePJ : destNombre;
    const srcInv = origen === 'local' ? _objState.inventario : _objState.transferInvDest;
    const slot   = srcInv.find(i => i.id === slotId);
    if (!slot) return;

    const ejecutarMover = async (cant) => {
        if (cant <= 0) return;
        const dstInv = zonaDestino === 'local' ? _objState.inventario : _objState.transferInvDest;
        const slotDestExistente = dstInv.find(i =>
            i.objeto_nombre === nombre && (i.contenedor_padre||null) === (contenedorDestino||null)
        );
        if (cant === slot.cantidad) {
            if (slotDestExistente) {
                await supabase.from('inventario_objetos').update({ cantidad: slotDestExistente.cantidad + cant }).eq('id', slotDestExistente.id);
                await supabase.from('inventario_objetos').delete().eq('id', slotId);
            } else {
                await supabase.from('inventario_objetos').update({
                    personaje_nombre: dstPJ,
                    contenedor_padre: contenedorDestino || null
                }).eq('id', slotId);
            }
        } else {
            await supabase.from('inventario_objetos').update({ cantidad: slot.cantidad - cant }).eq('id', slotId);
            if (slotDestExistente) {
                await supabase.from('inventario_objetos').update({ cantidad: slotDestExistente.cantidad + cant }).eq('id', slotDestExistente.id);
            } else {
                await supabase.from('inventario_objetos').insert({
                    personaje_nombre: dstPJ, objeto_nombre: nombre,
                    cantidad: cant, equipado: false, contenedor_padre: contenedorDestino || null
                });
            }
        }
        await _recargarObjetos();
        await window._pobjIniciarTransfer(destNombre);
    };

    if (slot.cantidad > 1) {
        _modalCantidad(slot.cantidad, ejecutarMover);
    } else {
        await ejecutarMover(1);
    }
};

// Drop en contenedor del panel izquierdo (destino)
window._pobjTransferDropEnContenedor = async (e, zonaDestino, contenedorNombre) => {
    e.preventDefault();
    e.stopPropagation();
    await window._pobjTransferDrop(e, zonaDestino, contenedorNombre);
};

// Renderizar el panel derecho en modo transfer (inventario local con drop zones)
function _renderTransferDer(nombre) {
    const body = document.getElementById('ppj-body');
    if (!body) return;

    const esAdmin = estadoUI.esAdmin;
    const safe    = nombre.replace(/'/g,"\'");
    const RAR_COL = {'Legendario':'#d4af37','Raro':'#9a50dc','Común':'#5a5a88','-':'#3a3a58'};
    const _imgObj2 = (n) => { try{return `${currentConfig.storageUrl}/imgobjetos/${n.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')}.png`;}catch{return '';} };
    const _fall2   = () => { try{return `${currentConfig.storageUrl}/imginterfaz/no_encontrado.png`;}catch{return '';} };

    const sorted = [..._objState.inventario].sort((a,b) => {
        const rOrd = {'Legendario':3,'Raro':2,'Común':1,'-':0};
        const catA = _objState.catalogo.find(o=>o.nombre===a.objeto_nombre);
        const catB = _objState.catalogo.find(o=>o.nombre===b.objeto_nombre);
        return (rOrd[catB?.rareza]||0)-(rOrd[catA?.rareza]||0);
    });
    const raizSlots = sorted.filter(i => !i.contenedor_padre);

    const _renderSlotLocal = (slot) => {
        const cat  = _objState.catalogo.find(o=>o.nombre===slot.objeto_nombre)||{};
        const esContenedor = (cat.tipo||'-') === 'Contenedor';
        const safe2 = slot.objeto_nombre.replace(/'/g,"\'");
        const hijosSlots = _objState.inventario.filter(i => i.contenedor_padre === slot.objeto_nombre);
        const expanded   = _objState.expandedConts.has(slot.objeto_nombre);
        const rarCol = RAR_COL[cat.rareza]||'#888';

        let html = `<div class="ppj-obj-card" style="margin-bottom:3px;"
            draggable="${esAdmin?'true':'false'}"
            ondragstart="window._pobjTransferDragStart(event,${slot.id},'${safe2}','local')"
            ondragend="event.target.style.opacity=''">
            <div class="ppj-obj-header" style="gap:5px;">
                <img src="${_imgObj2(slot.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall2()}'" style="width:28px;height:28px;border-radius:3px;object-fit:cover;background:#111;flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.74em;font-weight:600;color:#d0d0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.objeto_nombre}</div>
                    ${cat.efecto?`<div style="font-size:0.58em;color:#8888a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat.efecto}</div>`:''}
                </div>
                <span class="ppj-obj-rar" style="background:${rarCol}22;color:${rarCol};border:1px solid ${rarCol}44;">${cat.rareza||'-'}</span>
                <span style="font-size:0.8em;font-weight:700;color:#d4af37;flex-shrink:0;">x${slot.cantidad}</span>
                ${esContenedor?`<button class="ppj-ctrl-btn" style="font-size:0.6em;padding:0 4px;" onclick="window._pobjToggleCont('${safe2}')">${expanded?'▲':'▼'}</button>`:''}
            </div>
        </div>`;

        if (esContenedor && expanded && hijosSlots.length > 0) {
            html += `<div style="padding-left:10px;border-left:2px solid rgba(100,150,255,0.2);margin-bottom:3px;"
                ondragover="event.preventDefault();event.stopPropagation();this.style.borderLeftColor='#d4af37';"
                ondragleave="this.style.borderLeftColor='rgba(100,150,255,0.2)';"
                ondrop="window._pobjTransferDropEnContenedor(event,'local','${safe2}');this.style.borderLeftColor='rgba(100,150,255,0.2)';">`;
            html += hijosSlots.map(h => {
                const hSafe = h.objeto_nombre.replace(/'/g,"\'");
                return `<div class="ppj-obj-card" style="margin-bottom:2px;" draggable="true"
                    ondragstart="window._pobjTransferDragStart(event,${h.id},'${hSafe}','local')"
                    ondragend="event.target.style.opacity=''">
                    <div class="ppj-obj-header" style="gap:5px;">
                        <img src="${_imgObj2(h.objeto_nombre)}" onerror="this.onerror=null;this.src='${_fall2()}'" style="width:24px;height:24px;border-radius:3px;object-fit:cover;background:#111;flex-shrink:0;">
                        <div style="flex:1;min-width:0;font-size:0.72em;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.objeto_nombre}</div>
                        <span style="font-size:0.75em;color:#d4af37;font-weight:700;">x${h.cantidad}</span>
                    </div>
                </div>`;
            }).join('');
            html += `</div>`;
        }
        return html;
    };

    body.innerHTML = `<div class="ppj-section">
        <div style="font-size:0.6em;color:#7878a0;text-align:center;margin-bottom:8px;padding:4px;background:rgba(212,175,55,0.04);border-radius:4px;">
            ← Arrastra al panel izquierdo para enviar a ${_objState.transferDest}
        </div>
        <div style="min-height:80px;padding:4px;border-radius:5px;border:1px dashed rgba(255,255,255,0.08);transition:border-color 0.15s;"
            ondragover="event.preventDefault();event.stopPropagation();this.style.borderColor='rgba(212,175,55,0.4)';"
            ondragleave="this.style.borderColor='rgba(255,255,255,0.08)';"
            ondrop="window._pobjTransferDrop(event,'local',null);this.style.borderColor='rgba(255,255,255,0.08)';">
            ${raizSlots.length===0?`<div style="font-size:0.62em;color:#3a3a58;padding:16px;text-align:center;">Inventario vacío</div>`:''}
            ${raizSlots.map(_renderSlotLocal).join('')}
        </div>
    </div>`;
}


// ── Helpers de recarga ────────────────────────────────────────

// ── Funciones globales de objetos ─────────────────────────────
window._pobjVolverCatalogo = () => {
    _objState.modoCrear    = false;
    _objState.objEditando  = null;
    _objState.modoTransfer = false;
    _objState.modoImagenes = false;
    _objState.modoForja    = false;
    _renderObjIzq();
};
window._pobjAbrirCrear    = () => { _objState.modoCrear=true; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.modoForja=false; _renderObjIzq(); };
window._pobjAbrirEditar   = (n) => { _objState.objEditando=n; _objState.modoCrear=false; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.modoForja=false; _renderObjIzq(); };
window._pobjAbrirTransfer = () => { _objState.modoTransfer=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoImagenes=false; _objState.modoForja=false; _objState.transferDest=null; _objState.transferInvDest=[]; _objState.transferContenedoresDest={}; _objState.transferExpandedDest=new Set(); _renderObjIzq(); };
window._pobjAbrirImagenes = () => { _objState.modoImagenes=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoForja=false; _objState.imgSelObj=null; _renderObjIzq(); };
window._pobjAbrirForja    = () => { _objState.modoForja=true; _objState.modoCrear=false; _objState.objEditando=null; _objState.modoTransfer=false; _objState.modoImagenes=false; _objState.forjaN=4; _renderObjIzq(); };
window._pobjForjaSetN     = (n) => { _objState.forjaN=n; _renderObjIzq(); };
window._pobjBusqCat       = (v) => { _objState.busqCat=v; _renderObjIzq(); };
window._pobjFiltroRar     = (v) => { _objState.filtroRar=v; _renderObjIzq(); };
window._pobjFiltroTipo    = (v) => { _objState.filtroTipo=v; _renderObjIzq(); };
window._pobjToggleCont    = (n) => { if(_objState.expandedConts.has(n))_objState.expandedConts.delete(n); else _objState.expandedConts.add(n); _renderObjDer(_objState.nombrePJ); };

// ── Drag & drop con slots por id ─────────────────────────────

window._pobjDragStartId = (e, slotId, nombre) => {
    e.dataTransfer.setData('text/plain', String(slotId));
    e.dataTransfer.setData('application/x-fuente', 'inventario');
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.target.style.opacity = '0.5';
};
window._pobjDragStart = (e, nombre, fuente) => {
    e.dataTransfer.setData('text/plain', nombre);
    e.dataTransfer.setData('application/x-fuente', fuente || 'catalogo');
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.target.style.opacity = '0.5';
};

window._pobjDropEnInventario = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    if (!estadoUI.esAdmin) return;
    if (fuente === 'inventario') {
        const slotId = parseInt(e.dataTransfer.getData('text/plain'));
        const slot = _objState.inventario.find(i => i.id === slotId);
        if (slot && slot.contenedor_padre) {
            await supabase.from('inventario_objetos').update({ contenedor_padre: null }).eq('id', slotId);
            await _recargarObjetos();
        }
    } else {
        const nombre = e.dataTransfer.getData('application/x-nombre');
        if (nombre) await window._pobjDarAlPJ(nombre, 1);
    }
};

window._pobjDropEnContenedor = async (e, contenedorNombre) => {
    e.preventDefault();
    e.stopPropagation(); // evita que el drop burbujee al inventario raíz
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    const nombre = e.dataTransfer.getData('application/x-nombre');
    if (!nombre || !estadoUI.esAdmin || nombre === contenedorNombre) return;

    if (fuente === 'inventario') {
        const slotId = parseInt(e.dataTransfer.getData('text/plain'));
        const slot = _objState.inventario.find(i => i.id === slotId);
        if (!slot) return;
        if (slot.cantidad === 1) {
            await _moverSlotAContenedor(slotId, slot, contenedorNombre, 1);
        } else {
            _modalCantidad(slot.cantidad, (cant) => _moverSlotAContenedor(slotId, slot, contenedorNombre, cant));
        }
    } else {
        await supabase.from('inventario_objetos').insert({
            personaje_nombre: _objState.nombrePJ, objeto_nombre: nombre,
            cantidad: 1, equipado: false, contenedor_padre: contenedorNombre
        });
        await _recargarObjetos();
    }
};


window._pobjDropEnCatalogo = async (e) => {
    e.preventDefault();
    const fuente = e.dataTransfer.getData('application/x-fuente') || 'catalogo';
    if (!estadoUI.esAdmin || fuente !== 'inventario') return;
    const slotId = parseInt(e.dataTransfer.getData('text/plain'));
    await supabase.from('inventario_objetos').delete().eq('id', slotId);
    _objState.inventario = _objState.inventario.filter(i => i.id !== slotId);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};


window._pobjEliminarSlot = async (slotId) => {
    if (!estadoUI.esAdmin) return;
    await supabase.from('inventario_objetos').delete().eq('id', slotId);
    _objState.inventario = _objState.inventario.filter(i => i.id !== slotId);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};

window._pobjModCantId = async (slotId, delta) => {
    if (!estadoUI.esAdmin) return;
    const slot = _objState.inventario.find(i => i.id === slotId);
    const nueva = Math.max(0, (slot?.cantidad||0) + delta);
    if (nueva === 0) {
        await window._pobjEliminarSlot(slotId);
    } else {
        await supabase.from('inventario_objetos').update({ cantidad: nueva }).eq('id', slotId);
        if (slot) slot.cantidad = nueva;
        _renderObjDer(_objState.nombrePJ);
        _recargarObjetos();
    }
};

window._pobjModCant = window._pobjModCantId; // retrocompat alias

window._pobjQuitarTodos = async (nombreObj) => {
    if (!estadoUI.esAdmin) return;
    await supabase.from('inventario_objetos').delete()
        .eq('personaje_nombre', _objState.nombrePJ).eq('objeto_nombre', nombreObj);
    _objState.inventario = _objState.inventario.filter(i => i.objeto_nombre !== nombreObj);
    _renderObjDer(_objState.nombrePJ);
    _recargarObjetos();
};

window._pobjDarAlPJ = async (nombreObj, cantidad) => {
    if (!estadoUI.esAdmin) return;
    const slotRaiz = _objState.inventario.find(i => i.objeto_nombre === nombreObj && !i.contenedor_padre);
    if (slotRaiz) {
        await supabase.from('inventario_objetos').update({ cantidad: slotRaiz.cantidad + cantidad }).eq('id', slotRaiz.id);
    } else {
        await supabase.from('inventario_objetos').insert({
            personaje_nombre: _objState.nombrePJ, objeto_nombre: nombreObj,
            cantidad, equipado: false, contenedor_padre: null
        });
    }
    await _recargarObjetos();
};

// Guardar objeto (crear o editar)
window._pobjGuardarObjeto = async (nombreExistente) => {
    const esNuevo = !nombreExistente;
    const nombre  = (document.getElementById('pobj-f-nombre')?.value||'').trim();
    const tipo    = document.getElementById('pobj-f-tipo')?.value||'-';
    const mat     = document.getElementById('pobj-f-mat')?.value||'-';
    const rar     = document.getElementById('pobj-f-rar')?.value||'Común';
    const eff     = (document.getElementById('pobj-f-eff')?.value||'').trim();
    const vr      = parseInt(document.getElementById('pobj-f-vr')?.value)||0;
    const va      = parseInt(document.getElementById('pobj-f-va')?.value)||0;
    const cont    = document.getElementById('pobj-f-cont')?.value||null;
    if (!nombre) { alert('El nombre es obligatorio.'); return; }
    const payload = {nombre,tipo,material:mat,rareza:rar,efecto:eff,vida_roja:vr,vida_azul:va,contenedor_padre:cont||null,es_propuesta:false};
    let error;
    if (esNuevo) { ({error}=await supabase.from('objetos').insert(payload)); }
    else         { ({error}=await supabase.from('objetos').update(payload).eq('nombre',nombreExistente)); }
    if (error) { alert('Error: '+error.message); return; }
    if (esNuevo) {
        const cantPJ = parseInt(document.getElementById('pobj-f-cant-pj')?.value)||0;
        if (cantPJ>0) await supabase.from('inventario_objetos').upsert({personaje_nombre:_objState.nombrePJ,objeto_nombre:nombre,cantidad:cantPJ,equipado:false},{onConflict:'personaje_nombre,objeto_nombre'});
    }
    window.mostrarToast?.(esNuevo?'✨ Objeto creado':'💾 Guardado');
    _objState.modoCrear=false; _objState.objEditando=null;
    await _recargarObjetos();
};

window._pobjEliminarObjeto = async (nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? Se quitará de todos los inventarios.`)) return;
    const {error}=await supabase.from('objetos').delete().eq('nombre',nombre);
    if (error) { alert('Error: '+error.message); return; }
    window.mostrarToast?.('🗑 Eliminado');
    _objState.objEditando=null;
    await _recargarObjetos();
};

// Imágenes
window._pobjImgSeleccionar = (n) => { _objState.imgSelObj=n; _renderObjIzq(); };
window._pobjImgBuscar = (v) => { _objState.imgBusq=v; _renderObjIzq(); };
// ── TRANSFER EN VIVO ─────────────────────────────────────────

window._pobjIniciarTransfer = async (destNombre) => {
    _objState.transferDest = destNombre;
    _objState.transferExpandedDest = new Set();
    // Cargar inventario del personaje destino
    const { data } = await supabase.from('inventario_objetos')
        .select('id,objeto_nombre,cantidad,equipado,contenedor_padre')
        .eq('personaje_nombre', destNombre)
        .gt('cantidad', 0);
    _objState.transferInvDest = data || [];
    _objState.transferContenedoresDest = {};
    _objState.transferInvDest.forEach(i => {
        if (i.contenedor_padre) {
            if (!_objState.transferContenedoresDest[i.contenedor_padre])
                _objState.transferContenedoresDest[i.contenedor_padre] = [];
            _objState.transferContenedoresDest[i.contenedor_padre].push(i.objeto_nombre);
        }
    });
    _renderObjIzq();
    // Refrescar panel derecho para añadir drop zones
    _renderTransferDer(_objState.nombrePJ);
};

window._pobjCambiarDestinoTransfer = () => {
    _objState.transferDest = null;
    _objState.transferInvDest = [];
    _objState.transferContenedoresDest = {};
    _objState.transferExpandedDest = new Set();
    _renderObjIzq();
    _renderTransferDer(_objState.nombrePJ);
};

window._pobjTransferToggleCont = (origen, nombre) => {
    const key = `${origen}:${nombre}`;
    if (_objState.transferExpandedDest.has(key)) _objState.transferExpandedDest.delete(key);
    else _objState.transferExpandedDest.add(key);
    _renderObjIzq();
};

window._pobjTransferDragStart = (e, slotId, nombre, origen) => {
    e.dataTransfer.setData('text/plain', String(slotId));
    e.dataTransfer.setData('application/x-nombre', nombre);
    e.dataTransfer.setData('application/x-origen', origen);
    e.stopPropagation();
    e.target.style.opacity = '0.5';
};



window._pobjImgDrop = (e) => { e.preventDefault(); e.currentTarget.style.borderColor='rgba(212,175,55,0.25)'; e.currentTarget.style.color='#3a3a58'; const f=e.dataTransfer?.files?.[0]; if(f) window._pobjImgSubir(f); };
window._pobjImgSubir = async (file) => {
    if (!file||!_objState.imgSelObj) return;
    const status=document.getElementById('pobj-img-status');
    if (status) status.textContent='Subiendo…';
    const _norm=(s)=>s.trim().toLowerCase().replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    const path=`${_norm(_objState.imgSelObj)}.png`;
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=async()=>{
        const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
        canvas.getContext('2d').drawImage(img,0,0); URL.revokeObjectURL(url);
        canvas.toBlob(async(blob)=>{
            const {error}=await supabase.storage.from('imagenes-hex').upload(`imgobjetos/${path}`,blob,{upsert:true,contentType:'image/png'});
            if(error){if(status)status.innerHTML=`<span style="color:#ff6060">Error: ${error.message}</span>`;return;}
            if(status)status.innerHTML=`<span style="color:#3ecf6e">✅ Imagen actualizada</span>`;
        },'image/png');
    };
    img.onerror=()=>{if(status)status.innerHTML=`<span style="color:#ff6060">No se pudo leer la imagen</span>`;};
    img.src=url;
};

window._pobjRecargarDesdeOP = _recargarObjetos;

// ─────────────────────────────────────────────────────────────
// FUNCIONES GLOBALES
// ─────────────────────────────────────────────────────────────
window.cerrarPanelPJ  = cerrarPanelPJ;
window.centrarEnHechizo = centrarEnHechizo;

window._ppjCambiarTab = (nombre, tab) => {
    _tabActivo[nombre] = tab;
    document.querySelectorAll('.ppj-tab').forEach(b =>
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${tab}'`)));
    _renderTab(nombre, tab);
};

window._ppjAbrirImgGrande = (nombre) => {
    const p = personajes[nombre]; if (!p) return;
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    m.onclick = () => m.remove();
    m.innerHTML = `<img src="${_imgPj(p.iconoOverride||nombre)}" onerror="if(this.src!=='${_fallback()}')this.src='${_fallback()}'" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:10px;">`;
    document.body.appendChild(m);
};

window._ppjEjecutarHexPush = async (nombre, tipo, cantidad) => {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const { error } = await supabase.from('hex_push_log').insert({ personaje:nombre, tipo, cantidad, nota:'', otorgado_por:'OP' });
    if (error) { window.mostrarToast?.('Error al registrar push', true); return; }
    p.hex = (p.hex||0) + cantidad;
    encolarCambio(nombre, 'hex', p.hex);
    window.actualizarBtnSync?.();
    window.renderCatalogo?.();
    window.mostrarToast?.(`✨ +${cantidad} HEX (${tipo.replace('_',' ')}) → ${nombre}`);
    const body = document.getElementById('ppj-body');
    if (body) _tabHex(nombre, body);
};

window._ppjDeleteHexLog = async (id, nombre) => {
    if (!estadoUI.esAdmin) return;
    if (!confirm('¿Eliminar este registro?')) return;
    await supabase.from('hex_push_log').delete().eq('id', id);
    const body = document.getElementById('ppj-body');
    if (body) _tabHex(nombre, body);
};

window._ppjToggleEquipar = async (personaje, objeto, equipar) => {
    const { error } = await supabase.from('inventario_objetos')
        .update({ equipado: equipar })
        .eq('personaje_nombre', personaje).eq('objeto_nombre', objeto);
    if (error) { window.mostrarToast?.('Error al actualizar', true); return; }
    const card = document.querySelector(`[data-nombre="${objeto.toLowerCase()}"]`);
    if (card) {
        card.classList.toggle('equipado', equipar);
        const btn = card.querySelector('.ppj-eqp-btn');
        if (btn) {
            btn.className = `ppj-eqp-btn ${equipar?'on':'off'}`;
            btn.textContent = equipar ? '✓ Equipado' : 'Equipar';
            btn.setAttribute('onclick', `window._ppjToggleEquipar('${personaje.replace(/'/g,"\\'")}','${objeto.replace(/'/g,"\\'")}',${!equipar})`);
        }
    }
};

window._ppjFiltrarObjetos = (query) => {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.ppj-obj-card').forEach(c => {
        c.style.display = (!q || (c.getAttribute('data-nombre')||'').includes(q)) ? '' : 'none';
    });
};

// Acordeón de hechizos
window._ppjToggleAcc = (el) => {
    el.classList.toggle('open');
};

// Buscador de hechizos APRENDIDOS (scoped al contenedor de inventario)
window._ppjBuscarHz = (query) => {
    const q = query.toLowerCase().trim();
    const inv = document.getElementById('ppj-hz-inv-list');
    if (!inv) return;

    if (!q) {
        inv.querySelectorAll('.ppj-hz-card').forEach(c => { c.style.display = ''; c.classList.remove('ppj-hidden'); });
        inv.querySelectorAll('.ppj-af-acc, .ppj-cl-acc').forEach(a => a.classList.remove('open'));
        return;
    }

    // 1. Marcar cada card como visible u oculto
    inv.querySelectorAll('.ppj-hz-card').forEach(c => {
        const nombre = c.getAttribute('data-hz-nombre') || '';
        const texto  = c.textContent.toLowerCase();
        const match  = nombre.includes(q) || texto.includes(q);
        c.classList.toggle('ppj-hidden', !match);
        c.style.display = match ? '' : 'none';
    });

    // 2. Para cada ppj-af-acc, abrir si tiene ALGÚN card visible (en cualquier profundidad)
    //    y también abrir sus ppj-cl-acc hijos que tengan cards visibles
    inv.querySelectorAll('.ppj-af-acc').forEach(af => {
        const cardsVisibles = [...af.querySelectorAll('.ppj-hz-card')].filter(c => !c.classList.contains('ppj-hidden'));
        af.classList.toggle('open', cardsVisibles.length > 0);

        // Abrir/cerrar sub-acordeones de clase según si tienen cards visibles
        af.querySelectorAll('.ppj-cl-acc').forEach(cl => {
            const clVisible = [...cl.querySelectorAll('.ppj-hz-card')].some(c => !c.classList.contains('ppj-hidden'));
            cl.classList.toggle('open', clVisible);
        });
    });
};

// Buscador del catálogo completo
window._ppjBuscarCat = (query) => {
    const q = query.toLowerCase().trim();
    const cat = document.getElementById('ppj-cat-lista');
    if (!cat) return;

    if (!q) {
        cat.querySelectorAll('.ppj-cat-card').forEach(c => { c.classList.remove('ppj-hidden'); c.style.display = ''; });
        cat.querySelectorAll('.ppj-cat-acc').forEach(a => a.classList.remove('open'));
        return;
    }

    // 1. Marcar cards que no matchean
    cat.querySelectorAll('.ppj-cat-card').forEach(c => {
        const nombre = c.getAttribute('data-cat-nombre') || '';
        const id     = c.getAttribute('data-cat-id') || '';
        const texto  = c.textContent.toLowerCase();
        const match  = nombre.includes(q) || id.toLowerCase().includes(q) || texto.includes(q);
        c.classList.toggle('ppj-hidden', !match);
        c.style.display = match ? '' : 'none';
    });

    // 2. Abrir ppj-cat-acc si tiene algún card visible
    cat.querySelectorAll('.ppj-cat-acc').forEach(af => {
        const hayVisible = [...af.querySelectorAll('.ppj-cat-card')].some(c => !c.classList.contains('ppj-hidden'));
        af.classList.toggle('open', hayVisible);
    });
};

// Asignar hechizo del catálogo a un personaje
window._ppjAsignarHz = async (nombrePJ, hechizo_id, modo) => {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombrePJ]; if (!p) return;

    const { data: nodo } = await supabase.from('hechizos_nodos')
        .select('nombre, afinidad, hex_cost, clase')
        .eq('hechizo_id', hechizo_id).single();
    if (!nodo) { window.mostrarToast?.('Hechizo no encontrado', true); return; }

    const hexCost = nodo.hex_cost || 0;
    let cobro = 0;
    if (modo === '50')  cobro = Math.round(hexCost * 0.5);
    if (modo === '100') cobro = hexCost;
    if (modo === '200') cobro = hexCost * 2;

    if (cobro > 0 && (p.hex || 0) < cobro) {
        window.mostrarToast?.(`HEX insuficiente (tiene ${p.hex||0}, necesita ${cobro})`, true);
        return;
    }

    const { error } = await supabase.from('hechizos_inventario').insert({
        personaje_nombre: nombrePJ,
        hechizo_nombre:   nodo.nombre,
        hechizo_afinidad: nodo.afinidad || '',
        hechizo_hex:      hexCost,
        tipo:   'aprendido',
        origen: cobro > 0 ? 'Compra' : 'OP'
    });
    if (error) { window.mostrarToast?.('Error al asignar: ' + error.message, true); return; }

    if (cobro > 0) {
        p.hex = Math.max(0, (p.hex || 0) - cobro);
        encolarCambio(nombrePJ, 'hex', p.hex);
        window.actualizarBtnSync?.();
        window.renderCatalogo?.();
    }

    const modoTxt = { gratis:'gratis', '50':`−${Math.round(hexCost*0.5)} HEX (50%)`, '100':`−${hexCost} HEX`, '200':`−${hexCost*2} HEX (200%)` }[modo] || '';
    window.mostrarToast?.(`✨ "${nodo.nombre}" → ${nombrePJ} ${modoTxt}`);

    const body = document.getElementById('ppj-body');
    if (body) _tabHechizos(nombrePJ, body);
};

// Deasignar hechizo de un personaje
window._ppjDeasignarHz = async (nombrePJ, hechizo_id) => {
    if (!estadoUI.esAdmin) return;

    const { data: nodo } = await supabase.from('hechizos_nodos')
        .select('nombre').eq('hechizo_id', hechizo_id).single();
    if (!nodo) { window.mostrarToast?.('Hechizo no encontrado', true); return; }

    if (!confirm(`¿Deasignar "${nodo.nombre}" de ${nombrePJ}?`)) return;

    const { error } = await supabase.from('hechizos_inventario')
        .delete()
        .eq('personaje_nombre', nombrePJ)
        .eq('hechizo_nombre', nodo.nombre);

    if (error) { window.mostrarToast?.('Error al deasignar: ' + error.message, true); return; }
    window.mostrarToast?.(`✅ "${nodo.nombre}" deasignado de ${nombrePJ}`);

    const body = document.getElementById('ppj-body');
    if (body) _tabHechizos(nombrePJ, body);
};


window._ppjSetCd = async (nombre, afinKey, deltaP) => {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const actual = p[`cd_${afinKey}`] ?? 0.5;
    // deltaP es ±5 (puntos porcentuales). Convertir a decimal y clampear 10%–200%
    const v = Math.round(Math.max(0.1, Math.min(2.0, actual + deltaP / 100)) * 100) / 100;
    p[`cd_${afinKey}`] = v;

    // Construir el objeto cd_afin completo con todos los valores actuales del PJ
    const cdAfin = {
        fisica:     p.cd_fisica     ?? 0.5,
        energetica: p.cd_energetica ?? 0.5,
        espiritual: p.cd_espiritual ?? 0.5,
        mando:      p.cd_mando      ?? 0.5,
        psiquica:   p.cd_psiquica   ?? 0.5,
        oscura:     p.cd_oscura     ?? 0.5,
        [afinKey]:  v,   // sobreescribir el que acaba de cambiar
    };

    // Intentar guardar como JSONB (cd_afin) — si la columna no existe, caerá
    // silenciosamente. Intentar también columna individual como fallback.
    const { error: e1 } = await supabase.from('personajes')
        .update({ cd_afin: cdAfin, [`cd_${afinKey}`]: v })
        .eq('nombre', nombre);
    if (e1) {
        // Si cd_afin no existe en el schema, intentar solo la columna individual
        const { error: e2 } = await supabase.from('personajes')
            .update({ [`cd_${afinKey}`]: v })
            .eq('nombre', nombre);
        if (e2) console.error('[_ppjSetCd] Error guardando CD:', e2.message);
    }

    // Actualizar solo el span sin re-renderizar todo el panel
    const span = document.getElementById(`ppj-cd-${nombre}-${afinKey}`);
    if (span) span.textContent = `${(v * 100).toFixed(0)}%`;
    // Sincronizar con HexCast si el PJ está en un slot activo
    try {
        if (window.hxState?.cdPorPj?.[nombre]) {
            window.hxState.cdPorPj[nombre][afinKey] = v;
        }
    } catch(e) { /* ignorar si hxState no disponible */ }
};

// ─────────────────────────────────────────────────────────────
// REFRESH
// ─────────────────────────────────────────────────────────────
export function refreshPanelPJ() {
    const nombre = estadoUI.pjSeleccionado;
    if (!nombre || !estadoUI.panelAbierto) return;
    _renderHeader(nombre);
    const tab = _tabActivo[nombre] || 'stats';
    if (tab === 'stats') {
        const hexBody = document.getElementById('ppj-hex-body');
        if (hexBody) _tabHex(nombre, hexBody);
        const statsBody = document.getElementById('ppj-stats-body');
        if (statsBody) { const _sy = statsBody.scrollTop; statsBody.innerHTML = _tabStats(nombre); if (_sy > 0) statsBody.scrollTop = _sy; }
    }
}

// ─────────────────────────────────────────────────────────────
// TOGGLE CONOCIDO (visibilidad pública del hechizo)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// BOTONES "NUEVO HECHIZO" — modo inventario (PJ) y catálogo
// ─────────────────────────────────────────────────────────────
window._ppjNuevoHechizoPj = (nombrePJ) => {
    if (!estadoUI.esAdmin) return;
    if (typeof window._pmhCrearNodoParaEditor === 'function') {
        window._pmhCrearNodoParaEditor();
    }
    window._ppjAbrirEditorHz(null, nombrePJ, 'inv');
};

window._ppjNuevoHechizoCat = (nombrePJ) => {
    if (!estadoUI.esAdmin) return;
    if (typeof window._pmhCrearNodoParaEditor === 'function') {
        window._pmhCrearNodoParaEditor();
    }
    window._ppjAbrirEditorHz(null, nombrePJ, 'cat');
};

window._ppjToggleConocido = async (hechizo_id, nuevoValor, nombrePJ) => {
    if (!estadoUI.esAdmin) return;
    const { error } = await supabase.from('hechizos_nodos')
        .update({ es_conocido: nuevoValor })
        .eq('hechizo_id', hechizo_id);
    if (error) { console.error('Toggle conocido:', error); return; }
    // Re-renderizar pestaña
    const body = document.getElementById('ppj-body');
    if (body) _tabHechizos(nombrePJ, body);
};

// ─────────────────────────────────────────────────────────────
// EDITOR DE HECHIZO (crear / editar)
// modo: 'inv' = desde inventario del pj (asigna al pj y pone es_conocido=true)
//       'cat' = desde grimorio (no asigna, es_conocido=false por defecto)
// ─────────────────────────────────────────────────────────────
window._ppjAbrirEditorHz = async (hechizo_id, nombrePJ, modo) => {
    if (!estadoUI.esAdmin) return;

    // ── Consumir el nodo temporal del mapa (si lo hay) ──────────
    const tempNodo = window._pmhNodoTempActual || null;
    window._pmhNodoTempActual = null;
    window._ppjHzTempMapNodeId = tempNodo?.id || null;

    const body = document.getElementById('ppj-body');
    if (!body) return;
    body.innerHTML = `<div class="ppj-loader">Cargando editor…</div>`;

    // Cargar datos del hechizo existente
    let nodo = null;
    let stringsEntrada = []; // nodos que apuntan a este (precedentes)
    let stringsSalida  = []; // nodos a los que este apunta (salientes)
    if (hechizo_id) {
        const { data: nd } = await supabase.from('hechizos_nodos')
            .select('*').eq('hechizo_id', hechizo_id).single();
        nodo = nd;
        const { data: strsIn } = await supabase.from('hechizos_strings')
            .select('source_id').eq('target_id', hechizo_id);
        stringsEntrada = (strsIn || []).map(s => s.source_id);
        const { data: strsOut } = await supabase.from('hechizos_strings')
            .select('target_id').eq('source_id', hechizo_id);
        stringsSalida = (strsOut || []).map(s => s.target_id);
    }

    const { data: todosNodos } = await supabase.from('hechizos_nodos')
        .select('hechizo_id, nombre, afinidad, clase').order('nombre');
    const nodosList = (todosNodos || []).filter(n => n.hechizo_id !== hechizo_id);

    // ── ID automático: encontrar el primer hueco ordinal ────────
    let idSugerido = '';
    if (!hechizo_id) {
        const existentes = (todosNodos || []).map(n => n.hechizo_id);
        let num = 1;
        while (existentes.includes(`Hechizo ${num}`)) num++;
        idSugerido = `Hechizo ${num}`;
    }

    const esNuevo = !hechizo_id;
    const titulo  = esNuevo ? 'Nuevo hechizo' : `Editar · ${nodo?.nombre || hechizo_id}`;
    const esCon   = nodo ? nodo.es_conocido : (modo === 'inv');
    const asigPj  = esNuevo && modo === 'inv';

    let strsEntSel = [...stringsEntrada];
    let strsSalSel = [...stringsSalida];

    // ── Helper: id activo (real o temporal) ─────────────────────
    const _currentId = () => hechizo_id || window._ppjHzTempMapNodeId;

    const _renderStrTags = () => {
        // Entrada
        const wrapIn = document.getElementById('ppj-hz-str-wrap-in');
        if (wrapIn) {
            const tagsIn = strsEntSel.map(sid => {
                const nd = nodosList.find(n => n.hechizo_id === sid);
                const lbl = nd ? nd.nombre : sid;
                return `<span class="ppj-hz-str-tag">${lbl}<span class="rm" onclick="window._ppjHzRemoveStrIn('${sid}')">✕</span></span>`;
            }).join('');
            const dispIn = nodosList.filter(n => !strsEntSel.includes(n.hechizo_id));
            const optsIn = dispIn.map(n =>
                `<option value="${n.hechizo_id}">${n.nombre} (${n.afinidad||'?'} · Cl.${n.clase||'?'})</option>`
            ).join('');
            wrapIn.innerHTML = tagsIn + `
                <select class="ppj-hz-str-add" onchange="window._ppjHzAddStrIn(this.value); this.value=''">
                    <option value="">＋ Agregar precedente…</option>
                    ${optsIn}
                </select>`;
        }
        // Salida
        const wrapOut = document.getElementById('ppj-hz-str-wrap-out');
        if (wrapOut) {
            const tagsOut = strsSalSel.map(sid => {
                const nd = nodosList.find(n => n.hechizo_id === sid);
                const lbl = nd ? nd.nombre : sid;
                return `<span class="ppj-hz-str-tag">${lbl}<span class="rm" onclick="window._ppjHzRemoveStrOut('${sid}')">✕</span></span>`;
            }).join('');
            const dispOut = nodosList.filter(n => !strsSalSel.includes(n.hechizo_id));
            const optsOut = dispOut.map(n =>
                `<option value="${n.hechizo_id}">${n.nombre} (${n.afinidad||'?'} · Cl.${n.clase||'?'})</option>`
            ).join('');
            wrapOut.innerHTML = tagsOut + `
                <select class="ppj-hz-str-add" onchange="window._ppjHzAddStrOut(this.value); this.value=''">
                    <option value="">＋ Agregar saliente…</option>
                    ${optsOut}
                </select>`;
        }
    };

    // ── Funciones con sincronización bidireccional con el mapa ──
    window._ppjHzAddStrIn = (sid) => {
        if (!sid || strsEntSel.includes(sid)) return;
        strsEntSel.push(sid);
        _renderStrTags();
        // Sincronizar flecha en el mapa
        if (_currentId() && window._pmhAgregarEnlaceVisual)
            window._pmhAgregarEnlaceVisual(sid, _currentId());
    };
    window._ppjHzRemoveStrIn = (sid) => {
        strsEntSel = strsEntSel.filter(s => s !== sid);
        _renderStrTags();
        // Quitar flecha en el mapa
        if (_currentId() && window._pmhEliminarEnlaceVisual)
            window._pmhEliminarEnlaceVisual(sid, _currentId());
    };
    window._ppjHzAddStrOut = (sid) => {
        if (!sid || strsSalSel.includes(sid)) return;
        strsSalSel.push(sid);
        _renderStrTags();
        // Sincronizar flecha en el mapa
        if (_currentId() && window._pmhAgregarEnlaceVisual)
            window._pmhAgregarEnlaceVisual(_currentId(), sid);
    };
    window._ppjHzRemoveStrOut = (sid) => {
        strsSalSel = strsSalSel.filter(s => s !== sid);
        _renderStrTags();
        // Quitar flecha en el mapa
        if (_currentId() && window._pmhEliminarEnlaceVisual)
            window._pmhEliminarEnlaceVisual(_currentId(), sid);
    };

    // Exponer estado para guardar (fix: _ppjHzStrsSel nunca estaba definida)
    window._ppjHzStrsSel  = () => strsEntSel;
    window._ppjHzGetStrs  = () => ({ entrada: strsEntSel, salida: strsSalSel });
    window._ppjHzIdOriginal = hechizo_id;

    // Sincronización mapa → editor (cuando el usuario dibuja una flecha en el mapa)
    window._ppjHzSyncEnlaceFromMap = (sourceId, targetId) => {
        const cid = _currentId();
        if (!cid) return;
        if (targetId === cid && !strsEntSel.includes(sourceId)) {
            strsEntSel.push(sourceId); _renderStrTags();
        }
        if (sourceId === cid && !strsSalSel.includes(targetId)) {
            strsSalSel.push(targetId); _renderStrTags();
        }
    };

    const safePJ = nombrePJ.replace(/'/g, "\\'");

    // Banner de asignación (solo para modo inventario al crear)
    const noticeInv = esNuevo && modo === 'inv' ? `
    <div class="ppj-hz-assign-notice">
        <span class="ppj-hz-assign-icon">✨</span>
        <div>
            <div class="ppj-hz-assign-title">Asignar a ${nombrePJ}</div>
            <div class="ppj-hz-assign-sub">Este hechizo será creado y añadido directamente al inventario del personaje sin coste de HEX.</div>
        </div>
    </div>` : '';

    // Botón eliminar solo en modo edición
    const btnEliminar = !esNuevo ? `
        <button class="ppj-hz-btn-danger" style="flex:1;"
            onclick="window._ppjEliminarHz('${(hechizo_id||'').replace(/'/g,"\\'")}','${safePJ}')">
            🗑 Eliminar hechizo
        </button>` : '';

    body.innerHTML = `
    <div style="padding:14px 16px 80px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <button class="ppj-ctrl-btn" style="font-size:0.9em;width:28px;height:28px;"
                onclick="window._ppjVolverHechizos('${safePJ}')">←</button>
            <span style="font-family:'Cinzel',serif;color:#d4af37;font-size:0.85em;letter-spacing:1px;">${titulo}</span>
        </div>

        ${noticeInv}

        <div class="ppj-hz-modal-row">
            <div>
                <label class="ppj-hz-inline-label">ID único</label>
                <input class="ppj-hz-inline-input" id="hze-id" value="${nodo?.hechizo_id || idSugerido}" placeholder="${idSugerido}" ${!esNuevo?'readonly':''}>
            </div>
            <div>
                <label class="ppj-hz-inline-label">Nombre visible</label>
                <input class="ppj-hz-inline-input" id="hze-nombre" value="${nodo?.nombre||''}" placeholder="Nombre del hechizo">
            </div>
        </div>
        <div class="ppj-hz-modal-row" style="margin-top:10px;">
            <div>
                <label class="ppj-hz-inline-label">Afinidad</label>
                <select class="ppj-hz-inline-input" id="hze-afinidad">
                    ${['Física','Energética','Espiritual','Mando','Psíquica','Oscura','Desconocida'].map(a =>
                        `<option ${(nodo?.afinidad||'')==a?'selected':''}>${a}</option>`
                    ).join('')}
                </select>
            </div>
            <div>
                <label class="ppj-hz-inline-label">Clase</label>
                <select class="ppj-hz-inline-input" id="hze-clase">
                    ${['1','2','3','4','5'].map(c =>
                        `<option value="${c}" ${(nodo?.clase||'1')==c?'selected':''}>${c}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div class="ppj-hz-modal-row" style="margin-top:10px;">
            <div>
                <label class="ppj-hz-inline-label">Costo HEX</label>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-hex');
                        i.value=Math.max(0,(parseInt(i.value)||0)-50);">−</button>
                    <input class="ppj-hz-inline-input" id="hze-hex" type="number" min="0" step="50" value="${nodo?.hex_cost||0}"
                        style="text-align:center;flex:1;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-hex');
                        i.value=(parseInt(i.value)||0)+50;">+</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;padding-top:20px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.75em;color:#888;">
                    <input type="checkbox" id="hze-conocido" ${esCon?'checked':''}>
                    Público (visible para todos)
                </label>
            </div>
        </div>

        <label class="ppj-hz-inline-label" style="margin-top:12px;">Resumen</label>
        <input class="ppj-hz-inline-input" id="hze-resumen" value="${(nodo?.resumen||'').replace(/"/g,'&quot;')}" placeholder="Descripción breve">

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Efecto</label>
        <textarea class="ppj-hz-inline-input" id="hze-efecto" style="resize:vertical;min-height:70px;">${nodo?.efecto||''}</textarea>

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Overcast (100%)</label>
        <input class="ppj-hz-inline-input" id="hze-overcast" value="${(nodo?.overcast||'').replace(/"/g,'&quot;')}">

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Undercast (50%)</label>
        <input class="ppj-hz-inline-input" id="hze-undercast" value="${(nodo?.undercast||'').replace(/"/g,'&quot;')}">

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Especial</label>
        <input class="ppj-hz-inline-input" id="hze-especial" value="${(nodo?.especial||'').replace(/"/g,'&quot;')}">

        <div class="ppj-hz-modal-row" style="margin-top:10px;">
            <div>
                <label class="ppj-hz-inline-label">⬡ Valor VEX</label>
                <input class="ppj-hz-inline-input" id="hze-valor-vex" type="number" min="0" step="1"
                    value="${nodo?.valor_vex??0}" style="text-align:center;">
            </div>
            <div>
                <label class="ppj-hz-inline-label">📌 Nota</label>
                <input class="ppj-hz-inline-input" id="hze-nota" value="${(nodo?.nota||'').replace(/"/g,'&quot;')}" placeholder="Nota visible en el stack">
            </div>
        </div>

        <!-- ── BACKCAST / NEXTCAST ── -->
        <div class="ppj-hz-modal-row" style="margin-top:14px;">
            <div>
                <label class="ppj-hz-inline-label">⟵ Backcast</label>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-backcast');
                        i.value=Math.max(0,(parseInt(i.value)||0)-1);">−</button>
                    <input class="ppj-hz-inline-input" id="hze-backcast" type="number" min="0" step="1"
                        value="${nodo?.backcast??0}" style="text-align:center;flex:1;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-backcast');
                        i.value=(parseInt(i.value)||0)+1;">+</button>
                </div>
                <div style="font-size:0.62em;color:#3a3a5a;margin-top:3px;">Hechizos previos que afecta</div>
            </div>
            <div>
                <label class="ppj-hz-inline-label">Nextcast ⟶</label>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-nextcast');
                        i.value=Math.max(0,(parseInt(i.value)||0)-1);">−</button>
                    <input class="ppj-hz-inline-input" id="hze-nextcast" type="number" min="0" step="1"
                        value="${nodo?.nextcast??0}" style="text-align:center;flex:1;">
                    <button class="ppj-ctrl-btn" style="padding:4px 8px;font-size:1em;" onclick="
                        const i=document.getElementById('hze-nextcast');
                        i.value=(parseInt(i.value)||0)+1;">+</button>
                </div>
                <div style="font-size:0.62em;color:#3a3a5a;margin-top:3px;">Hechizos siguientes que afecta</div>
            </div>
        </div>

        <!-- ── TIPO: normal vs estado / prioridad ── -->
        <div style="margin-top:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <label style="font-size:0.65em;color:#5a5a78;text-transform:uppercase;letter-spacing:1px;">Tipo</label>
            <label class="ppj-hz-toggle-wrap">
                <input type="checkbox" id="hze-es-estado" ${nodo?.es_estado?'checked':''}>
                <span class="ppj-hz-toggle-slider"></span>
                <span class="ppj-hz-toggle-label" id="hze-es-estado-lbl">${nodo?.es_estado?'⬛ Hechizo-Estado':'⬤ Hechizo Normal'}</span>
            </label>
            <label class="ppj-hz-toggle-wrap">
                <input type="checkbox" id="hze-es-prioridad" ${nodo?.es_prioridad?'checked':''}>
                <span class="ppj-hz-toggle-slider" style="background:${nodo?.es_prioridad?'rgba(100,180,255,0.2)':'rgba(255,255,255,0.08)'};"></span>
                <span class="ppj-hz-toggle-label" id="hze-es-prioridad-lbl" style="color:${nodo?.es_prioridad?'#6eb4ff':'#888'};">${nodo?.es_prioridad?'⚡ Prioridad':'— Sin prioridad'}</span>
            </label>
        </div>

        <!-- ── OBJETIVOS AFECTADOS ── -->
        <div style="margin-top:14px;">
            <label class="ppj-hz-inline-label">Afecta a…</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
                <label class="ppj-hz-check-wrap">
                    <input type="checkbox" id="hze-afecta-hechizos" ${nodo?.afecta_hechizos?'checked':''}>
                    <span class="ppj-hz-check-box"></span>
                    <span style="font-size:0.75em;color:#aaa;">🌀 Otros hechizos</span>
                </label>
                <label class="ppj-hz-check-wrap">
                    <input type="checkbox" id="hze-afecta-usuario" ${nodo?.afecta_usuario?'checked':''}>
                    <span class="ppj-hz-check-box"></span>
                    <span style="font-size:0.75em;color:#aaa;">🧙 Usuario del hechizo</span>
                </label>
                <label class="ppj-hz-check-wrap">
                    <input type="checkbox" id="hze-afecta-objetivo" ${nodo?.afecta_objetivo?'checked':''}>
                    <span class="ppj-hz-check-box"></span>
                    <span style="font-size:0.75em;color:#aaa;">🎯 Otros objetivos</span>
                </label>
            </div>
        </div>

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Precedentes — strings de entrada</label>
        <div class="ppj-hz-strings-wrap" id="ppj-hz-str-wrap-in"></div>

        <label class="ppj-hz-inline-label" style="margin-top:10px;">Salientes — strings de salida</label>
        <div class="ppj-hz-strings-wrap" id="ppj-hz-str-wrap-out"></div>

        <div style="display:flex;gap:8px;margin-top:20px;">
            <button class="ppj-hz-btn-cancel" style="flex:1;"
                onclick="window._ppjVolverHechizos('${safePJ}')">Cancelar</button>
            ${btnEliminar}
            <button class="ppj-hz-btn-save" style="flex:2;"
                onclick="window._ppjGuardarHz('${safePJ}',${JSON.stringify(asigPj)})">
                ${esNuevo ? '✨ Crear hechizo' : '💾 Guardar cambios'}
            </button>
        </div>
    </div>`;

    // Inyectar estilos inline si no existen
    // Siempre actualizar estilos (por si hay nueva versión)
    const stOld = document.getElementById('ppj-hz-inline-styles');
    if (stOld) stOld.remove();
    {
        const st = document.createElement('style');
        st.id = 'ppj-hz-inline-styles';
        st.textContent = `
.ppj-hz-inline-label{font-size:0.65em;color:#5a5a78;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;}
.ppj-hz-inline-input{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#ccc;padding:7px 10px;font-size:0.8em;box-sizing:border-box;outline:none;font-family:inherit;}
.ppj-hz-inline-input:focus{border-color:rgba(212,175,55,0.4);}
.ppj-hz-inline-input[readonly]{opacity:0.5;cursor:not-allowed;}
.ppj-hz-btn-save{background:rgba(212,175,55,0.15);color:#d4af37;border:1px solid rgba(212,175,55,0.4);border-radius:6px;padding:10px 18px;font-size:0.8em;font-family:'Cinzel',serif;cursor:pointer;transition:background 0.15s;}
.ppj-hz-btn-save:hover{background:rgba(212,175,55,0.28);}
.ppj-hz-btn-cancel{background:transparent;color:#5a5a78;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px 18px;font-size:0.8em;font-family:'Cinzel',serif;cursor:pointer;}
.ppj-hz-btn-cancel:hover{color:#888;border-color:rgba(255,255,255,0.2);}
.ppj-hz-toggle-wrap{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;}
.ppj-hz-toggle-wrap input{display:none;}
.ppj-hz-toggle-slider{width:36px;height:20px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0;}
.ppj-hz-toggle-slider::after{content:'';position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#555;transition:transform 0.2s,background 0.2s;}
.ppj-hz-toggle-wrap input:checked+.ppj-hz-toggle-slider{background:rgba(212,175,55,0.2);border-color:rgba(212,175,55,0.4);}
.ppj-hz-toggle-wrap input:checked+.ppj-hz-toggle-slider::after{transform:translateX(16px);background:#d4af37;}
.ppj-hz-toggle-label{font-size:0.78em;color:#888;transition:color 0.2s;}
.ppj-hz-toggle-wrap input:checked~.ppj-hz-toggle-label{color:#d4af37;}
.ppj-hz-check-wrap{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;}
.ppj-hz-check-wrap input{display:none;}
.ppj-hz-check-box{width:16px;height:16px;border:1px solid rgba(255,255,255,0.2);border-radius:3px;background:rgba(255,255,255,0.04);position:relative;flex-shrink:0;transition:border-color 0.15s,background 0.15s;}
.ppj-hz-check-box::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#d4af37;opacity:0;transition:opacity 0.15s;}
.ppj-hz-check-wrap input:checked+.ppj-hz-check-box{border-color:rgba(212,175,55,0.5);background:rgba(212,175,55,0.12);}
.ppj-hz-check-wrap input:checked+.ppj-hz-check-box::after{opacity:1;}
`;
        document.head.appendChild(st);
    }

    _renderStrTags();

    // Listener del toggle tipo hechizo-estado
    const toggleEstado = document.getElementById('hze-es-estado');
    const labelEstado  = document.getElementById('hze-es-estado-lbl');
    if (toggleEstado && labelEstado) {
        toggleEstado.addEventListener('change', () => {
            labelEstado.textContent = toggleEstado.checked ? '⬛ Hechizo-Estado' : '⬤ Hechizo Normal';
        });
    }

    // Listener del toggle prioridad
    const togglePrioridad = document.getElementById('hze-es-prioridad');
    const labelPrioridad  = document.getElementById('hze-es-prioridad-lbl');
    if (togglePrioridad && labelPrioridad) {
        togglePrioridad.addEventListener('change', () => {
            const on = togglePrioridad.checked;
            labelPrioridad.textContent = on ? '⚡ Prioridad' : '— Sin prioridad';
            labelPrioridad.style.color = on ? '#6eb4ff' : '#888';
            const slider = togglePrioridad.nextElementSibling;
            if (slider) slider.style.background = on ? 'rgba(100,180,255,0.2)' : 'rgba(255,255,255,0.08)';
        });
    }
};

// Volver a la tab de hechizos desde el editor inline
window._ppjVolverHechizos = (nombrePJ) => {
    const body = document.getElementById('ppj-body');
    if (body) _tabHechizos(nombrePJ, body);
};


window._ppjGuardarHz = async (nombrePJ, asignarAlPJ) => {
    if (!estadoUI.esAdmin) return;

    // Al editar, el campo ID es readonly → usar idOriginal directamente.
    // Al crear nuevo, limpiar solo espacios extremos (NO reemplazar internos: "Hechizo 6" debe quedar igual).
    const idOriginal = window._ppjHzIdOriginal;
    const idRaw  = document.getElementById('hze-id')?.value.trim() || '';
    const id     = idOriginal || idRaw;   // edición: idOriginal; creación: lo que escribió el usuario
    const nombre  = document.getElementById('hze-nombre')?.value.trim();
    const afinidad= document.getElementById('hze-afinidad')?.value;
    const clase   = document.getElementById('hze-clase')?.value;
    const hexCost = parseInt(document.getElementById('hze-hex')?.value) || 0;
    const conocido= document.getElementById('hze-conocido')?.checked;
    const resumen = document.getElementById('hze-resumen')?.value.trim();
    const efecto  = document.getElementById('hze-efecto')?.value.trim();
    const overcast= document.getElementById('hze-overcast')?.value.trim();
    const undercast=document.getElementById('hze-undercast')?.value.trim();
    const especial= document.getElementById('hze-especial')?.value.trim();

    const backcast  = parseInt(document.getElementById('hze-backcast')?.value) || 0;
    const nextcast  = parseInt(document.getElementById('hze-nextcast')?.value) || 0;
    const esEstado    = document.getElementById('hze-es-estado')?.checked || false;
    const esPrioridad = document.getElementById('hze-es-prioridad')?.checked || false;
    const afHechizos= document.getElementById('hze-afecta-hechizos')?.checked || false;
    const afUsuario = document.getElementById('hze-afecta-usuario')?.checked || false;
    const afObjetivo= document.getElementById('hze-afecta-objetivo')?.checked || false;
    const valorVex  = parseInt(document.getElementById('hze-valor-vex')?.value) || 0;
    const nota      = document.getElementById('hze-nota')?.value.trim() || '';

    // ── FIX: usar _ppjHzGetStrs() (antes _ppjHzStrsSel no estaba definida) ──
    const strs       = window._ppjHzGetStrs?.() || { entrada: [], salida: [] };
    const strsEntrada = strs.entrada;   // precedentes
    const strsSalida  = strs.salida;    // salientes

    if (!id || !nombre) { alert('El ID y el nombre son obligatorios.'); return; }

    // Incluir posición del nodo temporal del mapa (si existe) al crear
    const tempMapId = window._ppjHzTempMapNodeId;
    // Buscar el nodo en el mapa para obtener su posición actual
    const tempNodo = tempMapId && window._pmhGetNodo ? window._pmhGetNodo(tempMapId) : null;
    const payload = {
        hechizo_id: id, nombre, afinidad, clase,
        hex_cost: hexCost, es_conocido: conocido,
        resumen, efecto, overcast, undercast, especial,
        backcast, nextcast, es_estado: esEstado, es_prioridad: esPrioridad,
        afecta_hechizos: afHechizos,
        afecta_usuario:  afUsuario,
        afecta_objetivo: afObjetivo,
        valor_vex: valorVex,
        nota,
        ...((!idOriginal && tempNodo) ? { pos_x: Math.round(tempNodo.x), pos_y: Math.round(tempNodo.y) } : {}),
    };

    // Guardar nodo: UPDATE si es edición, INSERT si es nuevo
    let errNodo;
    if (idOriginal) {
        // Edición: update por hechizo_id original (nunca crea duplicado)
        ({ error: errNodo } = await supabase.from('hechizos_nodos')
            .update(payload)
            .eq('hechizo_id', idOriginal));
        // Si la posición fue modificada en el mapa, guardarla también
        if (!errNodo && tempNodo && tempNodo._dirty) {
            await supabase.from('hechizos_nodos')
                .update({ pos_x: Math.round(tempNodo.x), pos_y: Math.round(tempNodo.y) })
                .eq('hechizo_id', idOriginal);
            tempNodo._dirty = false;
        }
    } else {
        // Creación: insert nuevo
        ({ error: errNodo } = await supabase.from('hechizos_nodos')
            .insert(payload));
    }
    if (errNodo) { alert('Error guardando hechizo: ' + errNodo.message); return; }

    // ── FIX: guardar precedentes (strings de entrada) ───────────
    await supabase.from('hechizos_strings').delete().eq('target_id', id);
    if (strsEntrada.length > 0) {
        await supabase.from('hechizos_strings').insert(
            strsEntrada.map(src => ({ source_id: src, target_id: id }))
        );
    }

    // ── FIX: guardar salientes (strings de salida) — antes nunca se guardaban ──
    await supabase.from('hechizos_strings').delete().eq('source_id', id);
    if (strsSalida.length > 0) {
        await supabase.from('hechizos_strings').insert(
            strsSalida.map(tgt => ({ source_id: id, target_id: tgt }))
        );
    }

    // Si viene desde inventario del PJ → asignar el hechizo gratis
    if (asignarAlPJ && nombrePJ) {
        const yaAsig = await supabase.from('hechizos_inventario')
            .select('id').eq('personaje_nombre', nombrePJ).eq('hechizo_nombre', nombre).single();
        if (!yaAsig.data) {
            await supabase.from('hechizos_inventario').insert({
                personaje_nombre: nombrePJ,
                hechizo_nombre:   nombre,
                hechizo_afinidad: afinidad,
                hechizo_hex:      0,
                tipo:             'Normal',
                origen:           'Editor OP'
            });
        }
    }

    // ── Sincronizar el mapa: quitar nodo temporal + recargar datos reales ──
    const tempId = window._ppjHzTempMapNodeId;
    window._ppjHzTempMapNodeId = null;
    if (tempId && typeof window._pmhEliminarNuevo === 'function') {
        window._pmhEliminarNuevo(tempId);
    }
    if (typeof window._pmhRecargar === 'function') {
        await window._pmhRecargar();
        // Centrar el mapa en el hechizo recién guardado
        if (typeof window.centrarEnHechizo === 'function') {
            setTimeout(() => window.centrarEnHechizo(id), 400);
        }
    }

    window._ppjVolverHechizos(nombrePJ);
};
