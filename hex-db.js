// ============================================================
// hex-db.js — Cliente Unificado de Base de Datos
// Coloca este archivo en la RAÍZ del proyecto
// Reemplaza todas las llamadas a Google Sheets + Apps Script
// ============================================================
// Uso en cualquier módulo:
//   import { db } from '../hex-db.js';
//   const personajes = await db.personajes.getAll();
// ============================================================

import { supabase, currentConfig } from './hex-auth.js';

export const db = {

    // ══════════════════════════════════════════════════════
    // PERSONAJES / ESTADÍSTICAS
    // ══════════════════════════════════════════════════════
    personajes: {
        async getAll() {
            const { data, error } = await supabase
                .from('personajes')
                .select('*')
                .order('nombre');
            if (error) console.error('db.personajes.getAll:', error);
            return data || [];
        },

        async getByNombre(nombre) {
            const { data } = await supabase
                .from('personajes')
                .select('*')
                .eq('nombre', nombre)
                .single();
            return data;
        },

        async getJugadoresActivos() {
            const { data } = await supabase
                .from('personajes')
                .select('*')
                .eq('is_player', true)
                .eq('is_active', true)
                .order('nombre');
            return data || [];
        },

        async upsert(pj) {
            const { error } = await supabase
                .from('personajes')
                .upsert(pj, { onConflict: 'nombre' });
            if (error) console.error('db.personajes.upsert:', error);
            return !error;
        },

        async upsertBatch(lista) {
            const { error } = await supabase
                .from('personajes')
                .upsert(lista, { onConflict: 'nombre' });
            if (error) console.error('db.personajes.upsertBatch:', error);
            return !error;
        },

        async eliminar(nombre) {
            const { error } = await supabase
                .from('personajes')
                .delete()
                .eq('nombre', nombre);
            return !error;
        }
    },

    // ══════════════════════════════════════════════════════
    // ESTADOS CONFIG (reemplaza estados.csv)
    // ══════════════════════════════════════════════════════
    estadosConfig: {
        async getAll() {
            const { data } = await supabase
                .from('estados_config')
                .select('*')
                .order('orden');
            return data || [];
        }
    },

    // ══════════════════════════════════════════════════════
    // OBJETOS
    // ══════════════════════════════════════════════════════
    objetos: {
        async getCatalogo() {
            const { data } = await supabase
                .from('objetos')
                .select('*')
                .order('nombre');
            return data || [];
        },

        async getInventarioCompleto() {
            // Devuelve { personaje_nombre, objeto_nombre, cantidad, objetos(*) }
            const { data } = await supabase
                .from('inventario_objetos')
                .select(`
                    personaje_nombre,
                    objeto_nombre,
                    cantidad,
                    objetos (tipo, material, efecto, rareza)
                `)
                .gt('cantidad', 0);
            return data || [];
        },

        async getInventarioPersonaje(nombre) {
            const { data } = await supabase
                .from('inventario_objetos')
                .select(`objeto_nombre, cantidad, objetos (tipo, material, efecto, rareza)`)
                .eq('personaje_nombre', nombre)
                .gt('cantidad', 0);
            return data || [];
        },

       async upsertObjeto(obj) {
            const { error } = await supabase
                .from('objetos')
                .upsert(obj, { onConflict: 'nombre' });
            return !error;
        },

        // 👇 NUEVA FUNCIÓN AÑADIDA 👇
        async eliminarObjeto(nombre) {
            const { error } = await supabase
                .from('objetos')
                .delete()
                .eq('nombre', nombre);
            return !error;
        },
        
        async actualizarCantidad(personajeNombre, objetoNombre, nuevaCantidad) {
            if (nuevaCantidad <= 0) {
                await supabase
                    .from('inventario_objetos')
                    .delete()
                    .eq('personaje_nombre', personajeNombre)
                    .eq('objeto_nombre', objetoNombre);
                return true;
            }
            const { error } = await supabase
                .from('inventario_objetos')
                .upsert(
                    { personaje_nombre: personajeNombre, objeto_nombre: objetoNombre, cantidad: nuevaCantidad },
                    { onConflict: 'personaje_nombre,objeto_nombre' }
                );
            return !error;
        },

        async sincronizarBatch(cambios) {
            // cambios = [{ personaje_nombre, objeto_nombre, cantidad }, ...]
            const upserts = cambios.filter(c => c.cantidad > 0);
            const deletes = cambios.filter(c => c.cantidad <= 0);

            for (const d of deletes) {
                await supabase.from('inventario_objetos').delete()
                    .eq('personaje_nombre', d.personaje_nombre)
                    .eq('objeto_nombre', d.objeto_nombre);
            }

            if (upserts.length > 0) {
                await supabase.from('inventario_objetos')
                    .upsert(upserts, { onConflict: 'personaje_nombre,objeto_nombre' });
            }
            return true;
        }
    },

    // ══════════════════════════════════════════════════════
    // HECHIZOS
    // ══════════════════════════════════════════════════════
    hechizos: {
        // Devuelve el objeto completo que antes venía de la API base64
        async getDataCompleta() {
            const [nodos, strings, inventario, afinidades] = await Promise.all([
                supabase.from('hechizos_nodos').select('*').order('hechizo_id'),
                supabase.from('hechizos_strings').select('source_id, target_id'),
                supabase.from('hechizos_inventario').select('*').order('personaje_nombre').limit(5000),
                supabase.from('hechizos_afinidades').select('*')
            ]);

            const todosNodos = nodos.data || [];

            // Convertir snake_case de Supabase al formato PascalCase que esperan todos los módulos UI
            const mapNodo = (n) => ({
                ID:              n.hechizo_id,
                Nombre:          n.nombre,
                HEX:             n.hex_cost,
                Clase:           n.clase,
                Afinidad:        n.afinidad,
                Resumen:         n.resumen,
                Efecto:          n.efecto,
                'Overcast 100%': n.overcast,
                'Undercast 50%': n.undercast,
                Especial:        n.especial,
                Conocido:        n.es_conocido ? 'si' : '',
                X:               n.pos_x,
                Y:               n.pos_y,
                Size:            n.radio,
                Color:           n.color
            });

            return {
                nodos:        todosNodos.filter(n => n.es_conocido).map(mapNodo),
                nodosOcultos: todosNodos.filter(n => !n.es_conocido).map(mapNodo),
                string:       (strings.data || []).map(s => ({ Source: s.source_id, Target: s.target_id })),
                inventario:   (inventario.data || []).map(i => ({
                    Personaje:          i.personaje_nombre,
                    Hechizo:            i.hechizo_nombre,
                    'Hechizo Afinidad': i.hechizo_afinidad,
                    'Hechizo Hex':      i.hechizo_hex,
                    Tipo:               i.tipo,
                    Origen:             i.origen
                })),
                afinidades:  (afinidades.data || []).map(a => [a.afinidad, a.color_t, a.color_b])
            };
        },

        async getInventarioPersonaje(nombre) {
            const { data } = await supabase
                .from('hechizos_inventario')
                .select('*')
                .eq('personaje_nombre', nombre);
            return data || [];
        },

        async agregarHechizo(personajeNombre, hechizo) {
            const { error } = await supabase
                .from('hechizos_inventario')
                .upsert({
                    personaje_nombre: personajeNombre,
                    hechizo_nombre:   hechizo.nombre,
                    hechizo_afinidad: hechizo.afinidad || '',
                    hechizo_hex:      hechizo.hex || 0,
                    tipo:             hechizo.tipo || 'Normal',
                    origen:           hechizo.origen || 'Mapa Hex'
                }, { onConflict: 'personaje_nombre,hechizo_nombre' });
            return !error;
        },

        async quitarHechizo(personajeNombre, hechizoNombre) {
            const { error } = await supabase
                .from('hechizos_inventario')
                .delete()
                .eq('personaje_nombre', personajeNombre)
                .eq('hechizo_nombre', hechizoNombre);
            return !error;
        },

        async actualizarPosicionNodo(hechizoId, x, y) {
            const { error } = await supabase
                .from('hechizos_nodos')
                .update({ pos_x: x, pos_y: y })
                .eq('hechizo_id', hechizoId);
            return !error;
        },

        async toggleConocido(hechizoId, conocido) {
            const { error } = await supabase
                .from('hechizos_nodos')
                .update({ es_conocido: conocido })
                .eq('hechizo_id', hechizoId);
            return !error;
        },

        async guardarPosicionesBatch(posiciones) {
            let hasError = false;
            // Procesamos las actualizaciones en bloques de 15 para no ahogar la base de datos
            for (let i = 0; i < posiciones.length; i += 15) {
                const lote = posiciones.slice(i, i + 15);
                
                // Usamos .update() en lugar de .upsert() para modificar solo X e Y
                const promesas = lote.map(pos =>
                    supabase.from('hechizos_nodos')
                        .update({ pos_x: pos.pos_x, pos_y: pos.pos_y, es_conocido: pos.es_conocido })
                        .eq('hechizo_id', pos.hechizo_id)
                );
                
                const resultados = await Promise.all(promesas);
                if (resultados.some(r => r.error)) hasError = true;
            }
            return !hasError;
        } // <-- AQUI ESTÁ LA LLAVE QUE FALTABA
    },

    // ══════════════════════════════════════════════════════
    // MISIONES
    // ══════════════════════════════════════════════════════
    misiones: {
        async getAll() {
            const { data } = await supabase
                .from('misiones')
                .select('*')
                .order('orden');
            return data || [];
        },

        async upsert(mision) {
            const payload = {
                titulo:      mision.titulo,
                tipo:        mision.tipo,
                cupos:       mision.cupos,
                estado:      mision.estado,
                clase:       mision.clase,
                descripcion: mision.desc || mision.descripcion || '',
                nota_op:     mision.notaOP || mision.nota_op || '',
                jugadores:   mision.jugadores || [],
                autor:       mision.autor,
                orden:       mision.orden || 0
            };
            const { error } = await supabase
                .from('misiones')
                .upsert(payload, { onConflict: 'titulo' });
            if (error) console.error('db.misiones.upsert:', error);
            return !error;
        },

        async eliminar(titulo) {
            const { error } = await supabase
                .from('misiones')
                .delete()
                .eq('titulo', titulo);
            return !error;
        },

        async sincronizarBatch(cambios) {
            // cambios = objeto { titulo: { campos... } }
            const promesas = Object.values(cambios).map(m => this.upsert(m));
            const resultados = await Promise.all(promesas);
            return resultados.every(Boolean);
        }
    },

    // ══════════════════════════════════════════════════════
    // USUARIOS (solo admin)
    // ══════════════════════════════════════════════════════
    usuarios: {
        async getPerfiles() {
            const { data } = await supabase
                .from('perfiles_usuario')
                .select('id, email, rol, personaje_nombre, created_at')
                .order('email');
            return data || [];
        },

        async asignarPersonaje(userId, personajeNombre) {
            const { error } = await supabase
                .from('perfiles_usuario')
                .update({ personaje_nombre: personajeNombre })
                .eq('id', userId);
            return !error;
        },

        async cambiarRol(userId, nuevoRol) {
            const { error } = await supabase
                .from('perfiles_usuario')
                .update({ rol: nuevoRol })
                .eq('id', userId);
            return !error;
        }
    }, 

// ══════════════════════════════════════════════════════
    // STORAGE (Centralizado y Dinámico)
    // ══════════════════════════════════════════════════════
    storage: {
        get urlBase() { return currentConfig.storageUrl; },

        getUrlInterfaz(nombreArchivo) {
            if (!nombreArchivo) return '';
            
            const norm = (str) => str.toString().trim().toLowerCase()
                .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
                .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o')
                .replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
                .replace(/\s+/g,'_')
                .replace(/[^a-z0-9_\-]/g,'');

            const nombreLimpio = nombreArchivo.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
            const key = norm(nombreLimpio);

            const { data } = supabase.storage
                .from('imagenes-hex')
                .getPublicUrl(`imginterfaz/${key}.png`);

            return data.publicUrl;
        }
    }
};
