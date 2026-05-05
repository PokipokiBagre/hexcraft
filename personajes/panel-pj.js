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
#panel-pj-root{position:fixed;top:0;right:0;width:440px;height:100vh;background:#08080f;border-left:1px solid rgba(212,175,55,0.18);display:flex;flex-direction:column;z-index:1200;transform:translateX(100%);transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);font-family:'Inter',system-ui,sans-serif;box-shadow:-8px 0 40px rgba(0,0,0,0.6);}
#panel-pj-root.open{transform:translateX(0);}
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
.ppj-hz-nombre{font-size:0.84em;font-weight:700;color:#d0d0e0;flex:1;}
.ppj-hz-clase{font-size:0.62em;color:#4a4a68;flex-shrink:0;}
.ppj-hz-hex{font-size:0.68em;color:#8a6a20;font-family:'Cinzel',serif;margin-bottom:4px;}
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
@media(max-width:480px){#panel-pj-root{width:100vw;}}
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
    document.getElementById('panel-pj-overlay')?.classList.remove('open');
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
    switch(tab) {
        case 'hex':      _tabHex(nombre, body);       break;
        case 'stats':    body.innerHTML = _tabStats(nombre); break;
        case 'hechizos': _tabHechizos(nombre, body);  break;
        case 'objetos':  _tabObjetos(nombre, body);   break;
        case 'misiones': _tabMisiones(nombre, body);  break;
    }
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
                    ? `<input class="ppj-cd-input" type="number" step="0.1" min="0.1" max="2.0" value="${cdVal}"
                             onchange="window._ppjSetCd('${safe}','${a.key}',this.value)"> <span style="font-size:0.62em;color:#4a4a68;">(×${(cdVal*100).toFixed(0)}%)</span>`
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
        ${s.guarda_max>0?`${_vida('Guarda Dorada','guarda_actual',p.guarda_actual||0,s.guarda_max,'guarda','#d4af37',20)}${_maxOv('Guarda','guarda_max',p.guarda_max||0,s.guarda_max)}<div class="ppj-formula">${formulas.guarda_max?.expr||''}</div>`:''}
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

    const { data: invHz } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre, hechizo_afinidad, hechizo_hex, tipo, origen')
        .eq('personaje_nombre', nombre);

    const lista = (invHz || []).filter(h => (h.hechizo_afinidad || '').toLowerCase() !== 'hex');
    const hNombres = lista.map(h => h.hechizo_nombre);
    let nodosMap = {};
    if (hNombres.length > 0) {
        const { data: nd } = await supabase.from('hechizos_nodos')
            .select('nombre, afinidad, clase, resumen, efecto, overcast, undercast, especial')
            .in('nombre', hNombres);
        (nd||[]).forEach(n => { nodosMap[n.nombre] = n; });
    }

    const _colAf = (af) => ({
        'Física':'#e2a673','Energética':'#f3e57a','Espiritual':'#7df0a7',
        'Mando':'#a4d3f2','Psíquica':'#dcb1f0','Oscura':'#ff526f',
        'Desconocida':'#888'
    })[af] || '#888';

    if (lista.length === 0) {
        body.innerHTML = `
            <div class="ppj-section"><div class="ppj-empty"><div class="ppj-empty-icon">📖</div>Sin hechizos en el inventario</div></div>
            <div class="ppj-section"><div class="ppj-section-title">Puede aprender</div><div id="ppj-apr-loader" class="ppj-loader">Calculando…</div></div>`;
        _cargarAprendibles(nombre, body, lista, nodosMap, _colAf);
        return;
    }

    const _campo = (label, val) => {
        if (!val || val==='0' || val===0 || val==='EMPTY' || val==='null') return '';
        return `<div class="ppj-hz-field"><strong>${label}:</strong> ${val}</div>`;
    };

    // ── Agrupar: afinidad → clase ────────────────────────────────
    const grupos = {}; // { afinidad: { clase: [hechizos] } }
    lista.forEach(h => {
        const af = h.hechizo_afinidad || 'Sin afinidad';
        const nd = nodosMap[h.hechizo_nombre] || {};
        const cl = nd.clase ? String(nd.clase) : '?';
        if (!grupos[af]) grupos[af] = {};
        if (!grupos[af][cl]) grupos[af][cl] = [];
        grupos[af][cl].push(h);
    });

    const _hzCard = (h, color, show) => {
        const nd  = nodosMap[h.hechizo_nombre] || {};
        const cls = nd.clase ? `Clase ${nd.clase}` : '';
        return `<div class="ppj-hz-card" data-hz-nombre="${(h.hechizo_nombre||'').toLowerCase()}" style="${show?'':'display:none;'}">
            <div class="ppj-hz-header">
                <span class="ppj-hz-af" style="background:${color}22;color:${color};">${(h.hechizo_afinidad||'?').split(' ')[0]}</span>
                <span class="ppj-hz-nombre">${h.hechizo_nombre}</span>
                <span class="ppj-hz-clase">${cls}</span>
            </div>
            ${h.hechizo_hex>0?`<div class="ppj-hz-hex">⬡ ${h.hechizo_hex} HEX</div>`:''}
            <div class="ppj-hz-fields">
                ${_campo('Efecto',nd.efecto)}${_campo('Resumen',nd.resumen)}
                ${_campo('Overcast',nd.overcast)}${_campo('Undercast',nd.undercast)}${_campo('Especial',nd.especial)}
            </div>
        </div>`;
    };

    // Estilos de acordeón (inyectar una sola vez)
    if (!document.getElementById('ppj-hz-acc-styles')) {
        const s = document.createElement('style');
        s.id = 'ppj-hz-acc-styles';
        s.textContent = `
.ppj-hz-search{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#ccc;font-size:0.8em;padding:7px 10px;margin-bottom:10px;box-sizing:border-box;outline:none;}
.ppj-hz-search::placeholder{color:#3a3a58;}
.ppj-hz-search:focus{border-color:rgba(212,175,55,0.3);}
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
`;
        document.head.appendChild(s);
    }

    // Construir HTML
    let html = `<div class="ppj-section">
        <input class="ppj-hz-search" id="ppj-hz-buscador" placeholder="Buscar hechizo…" oninput="window._ppjBuscarHz(this.value)">`;

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

        // Ordenar clases numéricamente
        const clasesOrdenadas = Object.entries(clases).sort(([a],[b]) => {
            const na = parseInt(a)||999, nb = parseInt(b)||999;
            return na - nb;
        });

        clasesOrdenadas.forEach(([cl, hechizos]) => {
            // No mostrar sub-acordeón si solo hay 1 clase
            if (clasesOrdenadas.length === 1) {
                hechizos.forEach(h => { html += _hzCard(h, color, true); });
            } else {
                const clLabel = cl === '?' ? 'Sin clase' : `Clase ${cl}`;
                html += `<div class="ppj-cl-acc" data-clase="${cl}">
                    <div class="ppj-cl-acc-header" onclick="window._ppjToggleAcc(this.parentElement)">
                        <span class="ppj-cl-arrow">▶</span>
                        <span class="ppj-cl-acc-title">${clLabel}</span>
                        <span class="ppj-cl-acc-count">${hechizos.length}</span>
                    </div>
                    <div class="ppj-cl-acc-body">`;
                hechizos.forEach(h => { html += _hzCard(h, color, true); });
                html += `</div></div>`;
            }
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    html += `<div class="ppj-section"><div class="ppj-section-title">Puede aprender</div><div id="ppj-apr-loader" class="ppj-loader">Calculando…</div></div>`;

    body.innerHTML = html;
    _cargarAprendibles(nombre, body, lista, nodosMap, _colAf);
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
window.cerrarPanelPJ = cerrarPanelPJ;

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

// Buscador de hechizos: muestra/oculta cards y abre acordeones padres con resultados
window._ppjBuscarHz = (query) => {
    const q = query.toLowerCase().trim();
    if (!q) {
        // Restaurar todo al estado cerrado original
        document.querySelectorAll('.ppj-hz-card').forEach(c => { c.style.display = ''; });
        document.querySelectorAll('.ppj-af-acc, .ppj-cl-acc').forEach(a => { a.classList.remove('open'); });
        return;
    }
    document.querySelectorAll('.ppj-hz-card').forEach(c => {
        const nombre = c.getAttribute('data-hz-nombre') || '';
        const match  = nombre.includes(q);
        c.style.display = match ? '' : 'none';
    });
    // Abrir acordeones que tienen al menos un resultado visible
    document.querySelectorAll('.ppj-cl-acc').forEach(cl => {
        const visible = cl.querySelectorAll('.ppj-hz-card:not([style*="display: none"]):not([style*="display:none"])').length;
        cl.classList.toggle('open', visible > 0);
    });
    document.querySelectorAll('.ppj-af-acc').forEach(af => {
        const visible = af.querySelectorAll('.ppj-hz-card:not([style*="display: none"]):not([style*="display:none"])').length;
        af.classList.toggle('open', visible > 0);
    });
};

window._ppjSetCd = (nombre, afinKey, valor) => {
    if (!estadoUI.esAdmin) return;
    const p = personajes[nombre]; if (!p) return;
    const v = Math.max(0.1, Math.min(2, parseFloat(valor)||0.5));
    p[`cd_${afinKey}`] = v;
    encolarCambio(nombre, `cd_${afinKey}`, v);
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
