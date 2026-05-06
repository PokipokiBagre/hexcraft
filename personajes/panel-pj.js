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

// ── Helpers ───────────────────────────────────────────────────
const _sb   = () => currentConfig.storageUrl;
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';

const _imgPj   = (icono) => `${_sb()}/imgpersonajes/${_norm(icono)}.png`;
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
#panel-pj-root{position:fixed;top:0;right:0;width:440px;height:100vh;background:#08080f;border-left:1px solid rgba(212,175,55,0.18);display:flex;flex-direction:column;z-index:1200;transform:translateX(100%);transition:transform 0.28s cubic-bezier(0.4,0,0.2,1),width 0.28s cubic-bezier(0.4,0,0.2,1);font-family:'Inter',system-ui,sans-serif;box-shadow:-8px 0 40px rgba(0,0,0,0.6);}
#panel-pj-root.open{transform:translateX(0);}
#panel-pj-root.hz-mode{width:50vw;min-width:480px;}
#panel-pj-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1199;opacity:0;pointer-events:none;transition:opacity 0.28s;}
#panel-pj-overlay.open{opacity:1;pointer-events:all;}
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
.ppj-hpush-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px 8px;text-align:center;}
.ppj-hpush-card.available{border-color:rgba(212,175,55,0.3);}
.ppj-hpush-label{font-size:0.64em;color:#5a5a78;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;}
.ppj-hpush-amt{font-size:1em;font-weight:700;color:#d4af37;font-family:'Cinzel',serif;margin-bottom:4px;}
.ppj-hpush-cd{font-size:0.6em;color:#4a4a68;margin-bottom:6px;min-height:14px;}
.ppj-hpush-btn{width:100%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:5px;color:#d4af37;font-size:0.68em;font-weight:700;padding:5px 4px;cursor:pointer;transition:background 0.15s;font-family:'Cinzel',serif;}
.ppj-hpush-btn:hover:not(:disabled){background:rgba(212,175,55,0.22);}
.ppj-hpush-btn:disabled{opacity:0.35;cursor:default;}
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
.ppj-obj-search::placeholder{color:#3a3a58;}
.ppj-obj-card{background:rgba(255,255,255,0.02);border-radius:7px;border:1px solid rgba(255,255,255,0.04);padding:10px 12px;margin-bottom:6px;}
.ppj-obj-card.equipado{border-color:rgba(212,175,55,0.2);background:rgba(212,175,55,0.03);}
.ppj-obj-header{display:flex;align-items:center;gap:8px;}
.ppj-obj-cant{font-size:0.8em;font-weight:700;color:#d4af37;min-width:28px;text-align:center;}
.ppj-obj-nombre{font-size:0.82em;color:#ccc;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ppj-obj-rar{font-size:0.6em;font-weight:700;padding:1px 6px;border-radius:3px;flex-shrink:0;}
.ppj-obj-det{font-size:0.7em;color:#5a5a78;margin-top:4px;line-height:1.4;}
.ppj-obj-footer{display:flex;align-items:center;justify-content:space-between;margin-top:7px;}
.ppj-obj-tipo{font-size:0.62em;color:#4a4a68;}
.ppj-eqp-btn{font-size:0.65em;font-weight:700;padding:3px 10px;border-radius:10px;cursor:pointer;border:1px solid;transition:background 0.15s;}
.ppj-eqp-btn.on{background:rgba(212,175,55,0.1);color:#d4af37;border-color:rgba(212,175,55,0.3);}
.ppj-eqp-btn.off{background:rgba(255,255,255,0.03);color:#4a4a68;border-color:rgba(255,255,255,0.06);}
.ppj-obj-seccion-titulo{font-size:0.62em;letter-spacing:1.5px;text-transform:uppercase;color:#3a3a58;font-weight:600;margin:12px 0 6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);}
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
.ppj-footer{position:absolute;bottom:0;left:0;right:0;padding:10px 16px;background:linear-gradient(to top,#08080f 70%,transparent);display:flex;gap:8px;flex-shrink:0;}
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
    root.innerHTML = `<div class="ppj-header" id="ppj-header"></div><div class="ppj-tabs" id="ppj-tabs"></div><div class="ppj-body" id="ppj-body"></div><div class="ppj-footer" id="ppj-footer"></div>`;
    document.body.appendChild(root);
}

// ─────────────────────────────────────────────────────────────
// ABRIR / CERRAR
// ─────────────────────────────────────────────────────────────
export function abrirPanelPJ(nombre) {
    _crearEstructura();
    estadoUI.pjSeleccionado = nombre;
    estadoUI.panelAbierto   = true;
    document.getElementById('panel-pj-root').classList.add('open');
    document.getElementById('panel-pj-overlay').classList.add('open');
    _renderHeader(nombre);
    _renderTabs(nombre);
    _renderTab(nombre, _tabActivo[nombre] || 'hex');
}

export function cerrarPanelPJ() {
    estadoUI.panelAbierto = false;
    document.getElementById('panel-pj-root')?.classList.remove('open');
    document.getElementById('panel-pj-root')?.classList.remove('hz-mode');
    document.getElementById('panel-pj-overlay')?.classList.remove('open');
    cerrarMinimapa();
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
        { id:'hex', label:'HEX' }, { id:'stats', label:'Stats' },
        { id:'hechizos', label:'Hechizos' }, { id:'objetos', label:'Objetos' },
        ...( p.isPlayer ? [{ id:'misiones', label:'Misiones' }] : [] )
    ];
    document.getElementById('ppj-tabs').innerHTML = tabs.map(t =>
        `<button class="ppj-tab ${(_tabActivo[nombre]||'hex')===t.id?'active':''}"
                 onclick="window._ppjCambiarTab('${nombre.replace(/'/g,"\\'")}','${t.id}')">${t.label}</button>`
    ).join('');
}

function _renderTab(nombre, tab) {
    _tabActivo[nombre] = tab;
    document.querySelectorAll('.ppj-tab').forEach(b =>
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${tab}'`))
    );
    const body = document.getElementById('ppj-body');
    body.innerHTML = `<div class="ppj-loader">Cargando…</div>`;

    // Cerrar minimapa si cambiamos a otro tab
    if (tab !== 'hechizos') {
        cerrarMinimapa();
        document.getElementById('panel-pj-root')?.classList.remove('hz-mode');
    } else {
        document.getElementById('panel-pj-root')?.classList.add('hz-mode');
    }

    switch(tab) {
        case 'hex':      _tabHex(nombre, body);               break;
        case 'stats':    body.innerHTML = _tabStats(nombre);  break;
        case 'hechizos': _tabHechizosConMapa(nombre, body);   break;
        case 'objetos':  _tabObjetos(nombre, body);            break;
        case 'misiones': _tabMisiones(nombre, body);           break;
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

        // Buscar en hechizos aprendidos primero
        const invCard = document.querySelector(`[data-hz-nombre="${(nodo.nombre||'').toLowerCase()}"]`);
        if (invCard) {
            // Abrir su acordeón padre si está cerrado
            const accPadre = invCard.closest('.ppj-af-acc, .ppj-cl-acc');
            if (accPadre) _abrirAcc(accPadre);
            setTimeout(() => _flash(invCard), 80);
            return;
        }

        // Buscar en grimorio completo
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
        <div class="ppj-hpush-card ${disp?'available':''}">
            <div class="ppj-hpush-label">${label}</div>
            <div class="ppj-hpush-amt">${typeof monto==='string'?monto:('+'+monto.toLocaleString())}</div>
            <div class="ppj-hpush-cd">${cdTxt}</div>
            ${estadoUI.esAdmin && tipo!=='contenido' ? `
                <button class="ppj-hpush-btn" ${disp?'':'disabled'}
                    onclick="window._ppjEjecutarHexPush('${safe}','${tipo}',${monto})">Otorgar</button>` : ''}
            ${estadoUI.esAdmin && tipo==='contenido' ? `
                <div class="ppj-contenido-row">
                    <input class="ppj-contenido-input" id="ppj-cv-${_norm(nombre)}" type="number" value="500" min="100" max="1000" step="100">
                    <button class="ppj-hpush-btn" ${disp?'':'disabled'}
                        onclick="window._ppjEjecutarHexPush('${safe}','contenido',parseInt(document.getElementById('ppj-cv-${_norm(nombre)}')?.value)||500)">OK</button>
                </div>` : ''}
        </div>`;

    const _tCls = { asistencia:'hlog-asistencia', turno_extra:'hlog-turno_extra', contenido:'hlog-contenido' };
    const _tLbl = { asistencia:'Asistencia', turno_extra:'Turno extra', contenido:'Contenido' };

    const histHTML = historial.length===0
        ? `<div class="ppj-empty" style="padding:8px 0;"><div class="ppj-empty-icon" style="font-size:1em;">📋</div>Sin registros</div>`
        : historial.map(h => `<div class="ppj-hlog-item">
            <span class="ppj-hlog-tipo ${_tCls[h.tipo]||''}">${_tLbl[h.tipo]||h.tipo}</span>
            <span class="ppj-hlog-amt">+${h.cantidad.toLocaleString()}</span>
            <div class="ppj-hlog-meta">
                <div class="ppj-hlog-time" title="${new Date(h.created_at).toUTCString()}">${_tiempoRelativo(h.created_at)}</div>
                ${h.nota?`<div class="ppj-hlog-nota">${h.nota}</div>`:''}
            </div>
            ${estadoUI.esAdmin?`<button class="ppj-hlog-del" onclick="window._ppjDeleteHexLog(${h.id},'${safe}')">✕</button>`:''}
        </div>`).join('');

    const deltas = [1000,500,300,100,50,10,5,1];
    const btnsN = deltas.map(d=>canEdit?`<button class="ppj-hex-btn neg" onclick="window.modStat('${safe}','hex',${-d})">−${d}</button>`:'').join('');
    const btnsP = deltas.map(d=>canEdit?`<button class="ppj-hex-btn" onclick="window.modStat('${safe}','hex',${d})">+${d}</button>`:'').join('');

    body.innerHTML = `
    <div class="ppj-section">
        <div class="ppj-section-title">Saldo HEX</div>
        <div class="ppj-hex-val">${(p.hex||0).toLocaleString()}</div>
        ${canEdit?`<div class="ppj-hex-grid">${btnsN}</div><div class="ppj-hex-grid" style="margin-top:5px;">${btnsP}</div>`:''}
    </div>
    ${estadoUI.esAdmin?`<div class="ppj-section">
        <div class="ppj-section-title">Pushes de HEX</div>
        <div class="ppj-hpush-grid">
            ${_pushCard('asistencia','Asistencia',300,cdA>=24,_cdRest(cdA,24)+' · diario')}
            ${_pushCard('turno_extra','Turno Extra',500,cdT>=72,_cdRest(cdT,72)+' · c/3 días')}
            ${_pushCard('contenido','Contenido','100–1000',cdC>=72,_cdRest(cdC,72)+' · c/3 días')}
        </div>
    </div>`:''}
    <div class="ppj-section">
        <div class="ppj-section-title">Historial de pushes</div>
        ${histHTML}
    </div>
    <div class="ppj-section">
        <div class="ppj-section-title">Imagen del personaje</div>
        <div class="ppj-img-wrap" onclick="window.abrirSubirImagen('${safe}')">
            <img class="ppj-img-preview" src="${_imgPj(p.iconoOverride||nombre)}"
                 onerror="if(this.src!=='${_fallback()}')this.src='${_fallback()}'">
            ${(estadoUI.esAdmin||!p.isPlayer)?`<div class="ppj-img-overlay">📷 Cambiar imagen</div>`:''}
        </div>
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

    const _maxOv = (label, campo, ov, fm) => {
        if (!estadoUI.esAdmin) return '';
        const uF = ov===0;
        return `<div class="ppj-max-row">
            <span class="ppj-max-label">Máx ${label}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campo}',-1)">−</button>
            <span class="ppj-max-val ${uF?'formula':'manual'}">${fm}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campo}',1)">+</button>
            ${!uF?`<button class="ppj-ctrl-btn" onclick="window.resetStatMax('${safe}','${campo}')">↺</button>`:''}
            <span class="ppj-hint ${uF?'':'manual'}">${uF?'fórmula':'manual'}</span>
        </div>`;
    };

    const _push = (recurso, label, emoji) => {
        const hasMax = recurso==='vex'?s.vex_max>0:s.guarda_max>0; if (!hasMax) return '';
        const disp = calcularPushDisponibles(p, s, recurso);
        const usados = recurso==='vex'?(p.push_vex_actual||0):(p.push_guarda_actual||0);
        const rest = Math.max(0, disp-usados);
        const val = calcularValorPush(p, recurso);
        const cd = calcularCooldownPush(p, recurso);
        const canPush = rest>0 && cd.disponible;
        const dots = Array.from({length:Math.max(disp,1)},(_,i)=>
            `<span class="ppj-dot ${i<usados?'used':'avail'}"></span>`).join('');
        const cdTxt = !cd.disponible
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

    const pctVex = s.vex_max>0?Math.min(100,Math.round((p.vex_actual||0)/s.vex_max*100)):0;

    return `
    <div class="ppj-section">
        <div class="ppj-section-title">Recursos vitales</div>
        ${_vida('Vida Roja','vida_roja_actual',p.vida_roja_actual||0,s.vida_roja_max,'vida','#d4af37',26)}
        ${_maxOv('Vida Roja','vida_roja_max_override',p.vida_roja_max_override||0,s.vida_roja_max)}
        <div class="ppj-formula">${formulas.vida_roja_max?.expr||''}</div>
        ${s.vida_azul_max>0?`${_vida('Vida Azul','vida_azul_actual',s.vida_azul_actual,s.vida_azul_max,'azul','#4ab3e8',26)}<div class="ppj-formula">${formulas.vida_azul_max?.expr||''}</div>`:''}
        ${s.guarda_max>0?`${_vida('Guarda Dorada','guarda_actual',p.guarda_actual||0,s.guarda_max,'guarda','#d4af37',20)}${_maxOv('Guarda','guarda_max_override',p.guarda_max_override||0,s.guarda_max)}<div class="ppj-formula">${formulas.guarda_max?.expr||''}</div>`:''}
        ${s.vex_max>0?`<div class="ppj-vida-block">
            <div class="ppj-vida-header"><span class="ppj-vida-label" style="color:#9a50dc;">VEX</span>
                <div class="ppj-vida-ctrl">
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',-50)">−50</button>`:''}
                    <span class="ppj-vida-xy"><span class="actual" style="color:#9a50dc;">${Math.floor(p.vex_actual||0)}</span><span class="sep">/</span><span class="maximo">${s.vex_max}</span></span>
                    ${canEdit?`<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',50)">+50</button>`:''}
                </div>
            </div><div class="ppj-vex-bar"><div class="ppj-vex-fill" style="width:${pctVex}%"></div></div>
        </div><div class="ppj-formula">${esJugador?(formulas.vex_max?.expr||''):'Fijo (NPC sistema)'}</div>`:''}
    </div>
    <div class="ppj-section"><div class="ppj-section-title">Pushes</div>
        ${_push('vex','VEX','⚡')}${_push('guarda','Guarda','🛡')}
        ${!s.vex_max&&!s.guarda_max?'<div class="ppj-empty" style="padding:8px 0;">Sin pushes disponibles</div>':''}
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
            .select('nombre, afinidad, clase, resumen, efecto, overcast, undercast, especial, hex_cost, es_conocido, hechizo_id, backcast, nextcast, es_estado, es_prioridad, afecta_hechizos, afecta_usuario, afecta_objetivo')
            .in('nombre', hNombres);
        (nd||[]).forEach(n => { nodosMapInv[n.nombre] = n; });
    }

    // ── Catálogo completo ────────────────────────────────────────
    const { data: catalogo } = await supabase.from('hechizos_nodos')
        .select('id, nombre, hechizo_id, afinidad, clase, resumen, efecto, overcast, undercast, especial, hex_cost, es_conocido, backcast, nextcast, es_estado, es_prioridad, afecta_hechizos, afecta_usuario, afecta_objetivo')
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
                ${hexInv}${clsBadge}
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
                    ${hexBadgeCat}${clsBadgeCat}
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
// TAB: OBJETOS
// ─────────────────────────────────────────────────────────────
async function _tabObjetos(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando objetos…</div>';

    const { data: items } = await supabase
        .from('inventario_objetos')
        .select('objeto_nombre, cantidad, equipado')
        .eq('personaje_nombre', nombre)
        .gt('cantidad', 0);

    const lista = items || [];
    if (lista.length === 0) {
        body.innerHTML = `<div class="ppj-section"><div class="ppj-empty"><div class="ppj-empty-icon">🎒</div>Inventario vacío</div></div>`;
        return;
    }

    const nombres = lista.map(i => i.objeto_nombre);
    const { data: defs } = await supabase.from('objetos')
        .select('nombre, tipo, rareza, efecto, descripcion, vida_roja, vida_azul, contenedor_padre')
        .in('nombre', nombres);
    const defMap = {}; (defs||[]).forEach(o => { defMap[o.nombre] = o; });

    // Contenidos de contenedores
    const contenedores = lista.filter(i => defMap[i.objeto_nombre]?.tipo==='Contenedor').map(i=>i.objeto_nombre);
    const contenidoMap = {};
    if (contenedores.length > 0) {
        const { data: cont } = await supabase.from('objetos')
            .select('nombre, contenedor_padre').in('contenedor_padre', contenedores);
        (cont||[]).forEach(c => {
            if (!contenidoMap[c.contenedor_padre]) contenidoMap[c.contenedor_padre] = [];
            contenidoMap[c.contenedor_padre].push(c.nombre);
        });
    }

    const sorted = [...lista].sort((a,b) => {
        if (a.equipado!==b.equipado) return b.equipado-a.equipado;
        return _rarOrd(defMap[b.objeto_nombre]?.rareza) - _rarOrd(defMap[a.objeto_nombre]?.rareza);
    });

    const safe = nombre.replace(/'/g,"\\'");
    const EQUIPABLES = ['Equipamiento','Accesorio','Vehículo','Vehiculo'];

    const _renderObj = (item) => {
        const def = defMap[item.objeto_nombre] || {};
        const isEqp = item.equipado;
        const rarCol = _rarColor(def.rareza);
        const tipo = def.tipo || '-';
        const safeObj = item.objeto_nombre.replace(/'/g,"\\'");
        const esContenedor = tipo==='Contenedor';
        const esVehiculo   = tipo==='Vehículo'||tipo==='Vehiculo';
        const puedeEquipar = EQUIPABLES.includes(tipo);
        const contenidos   = contenidoMap[item.objeto_nombre] || [];

        return `<div class="ppj-obj-card ${isEqp?'equipado':''}" data-nombre="${item.objeto_nombre.toLowerCase()}">
            <div class="ppj-obj-header">
                <span class="ppj-obj-cant">×${item.cantidad}</span>
                <span class="ppj-obj-nombre" title="${item.objeto_nombre}">${item.objeto_nombre}</span>
                <span class="ppj-obj-rar" style="background:${rarCol}22;color:${rarCol};border:1px solid ${rarCol}44;">${def.rareza||'-'}</span>
            </div>
            ${def.efecto?`<div class="ppj-obj-det">${def.efecto}</div>`:''}
            ${esVehiculo?`<div class="ppj-obj-vehiculo">
                ${(def.vida_roja||0)>0?`<span class="ppj-obj-vida-pill ppj-obj-vida-roja">❤ ${def.vida_roja}</span>`:''}
                ${(def.vida_azul||0)>0?`<span class="ppj-obj-vida-pill ppj-obj-vida-azul">💙 ${def.vida_azul}</span>`:''}
            </div>`:''}
            ${esContenedor&&contenidos.length>0?`<div class="ppj-contenedor-items">${contenidos.map(c=>`<div class="ppj-contenedor-item">• ${c}</div>`).join('')}</div>`:''}
            <div class="ppj-obj-footer">
                <span class="ppj-obj-tipo">${tipo}</span>
                ${puedeEquipar?`<button class="ppj-eqp-btn ${isEqp?'on':'off'}"
                    onclick="window._ppjToggleEquipar('${safe}','${safeObj}',${!isEqp})">
                    ${isEqp?'✓ Equipado':'Equipar'}</button>`:''}
            </div>
        </div>`;
    };

    const equipados    = sorted.filter(i=>i.equipado);
    const noEquipados  = sorted.filter(i=>!i.equipado);

    body.innerHTML = `<div class="ppj-section">
        <input class="ppj-obj-search" placeholder="Buscar objeto…" oninput="window._ppjFiltrarObjetos(this.value)">
        <div id="ppj-obj-lista">
            ${equipados.length?`<div class="ppj-obj-seccion-titulo">Equipados</div>${equipados.map(_renderObj).join('')}`:''}
            ${noEquipados.length?`<div class="ppj-obj-seccion-titulo">Inventario</div>${noEquipados.map(_renderObj).join('')}`:''}
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB: MISIONES
// ─────────────────────────────────────────────────────────────
async function _tabMisiones(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando misiones…</div>';
    const { data: misiones } = await supabase.from('misiones')
        .select('titulo, tipo, clase, estado, descripcion, cupos, jugadores').order('orden');

    const misP = (misiones||[]).filter(m=>(Array.isArray(m.jugadores)?m.jugadores:[]).includes(nombre));
    const misD = (misiones||[]).filter(m=>m.estado<3&&!(Array.isArray(m.jugadores)?m.jugadores:[]).includes(nombre));

    const _badge = (e) => `<span class="ppj-mis-badge ppj-mis-${e}">${['Inactiva','Pendiente','En Proceso','Finalizada'][e]||'?'}</span>`;
    const _card  = (m) => `<div class="ppj-mision-card">
        <div class="ppj-mis-header"><span class="ppj-mis-titulo">${m.titulo}</span><span class="ppj-mis-clase">C-${m.clase}</span></div>
        ${_badge(m.estado)}
        ${m.descripcion?`<div class="ppj-mis-desc">${m.descripcion.slice(0,130)}${m.descripcion.length>130?'…':''}</div>`:''}
    </div>`;

    if (!misP.length&&!misD.length) {
        body.innerHTML = `<div class="ppj-section"><div class="ppj-empty"><div class="ppj-empty-icon">📋</div>Sin misiones</div></div>`;
        return;
    }
    body.innerHTML = `
    ${misP.length?`<div class="ppj-section"><div class="ppj-section-title">Participando (${misP.length})</div>${misP.map(_card).join('')}</div>`:''}
    ${misD.length?`<div class="ppj-section"><div class="ppj-section-title">Disponibles (${misD.length})</div>${misD.map(_card).join('')}</div>`:''}`;
}

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


window._ppjSetCd = (nombre, afinKey, deltaP) => {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const actual = p[`cd_${afinKey}`] ?? 0.5;
    // deltaP es ±5 (puntos porcentuales). Convertir a decimal y clampear 10%–200%
    const v = Math.round(Math.max(0.1, Math.min(2.0, actual + deltaP / 100)) * 100) / 100;
    p[`cd_${afinKey}`] = v;
    encolarCambio(nombre, `cd_${afinKey}`, v);
    // Actualizar solo el span sin re-renderizar todo el panel
    const span = document.getElementById(`ppj-cd-${nombre}-${afinKey}`);
    if (span) span.textContent = `${(v * 100).toFixed(0)}%`;
    window.actualizarBtnSync?.();
};

// ─────────────────────────────────────────────────────────────
// REFRESH
// ─────────────────────────────────────────────────────────────
export function refreshPanelPJ() {
    const nombre = estadoUI.pjSeleccionado;
    if (!nombre || !estadoUI.panelAbierto) return;
    _renderHeader(nombre);
    const tab = _tabActivo[nombre] || 'hex';
    if (tab === 'stats') {
        document.getElementById('ppj-body').innerHTML = _tabStats(nombre);
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
