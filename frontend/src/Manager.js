import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Database, Save, Building2, Search, CheckCircle2, AlertCircle, 
  Loader2, RefreshCw, Calendar, FileSpreadsheet, Lock, Unlock, 
  Zap, Layers, ChevronRight, TrendingUp, Trash2, UploadCloud, X, CheckCircle, Clock
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';
const ORDEN_MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Memoria global en RAM: Si ya se descargaron una vez en la sesión, no se vuelven a pedir nunca
let memoriaGlobalSectores = null;

const Manager = () => {
  const [sectores, setSectores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'capturados' | 'pendientes'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [editarFijos, setEditarFijos] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState('recibo');
  
  // Estado para el modal de Carga Masiva
  const [modalMasivoAbierto, setModalMasivoAbierto] = useState(false);
  const [datosMasivosInput, setDatosMasivosInput] = useState('');
  const [cargandoMasivo, setCargandoMasivo] = useState(false);

  const [sectorForm, setSectorForm] = useState({
    id: '',
    clave: '',
    clasificacion: 'ALUMBRADO PUBLICO',
    nombreColonia: '',
    medidor: '',
    cuenta: '',
    carga: 0,
    cpd: 0,
    tarifa: '5A',
    consumoIdeal: 0,
    consumoAceptable: 0,
    consumoMaximo: 0,
    recibos: []
  });

  const [reciboForm, setReciboForm] = useState({
    mes: 'Jul',
    anio: 2026,
    consumoKwh: 0,
    importe: 0,
    lecturaAnterior: 0,
    lecturaActual: 0,
    notasObservaciones: ''
  });

  const seleccionarSector = useCallback((sec) => {
    setSectorForm({
      id: sec.id || '',
      clave: sec.clave || '',
      clasificacion: sec.clasificacion || 'ALUMBRADO PUBLICO',
      nombreColonia: sec.nombreColonia || '',
      medidor: sec.medidor || '',
      cuenta: sec.cuenta || '',
      carga: parseFloat(sec.carga) || 0,
      cpd: parseFloat(sec.cpd) || 0,
      tarifa: sec.tarifa || '5A',
      consumoIdeal: parseFloat(sec.consumoIdeal) || 0,
      consumoAceptable: parseFloat(sec.consumoAceptable) || 0,
      consumoMaximo: parseFloat(sec.consumoMaximo) || 0,
      recibos: sec.recibos || []
    });

    const reciboMesActual = (sec.recibos || []).find(
      r => r.mes.toLowerCase() === reciboForm.mes.toLowerCase() && parseInt(r.anio) === parseInt(reciboForm.anio)
    );

    if (reciboMesActual) {
      setReciboForm({
        mes: reciboForm.mes,
        anio: reciboForm.anio,
        consumoKwh: parseFloat(reciboMesActual.consumoKwh) || 0,
        importe: parseFloat(reciboMesActual.importe) || 0,
        lecturaAnterior: parseFloat(reciboMesActual.lecturaAnterior) || 0,
        lecturaActual: parseFloat(reciboMesActual.lecturaActual) || 0,
        notasObservaciones: reciboMesActual.notasObservaciones || ''
      });
    } else if (sec.recibos && sec.recibos.length > 0) {
      const ultimo = sec.recibos[sec.recibos.length - 1];
      setReciboForm({
        mes: reciboForm.mes,
        anio: reciboForm.anio,
        consumoKwh: 0,
        importe: 0,
        lecturaAnterior: parseFloat(ultimo.lecturaActual) || parseFloat(ultimo.lecturaAnterior) || 0,
        lecturaActual: 0,
        notasObservaciones: ''
      });
    } else {
      setReciboForm({ mes: reciboForm.mes, anio: reciboForm.anio, consumoKwh: 0, importe: 0, lecturaAnterior: 0, lecturaActual: 0, notasObservaciones: '' });
    }
  }, [reciboForm.mes, reciboForm.anio]);

  const cargarSectores = useCallback((forzarRecarga = false) => {
    const cacheKey = 'cache_manager_sectores';
    const flagKey = 'cargando_manager_en_proceso';

    if (!forzarRecarga && memoriaGlobalSectores) {
      setSectores(memoriaGlobalSectores);
      if (memoriaGlobalSectores.length > 0 && !sectorForm.id) {
        seleccionarSector(memoriaGlobalSectores[0]);
      }
      return;
    }

    const datosGuardados = sessionStorage.getItem(cacheKey);
    if (!forzarRecarga && datosGuardados) {
      const parsedData = JSON.parse(datosGuardados);
      memoriaGlobalSectores = parsedData;
      setSectores(parsedData);
      if (parsedData.length > 0 && !sectorForm.id) {
        seleccionarSector(parsedData[0]);
      }
      return;
    }

    if (sessionStorage.getItem(flagKey) === 'true' && !forzarRecarga) return;
    sessionStorage.setItem(flagKey, 'true');

    setLoading(true);
    const query = `{
      todosLosSectores {
        id
        clave
        clasificacion
        consumoIdeal
        consumoAceptable
        consumoMaximo
        nombreColonia
        medidor
        cuenta
        carga
        cpd
        tarifa
        recibos {
          id
          anio
          mes
          consumoKwh
          importe
          lecturaAnterior
          lecturaActual
          notasObservaciones
        }
      }
    }`;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
      .then(res => res.json())
      .then(data => {
        sessionStorage.removeItem(flagKey);
        if (data.data?.todosLosSectores) {
          const nuevosSectores = data.data.todosLosSectores;
          memoriaGlobalSectores = nuevosSectores;
          setSectores(nuevosSectores);
          sessionStorage.setItem(cacheKey, JSON.stringify(nuevosSectores));
          if (nuevosSectores.length > 0 && !sectorForm.id) {
            seleccionarSector(nuevosSectores[0]);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        sessionStorage.removeItem(flagKey);
        console.error("Error de conexión:", err);
        setLoading(false);
      });
  }, [sectorForm.id, seleccionarSector]);

  useEffect(() => {
    cargarSectores();
  }, [cargarSectores]);

  const cambiarMes = (nuevoMes) => {
    const reciboExistente = (sectorForm.recibos || []).find(
      r => r.mes.toLowerCase() === nuevoMes.toLowerCase() && parseInt(r.anio) === parseInt(reciboForm.anio)
    );

    if (reciboExistente) {
      setReciboForm({
        mes: nuevoMes,
        anio: reciboForm.anio,
        lecturaAnterior: parseFloat(reciboExistente.lecturaAnterior) || 0,
        lecturaActual: parseFloat(reciboExistente.lecturaActual) || 0,
        consumoKwh: parseFloat(reciboExistente.consumoKwh) || 0,
        importe: parseFloat(reciboExistente.importe) || 0,
        notasObservaciones: reciboExistente.notasObservaciones || ''
      });
    } else {
      const lecturaParaSiguienteMes = reciboForm.lecturaActual > 0 ? reciboForm.lecturaActual : reciboForm.lecturaAnterior;
      setReciboForm({
        mes: nuevoMes,
        anio: reciboForm.anio,
        lecturaAnterior: lecturaParaSiguienteMes,
        lecturaActual: 0,
        consumoKwh: 0,
        importe: 0,
        notasObservaciones: ''
      });
    }
  };

  const cambiarAnio = (nuevoAnio) => {
    const anioInt = parseInt(nuevoAnio);
    const reciboExistente = (sectorForm.recibos || []).find(
      r => r.mes.toLowerCase() === reciboForm.mes.toLowerCase() && parseInt(r.anio) === anioInt
    );

    if (reciboExistente) {
      setReciboForm({
        mes: reciboForm.mes,
        anio: anioInt,
        lecturaAnterior: parseFloat(reciboExistente.lecturaAnterior) || 0,
        lecturaActual: parseFloat(reciboExistente.lecturaActual) || 0,
        consumoKwh: parseFloat(reciboExistente.consumoKwh) || 0,
        importe: parseFloat(reciboExistente.importe) || 0,
        notasObservaciones: reciboExistente.notasObservaciones || ''
      });
    } else {
      setReciboForm(prev => ({ ...prev, anio: anioInt, lecturaActual: 0, consumoKwh: 0, importe: 0 }));
    }
  };

  const handleLecturaActualChange = (val) => {
    const nuevaLectura = parseFloat(val) || 0;
    const diferencia = nuevaLectura > reciboForm.lecturaAnterior ? nuevaLectura - reciboForm.lecturaAnterior : 0;

    setReciboForm(prev => ({
      ...prev,
      lecturaActual: nuevaLectura,
      consumoKwh: diferencia > 0 ? diferencia : prev.consumoKwh
    }));
  };

  const guardarCaptura = () => {
    if (!sectorForm.clave || !sectorForm.nombreColonia) {
      setMensaje({ tipo: 'error', texto: 'Clave y Colonia son obligatorias.' });
      return;
    }

    setSaving(true);

    const mutation = `
      mutation RegistrarRecibo($input: ReciboInput!) {
        registrarRecibo(input: $input) {
          id
        }
      }
    `;

    const variables = {
      input: {
        sectorId: parseInt(sectorForm.id) || 0,
        mes: reciboForm.mes,
        anio: parseInt(reciboForm.anio),
        lecturaAnterior: parseFloat(reciboForm.lecturaAnterior) || 0,
        lecturaActual: parseFloat(reciboForm.lecturaActual) || 0,
        consumoKwh: parseFloat(reciboForm.consumoKwh) || 0,
        importeRecibo: parseFloat(reciboForm.importe) || 0,
        notasObservaciones: reciboForm.notasObservaciones || ""
      }
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables })
    })
      .then(res => res.json())
      .then(res => {
        setSaving(false);
        if (res.errors) {
          const detalleError = res.errors[0]?.message || "Error desconocido";
          setMensaje({ tipo: 'error', texto: `Error: ${detalleError}` });
        } else {
          setMensaje({ tipo: 'exito', texto: `Captura de ${reciboForm.mes} ${reciboForm.anio} guardada exitosamente.` });
          memoriaGlobalSectores = null; 
          sessionStorage.removeItem('cache_manager_sectores');
          cargarSectores(true); 
          setTimeout(() => setMensaje(null), 3000);
        }
      })
      .catch(() => {
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
      });
  };

  const ejecutarCargaMasiva = async () => {
    if (!datosMasivosInput.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor ingrese o pegue los datos para la carga masiva.' });
      return;
    }

    setCargandoMasivo(true);
    try {
      const lineas = datosMasivosInput.split('\n');
      let exitosos = 0;

      for (let linea of lineas) {
        if (!linea.trim()) continue;
        const partes = linea.split(/,|\t/);
        if (partes.length >= 5) {
          const claveSec = partes[0].trim();
          const mesSec = partes[1].trim();
          const anioSec = parseInt(partes[2].trim()) || 2026;
          const lecAnt = parseFloat(partes[3].trim()) || 0;
          const lecAct = parseFloat(partes[4].trim()) || 0;
          const kwh = parseFloat(partes[5]?.trim()) || (lecAct > lecAnt ? lecAct - lecAnt : 0);
          const imp = parseFloat(partes[6]?.trim()) || 0;
          const notas = partes[7]?.trim() || '';

          const sectorEncontrado = sectores.find(s => s.clave.toLowerCase() === claveSec.toLowerCase());
          if (sectorEncontrado) {
            const mutation = `
              mutation RegistrarRecibo($input: ReciboInput!) {
                registrarRecibo(input: $input) {
                  id
                }
              }
            `;
            const variables = {
              input: {
                sectorId: parseInt(sectorEncontrado.id),
                mes: mesSec,
                anio: anioSec,
                lecturaAnterior: lecAnt,
                lecturaActual: lecAct,
                consumoKwh: kwh,
                importeRecibo: imp,
                notasObservaciones: notas
              }
            };

            const respuesta = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: mutation, variables })
            });
            const resultadoJson = await respuesta.json();
            if (!resultadoJson.errors) {
              exitosos++;
            }
          }
        }
      }

      setCargandoMasivo(false);
      setModalMasivoAbierto(false);
      setDatosMasivosInput('');
      setMensaje({ tipo: 'exito', texto: `Carga masiva completada. Se procesaron ${exitosos} registros correctamente.` });
      
      memoriaGlobalSectores = null;
      sessionStorage.removeItem('cache_manager_sectores');
      cargarSectores(true);
      setTimeout(() => setMensaje(null), 4000);
    } catch (error) {
      setCargandoMasivo(false);
      setMensaje({ tipo: 'error', texto: 'Ocurrió un error durante el proceso de carga masiva.' });
    }
  };

  const eliminarRegistroBackend = () => {
    if (!sectorForm.id) {
      setMensaje({ tipo: 'error', texto: 'Seleccione un sector válido.' });
      return;
    }

    if (!window.confirm(`¿Desea eliminar definitivamente el registro de ${reciboForm.mes} ${reciboForm.anio} de la base de datos?`)) return;

    setSaving(true);

    const mutation = `
      mutation EliminarRecibo($sectorId: Int!, $mes: String!, $anio: Int!) {
        eliminarRecibo(sectorId: $sectorId, mes: $mes, anio: $anio)
      }
    `;

    const variables = {
      sectorId: parseInt(sectorForm.id),
      mes: reciboForm.mes,
      anio: parseInt(reciboForm.anio)
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables })
    })
      .then(res => res.json())
      .then(res => {
        setSaving(false);
        if (res.errors) {
          setMensaje({ tipo: 'error', texto: 'Error al eliminar el registro.' });
        } else {
          setMensaje({ tipo: 'exito', texto: `Registro de ${reciboForm.mes} ${reciboForm.anio} eliminado de la base de datos.` });
          setReciboForm(prev => ({
            ...prev,
            lecturaActual: 0,
            consumoKwh: 0,
            importe: 0,
            notasObservaciones: ''
          }));
          memoriaGlobalSectores = null;
          sessionStorage.removeItem('cache_manager_sectores');
          cargarSectores(true);
          setTimeout(() => setMensaje(null), 3000);
        }
      })
      .catch(() => {
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
      });
  };

  // Filtrado avanzado con estado (Todos, Capturados, Pendientes) para el periodo activo
  const sectoresFiltrados = useMemo(() => {
    return sectores.filter(s => {
      const coincideTexto = s.clave?.toLowerCase().includes(busqueda.toLowerCase()) || 
                            s.nombreColonia?.toLowerCase().includes(busqueda.toLowerCase());
      
      const tieneCaptura = (s.recibos || []).some(
        r => r.mes.toLowerCase() === reciboForm.mes.toLowerCase() && parseInt(r.anio) === parseInt(reciboForm.anio) && (parseFloat(r.lecturaActual) > 0 || parseFloat(r.consumoKwh) > 0)
      );

      if (filtroEstado === 'capturados') return coincideTexto && tieneCaptura;
      if (filtroEstado === 'pendientes') return coincideTexto && !tieneCaptura;
      return coincideTexto;
    });
  }, [sectores, busqueda, filtroEstado, reciboForm.mes, reciboForm.anio]);

  const estadoConsumo = useMemo(() => {
    const kwhActual = parseFloat(reciboForm.consumoKwh) || 0;
    const ideal = sectorForm.consumoIdeal || 0;
    const aceptable = sectorForm.consumoAceptable || 0;
    const maximo = sectorForm.consumoMaximo || 0;

    if (!ideal && !maximo) return { color: 'text-slate-400', bg: 'bg-slate-800/50', border: 'border-slate-700', label: 'Sin Parámetros' };
    
    if (maximo > 0 && kwhActual > maximo) {
      return { color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-500/40', label: 'Exceso de Consumo' };
    }
    if (aceptable > 0 && kwhActual > aceptable) {
      return { color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-500/40', label: 'Consumo Aceptable' };
    }
    return { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/40', label: 'Consumo Óptimo' };
  }, [reciboForm.consumoKwh, sectorForm]);

  const datosGraficaHistorial = useMemo(() => {
    const mapaRecibos = {};
    (sectorForm.recibos || []).forEach(r => {
      if (parseInt(r.anio) === parseInt(reciboForm.anio)) {
        mapaRecibos[r.mes] = parseFloat(r.consumoKwh) || 0;
      }
    });

    return ORDEN_MESES.map(mes => {
      const esMesActualCaptura = mes === reciboForm.mes;
      const consumoCalculado = esMesActualCaptura 
        ? (parseFloat(reciboForm.consumoKwh) || 0) 
        : (mapaRecibos[mes] || 0);

      return {
        mes,
        consumo: consumoCalculado,
        esActual: esMesActualCaptura
      };
    });
  }, [sectorForm.recibos, reciboForm.mes, reciboForm.anio, reciboForm.consumoKwh]);

  const formatoMoneda = (valor) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor || 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#090d16] border border-slate-700/80 p-2.5 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 pb-1 mb-1">
            Mes: <span className="text-white">{label} {reciboForm.anio}</span>
          </p>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">Consumo:</span>
            <span className="text-emerald-400 font-black">{data.consumo.toLocaleString()} kWh</span>
          </div>
          {data.esActual && (
            <span className="mt-1 block text-[8px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30 text-center">
              Captura Activa
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen w-screen bg-[#070b14] p-3 md:p-4 font-sans text-slate-100 flex flex-col overflow-hidden relative">
      <div className="max-w-[1600px] w-full mx-auto flex flex-col h-full gap-2.5">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-[#111827] border border-slate-800/80 px-4 py-2 rounded-xl shadow-xl flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-rose-600 to-rose-800 p-2 rounded-lg shadow-md border border-rose-500/30">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wider uppercase text-white">MANAGER</h1>
                <span className="bg-rose-500/10 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-widest">
                  CAPTURA DE DATOS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Lectura de medidores, kWh , Importes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setModalMasivoAbierto(true)} 
              className="bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all"
            >
              <UploadCloud size={13} />
              <span>Carga Masiva</span>
            </button>
            <button 
              onClick={() => {
                memoriaGlobalSectores = null;
                sessionStorage.removeItem('cache_manager_sectores');
                cargarSectores(true);
              }} 
              className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-rose-400" : ""} /> 
              <span>Sincronizar</span>
            </button>
            <button 
              onClick={eliminarRegistroBackend} 
              disabled={saving} 
              className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
              title="Eliminar registro de la base de datos"
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>
            <button 
              onClick={guardarCaptura} 
              disabled={saving} 
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border border-emerald-500/30 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Guardar</span>
            </button>
          </div>
        </div>

        {/* NOTIFICACIÓN */}
        {mensaje && (
          <div className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 border shadow-md shrink-0 ${
            mensaje.tipo === 'exito' ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}>
            {mensaje.tipo === 'exito' ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" /> : <AlertCircle size={15} className="text-rose-400 shrink-0" />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* DASHBOARD PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          
          {/* SECTORES CON FILTROS DE ESTADO */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl shadow-lg flex flex-col h-full min-h-0">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-rose-500" /> Sectores ({sectoresFiltrados.length})
              </span>
            </div>

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar clave o colonia..." 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-rose-500/50 text-slate-200 pl-9 pr-3 py-1.5 rounded-lg text-xs font-medium outline-none transition-all placeholder:text-slate-600" 
              />
            </div>

            {/* BOTONES DE FILTRO RÁPIDO (TODOS / CAPTURADOS / PENDIENTES) */}
            <div className="grid grid-cols-3 gap-1 mb-2.5 shrink-0">
              <button 
                onClick={() => setFiltroEstado('todos')}
                className={`py-1 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  filtroEstado === 'todos' ? 'bg-slate-700 text-white shadow' : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFiltroEstado('capturados')}
                className={`py-1 px-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                  filtroEstado === 'capturados' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-950/60 text-emerald-400/80 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <CheckCircle size={10} /> Capturados
              </button>
              <button 
                onClick={() => setFiltroEstado('pendientes')}
                className={`py-1 px-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                  filtroEstado === 'pendientes' ? 'bg-amber-600 text-white shadow' : 'bg-slate-950/60 text-amber-400/80 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Clock size={10} /> Pendientes
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {sectoresFiltrados.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-xs">Sin registros que coincidan.</div>
              ) : (
                sectoresFiltrados.map(sec => {
                  const esSeleccionado = sectorForm.id === sec.id;
                  const estaCapturado = (sec.recibos || []).some(
                    r => r.mes.toLowerCase() === reciboForm.mes.toLowerCase() && parseInt(r.anio) === parseInt(reciboForm.anio) && (parseFloat(r.lecturaActual) > 0 || parseFloat(r.consumoKwh) > 0)
                  );

                  return (
                    <button 
                      key={sec.id} 
                      onClick={() => seleccionarSector(sec)} 
                      className={`w-full p-2 rounded-lg text-left border transition-all duration-150 flex justify-between items-center ${
                        esSeleccionado 
                          ? 'bg-gradient-to-r from-rose-950/40 to-slate-900 border-rose-500/60 shadow-md' 
                          : estaCapturado
                            ? 'bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-900/20'
                            : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-0.5 truncate flex items-center gap-2">
                        {/* Indicador visual de color: Verde si está capturado, Gris si está pendiente */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${estaCapturado ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-slate-600'}`}></span>
                        <div className="truncate">
                          <p className={`text-xs font-black uppercase tracking-wide truncate ${esSeleccionado ? 'text-rose-400' : 'text-slate-200'}`}>
                            {sec.clave}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 truncate">
                            {sec.nombreColonia || 'Sin colonia'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
                          {sec.tarifa || '5A'}
                        </span>
                        <ChevronRight size={13} className={esSeleccionado ? 'text-rose-400' : 'text-slate-600'} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL DERECHO */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-0 space-y-2.5">
            
            {/* KPI RESUMEN */}
            <div className={`p-2.5 rounded-xl border transition-all ${estadoConsumo.bg} ${estadoConsumo.border} shadow-md grid grid-cols-3 gap-2 items-center shrink-0`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <Zap size={16} className={estadoConsumo.color} />
                </div>
                <div className="truncate">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Diagnóstico ({reciboForm.mes})</span>
                  <p className={`text-xs font-black uppercase tracking-wider truncate ${estadoConsumo.color}`}>
                    {estadoConsumo.label}
                  </p>
                </div>
              </div>

              <div className="border-l border-slate-800/80 pl-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Consumo Registrado</span>
                <p className="text-base font-black text-white tracking-tight">
                  {reciboForm.consumoKwh.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">kWh</span>
                </p>
              </div>

              <div className="border-l border-slate-800/80 pl-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Facturación</span>
                <p className="text-base font-black text-emerald-400 tracking-tight">
                  {formatoMoneda(reciboForm.importe)}
                </p>
              </div>
            </div>

            {/* PESTAÑAS */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl shadow-lg flex-1 min-h-0 flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2.5 shrink-0">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPestanaActiva('recibo')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      pestanaActiva === 'recibo' 
                        ? 'bg-rose-600 text-white shadow-md' 
                        : 'bg-slate-950/80 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <FileSpreadsheet size={13} />
                    <span>Captura Recibo</span>
                  </button>

                  <button 
                    onClick={() => setPestanaActiva('infraestructura')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      pestanaActiva === 'infraestructura' 
                        ? 'bg-rose-600 text-white shadow-md' 
                        : 'bg-slate-950/80 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <Building2 size={13} />
                    <span>Infraestructura Base</span>
                  </button>
                </div>

                <span className="text-xs font-black text-rose-400 uppercase tracking-widest hidden sm:inline">
                  {sectorForm.clave || 'Sin Sector'}
                </span>
              </div>

              {/* PESTAÑA 1 */}
              {pestanaActiva === 'recibo' && (
                <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                  
                  {/* SELECTOR DE MES Y AÑO */}
                  <div className="flex justify-between items-center bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Calendar size={13} className="text-emerald-400" /> Periodo a Facturar:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select 
                        value={reciboForm.mes} 
                        onChange={e => cambiarMes(e.target.value)} 
                        className="bg-slate-900 text-emerald-400 px-2.5 py-0.5 rounded text-xs font-bold outline-none border border-slate-700 cursor-pointer"
                      >
                        {ORDEN_MESES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select 
                        value={reciboForm.anio} 
                        onChange={e => cambiarAnio(e.target.value)} 
                        className="bg-slate-900 text-slate-200 px-2 py-0.5 rounded text-xs font-bold outline-none border border-slate-700 cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* LECTURAS */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Lectura Anterior</label>
                      <input 
                        type="number" 
                        value={reciboForm.lecturaAnterior} 
                        onChange={e => setReciboForm({...reciboForm, lecturaAnterior: parseFloat(e.target.value) || 0})} 
                        className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs font-bold text-slate-200 outline-none" 
                      />
                    </div>

                    <div className="bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/30 space-y-0.5">
                      <label className="text-[9px] font-black text-emerald-400 uppercase">Lectura Actual ({reciboForm.mes})</label>
                      <input 
                        type="number" 
                        value={reciboForm.lecturaActual || ''} 
                        onChange={e => handleLecturaActualChange(e.target.value)} 
                        placeholder="Ingrese lectura..." 
                        className="w-full bg-slate-900 border border-emerald-500/50 p-1.5 rounded text-xs font-bold text-white outline-none placeholder:text-slate-600" 
                      />
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Diferencia (kWh)</label>
                      <input 
                        type="number" 
                        value={reciboForm.consumoKwh} 
                        onChange={e => setReciboForm({...reciboForm, consumoKwh: parseFloat(e.target.value) || 0})} 
                        className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs font-black text-white outline-none" 
                      />
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Importe ($ MXN)</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={reciboForm.importe || ''} 
                        onChange={e => setReciboForm({...reciboForm, importe: parseFloat(e.target.value) || 0})} 
                        placeholder="0.00" 
                        className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-xs font-black text-emerald-400 outline-none placeholder:text-slate-700" 
                      />
                    </div>
                  </div>

                  {/* OBSERVACIONES */}
                  <div className="space-y-0.5 shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Observaciones Operativas</label>
                    <input 
                      type="text" 
                      value={reciboForm.notasObservaciones} 
                      onChange={e => setReciboForm({...reciboForm, notasObservaciones: e.target.value})} 
                      placeholder="Ej. Cambio de medidor / Lectura estimada CFE..." 
                      className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-xs font-medium text-slate-200 outline-none placeholder:text-slate-600" 
                    />
                  </div>

                  {/* GRÁFICA */}
                  <div className="flex-1 bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-emerald-400" /> Tendencia Anual de Consumo ({reciboForm.anio})
                      </span>
                      <div className="flex items-center gap-3 text-[9px] font-bold">
                        <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-0.5 bg-emerald-500"></span> Ideal ({sectorForm.consumoIdeal} kWh)</span>
                        <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-0.5 bg-rose-500"></span> Máximo ({sectorForm.consumoMaximo} kWh)</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={datosGraficaHistorial} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorConsumoVerde" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.28}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                            </linearGradient>
                          </defs>

                          <XAxis dataKey="mes" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          
                          <Tooltip content={<CustomTooltip />} cursor={false} />
                          
                          {sectorForm.consumoIdeal > 0 && (
                            <ReferenceLine y={sectorForm.consumoIdeal} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                          )}
                          {sectorForm.consumoMaximo > 0 && (
                            <ReferenceLine y={sectorForm.consumoMaximo} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.7} />
                          )}

                          <Area 
                            type="linear" 
                            dataKey="consumo" 
                            stroke="#10b981" 
                            strokeWidth={2.5} 
                            fillOpacity={1} 
                            fill="url(#colorConsumoVerde)" 
                            dot={({ cx, cy, payload, index }) => {
                              const esActual = payload.esActual;
                              return (
                                <circle 
                                  key={`dot-${index}`}
                                  cx={cx} 
                                  cy={cy} 
                                  r={esActual ? 5.5 : 3} 
                                  fill={esActual ? "#06b6d4" : "#10b981"} 
                                  stroke={esActual ? "#ffffff" : "#090d16"} 
                                  strokeWidth={esActual ? 2 : 1}
                                />
                              );
                            }}
                            activeDot={{ r: 7, fill: "#06b6d4", stroke: "#ffffff", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}

              {/* PESTAÑA 2 */}
              {pestanaActiva === 'infraestructura' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Parámetros CFE del Sector</span>
                    <button 
                      onClick={() => setEditarFijos(!editarFijos)} 
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 transition-all ${
                        editarFijos ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                      }`}
                    >
                      {editarFijos ? <Unlock size={11} /> : <Lock size={11} />}
                      <span>{editarFijos ? 'Desbloqueado' : 'Bloqueado'}</span>
                    </button>
                  </div>

                  <fieldset disabled={!editarFijos} className="space-y-3 disabled:opacity-50 transition-opacity">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Clave</label>
                        <input type="text" value={sectorForm.clave} onChange={e => setSectorForm({...sectorForm, clave: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Colonia</label>
                        <input type="text" value={sectorForm.nombreColonia} onChange={e => setSectorForm({...sectorForm, nombreColonia: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Medidor</label>
                        <input type="text" value={sectorForm.medidor} onChange={e => setSectorForm({...sectorForm, medidor: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Cuenta</label>
                        <input type="text" value={sectorForm.cuenta} onChange={e => setSectorForm({...sectorForm, cuenta: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-white outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Carga (kW)</label>
                        <input type="number" value={sectorForm.carga} onChange={e => setSectorForm({...sectorForm, carga: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-slate-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">CPD</label>
                        <input type="number" value={sectorForm.cpd} onChange={e => setSectorForm({...sectorForm, cpd: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-slate-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Tarifa</label>
                        <input type="text" value={sectorForm.tarifa} onChange={e => setSectorForm({...sectorForm, tarifa: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold text-slate-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-emerald-400 uppercase">Ideal (kWh)</label>
                        <input type="number" value={sectorForm.consumoIdeal} onChange={e => setSectorForm({...sectorForm, consumoIdeal: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-emerald-500/30 p-2 rounded text-xs font-bold text-emerald-300 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-amber-400 uppercase">Aceptable</label>
                        <input type="number" value={sectorForm.consumoAceptable} onChange={e => setSectorForm({...sectorForm, consumoAceptable: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-amber-500/30 p-2 rounded text-xs font-bold text-amber-300 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-rose-400 uppercase">Máximo</label>
                        <input type="number" value={sectorForm.consumoMaximo} onChange={e => setSectorForm({...sectorForm, consumoMaximo: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-rose-500/30 p-2 rounded text-xs font-bold text-rose-300 outline-none" />
                      </div>
                    </div>
                  </fieldset>
                </div>
              )}

            </div>

          </div>
        </div>
      </div>

      {/* MODAL DE CARGA MASIVA */}
      {modalMasivoAbierto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-900 px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UploadCloud size={18} className="text-indigo-400" />
                <h3 className="text-sm font-black uppercase text-white tracking-wider">Carga Masiva de Recibos</h3>
              </div>
              <button 
                onClick={() => setModalMasivoAbierto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Pegue aquí los datos tabulares (copiados de Excel o formato CSV separado por comas/tabulaciones). Cada fila debe respetar el siguiente orden de columnas:
              </p>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-indigo-300">
                ClaveSector, Mes, Anio, LecturaAnterior, LecturaActual, ConsumoKwh, Importe, Notas
              </div>
              <textarea 
                rows="8" 
                placeholder="Ejemplo:&#10;810101002472, Jun, 2026, 69715, 77990, 8275, 40642, Lectura estimada"
                value={datosMasivosInput}
                onChange={(e) => setDatosMasivosInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 p-3 rounded-xl text-xs font-mono text-slate-200 outline-none placeholder:text-slate-700 resize-none custom-scrollbar"
              />
            </div>

            <div className="flex justify-end gap-2 bg-slate-900 px-4 py-3 border-t border-slate-800">
              <button 
                onClick={() => setModalMasivoAbierto(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={ejecutarCargaMasiva}
                disabled={cargandoMasivo}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-950/50 transition-all disabled:opacity-50"
              >
                {cargandoMasivo ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                <span>Procesar Carga Masiva</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Manager;
