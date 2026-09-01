import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, Trash2, Edit3, RefreshCw, 
  Layers, Search, CheckCircle2, Lock, Unlock, Check, Navigation, Disc, AlertTriangle, XCircle, FileText, ArrowLeft, ShieldCheck, WifiOff, Wifi, ChevronUp, ChevronDown, List, RotateCcw, CloudUpload 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useApp } from './AppContext.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

const reproducirAlertaCensoCompletado = () => {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const mensajeVoz = new SpeechSynthesisUtterance("Census successfully completed!");
      mensajeVoz.lang = 'en-US';
      mensajeVoz.rate = 1.0;
      window.speechSynthesis.speak(mensajeVoz);
    }
    
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.warn("No se pudo reproducir audio:", e);
  }
};

const ForzarRecargaMapa = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const ActualizarMapa = ({ sector, luminaria, modoCrearSector, modoCrearLuminaria, ubicacionUsuario, modoSeguimiento, posicionGPS }) => {
  const map = useMap();
  useEffect(() => {
    if (modoSeguimiento && posicionGPS) {
      map.setView([posicionGPS.lat, posicionGPS.lng], 19, { animate: true });
    } else if (luminaria && luminaria.latitud && luminaria.longitud) {
      // Evitamos recentrar automáticamente
    } else if (ubicacionUsuario && (modoCrearSector || modoCrearLuminaria)) {
      map.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 19, { animate: true });
    } else if (sector && sector.latitud && sector.longitud && !modoCrearSector && !modoSeguimiento && !luminaria) {
      map.setView([parseFloat(sector.latitud), parseFloat(sector.longitud)], 18, { animate: true });
    }
  }, [sector, luminaria, modoCrearSector, modoCrearLuminaria, ubicacionUsuario, modoSeguimiento, posicionGPS, map]);
  return null;
};

const BotonMiUbicacion = ({ onUbicacionObtenida, ocultar }) => {
  const map = useMap();
  const [centrando, setCentrando] = useState(false);
  const [activado, setActivado] = useState(false);

  if (ocultar || activado) return null;

  const irAUbicacionActual = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada por tu navegador");
      return;
    }
    setCentrando(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], 19, { animate: true });
        onUbicacionObtenida({ lat, lng });
        setCentrando(false);
        setActivado(true);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        setCentrando(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <button 
      type="button"
      onClick={irAUbicacionActual}
      className="absolute top-4 right-4 z-[1000] bg-slate-900/95 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 p-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold uppercase backdrop-blur-md transition-all cursor-pointer"
      title="Ir a mi ubicación actual con GPS"
    >
      <Navigation size={18} className={centrando ? "animate-spin text-emerald-400" : ""} />
      <span className="hidden sm:inline">Mi GPS</span>
    </button>
  );
};

const crearIconoSectorPersonalizado = (isActive, colorBase = '#2563eb') => {
  const triClipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  return L.divIcon({ 
    html: `
      <div style="
        width: 28px; height: 28px; 
        position: relative; 
        filter: drop-shadow(3px 3px 4px rgba(0,0,0,0.6));
        transform: ${isActive ? 'scale(1.4) translateY(-5px)' : 'scale(1)'};
        transition: all 0.3s ease;
      ">
        <div style="position: absolute; width: 100%; height: 100%; background: #111; clip-path: ${triClipPath};"></div>
        <div style="
          position: absolute; 
          top: 1.5px; left: 1.5px; 
          width: calc(100% - 3px); height: calc(100% - 3px);
          background: ${colorBase}; 
          clip-path: ${triClipPath};
          display: flex;
          align-items: center;
          justify-content: center;
        "></div>
      </div>
    `, 
    iconSize: [36, 36], iconAnchor: [18, 36], className: ''
  });
};

const crearIconoSector = (isActive, sector, mesesOrden) => {
  const postes = sector.luminarias || [];
  const auditados = postes.filter(lum => lum.estadoAuditoria && lum.estadoAuditoria !== 'pendiente').length;
  const esCompletamenteCensado = postes.length > 0 && auditados === postes.length;

  if (esCompletamenteCensado) {
    return crearIconoSectorPersonalizado(isActive, '#10b981'); 
  }

  const recibos = sector.recibos || [];
  const ultimoRecibo = [...recibos].sort((a, b) => {
    const anioDiff = parseInt(b.anio) - parseInt(a.anio);
    return anioDiff !== 0 ? anioDiff : mesesOrden.indexOf(b.mes?.substring(0,3)) - mesesOrden.indexOf(a.mes?.substring(0,3));
  })[0];

  const consumoUltimo = ultimoRecibo ? parseFloat(ultimoRecibo.consumoKwh) : 0;
  const limiteMax = parseFloat(sector.consumoMaximo) || 0;
  const esAlerta = consumoUltimo > limiteMax && limiteMax > 0;

  let color = '#2563eb'; 
  if (esAlerta) color = '#dc2626'; 
  else if (sector.clasificacion?.toUpperCase().includes("INMUEBLE")) color = '#ff8c00ff'; 

  return crearIconoSectorPersonalizado(isActive, color);
};

const crearIconoPoste3D = (luminariasPorPoste = 1, estado = 'pendiente') => {
  const numLamps = parseInt(luminariasPorPoste) >= 2 ? 2 : 1;
  let colorLuz = '#38bdf8'; 
  if (estado === 'ok') colorLuz = '#10b981';
  if (estado === 'falla') colorLuz = '#f59e0b'; 
  if (estado === 'irregular') colorLuz = '#a855f7'; 
  if (estado === 'no_existe') colorLuz = '#dc2626'; 

  const cabezalesHtml = numLamps >= 2 
    ? `<div style="display: flex; gap: 6px; align-items: flex-end;">
        <div style="width: 14px; height: 8px; background: linear-gradient(to bottom, ${colorLuz}, #0369a1); border-radius: 4px 4px 0 0; box-shadow: 0 0 10px ${colorLuz};"></div>
        <div style="width: 14px; height: 8px; background: linear-gradient(to bottom, ${colorLuz}, #0369a1); border-radius: 4px 4px 0 0; box-shadow: 0 0 10px ${colorLuz};"></div>
       </div>`
    : `<div style="width: 18px; height: 9px; background: linear-gradient(to bottom, ${colorLuz}, #0369a1); border-radius: 6px 6px 0 0; box-shadow: 0 0 12px ${colorLuz};"></div>`;

  return L.divIcon({
    html: `
      <div style="
        position: relative; width: 60px; height: 60px;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        transform: translateY(-10px); filter: drop-shadow(0 6px 6px rgba(0,0,0,0.7));
      ">
        <div style="position: absolute; bottom: 2px; width: 44px; height: 24px; background: radial-gradient(circle, ${colorLuz}88 0%, rgba(56,189,248,0) 70%); border-radius: 50%;"></div>
        ${cabezalesHtml}
        <div style="width: 3px; height: 32px; background: linear-gradient(90deg, #94a3b8, #cbd5e1, #475569); border-radius: 1px;"></div>
        <div style="width: 10px; height: 5px; background: #334155; border-radius: 2px; border: 1px solid #64748b;"></div>
      </div>
    `,
    iconSize: [60, 60],
    iconAnchor: [30, 50]
  });
};

const iconoTrianguloAzulNuevo = crearIconoSectorPersonalizado(true, '#2563eb');

const CapturarClicMapa = ({ activoLuminaria, activoSector, onAgregarCoordenada }) => {
  useMapEvents({
    click(e) {
      if (activoLuminaria || activoSector) {
        onAgregarCoordenada(e.latlng);
      }
    },
  });
  return null;
};

const Censo = () => {
  const { todosLosSectores, cargarSectoresGlobal, loadingGlobal, setTodosLosSectores } = useApp();
  const [sectorSeleccionado, setSectorSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [colaPendientes, setColaPendientes] = useState([]);

  const [panelMinimizado, setPanelMinimizado] = useState(false);
  const [modalListaSectores, setModalListaSectores] = useState(false);

  const [modoSeguimiento, setModoSeguimiento] = useState(false);
  const [posicionGPS, setPosicionGPS] = useState(null);
  const watchIdRef = useRef(null);

  const [editandoSector, setEditandoSector] = useState(false);
  const [editandoPoste, setEditandoPoste] = useState(false);

  const [luminariaSeleccionada, setLuminariaSeleccionada] = useState(null);
  const [modoCrearLuminaria, setModoCrearLuminaria] = useState(false);
  const [postesTemporales, setPostesTemporales] = useState([]);
  const [nuevaLuminariaForm, setNuevaLuminariaForm] = useState({
    cantidad_postes: 1, latitud: '', longitud: '', tipo_lampara: 'LED', descripcion: '', luminarias_por_poste: 1, capacidad: '70'
  });
  
  const [modoCrearSector, setModoCrearSector] = useState(false);
  const [nuevoSectorForm, setNuevoSectorForm] = useState({
    clave: '', clasificacion: 'ALUMBRADO PUBLICO', nombreColonia: '', latitud: '', longitud: '', consumo_ideal: 0, consumo_aceptable: 0, consumo_maximo: 0, medidor: '', cuenta: '', carga: 0, cpd: 0, tarifa: '07'
  });

  const mesesOrden = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

  const sincronizarCambiosPendientes = useCallback(async () => {
    try {
      const guardados = localStorage.getItem('cola_cambios_offline');
      if (!guardados) return;
      const cola = JSON.parse(guardados);
      if (cola.length === 0) return;

      setSaving(true);
      for (const item of cola) {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: item.payload })
        });
      }

      localStorage.removeItem('cola_cambios_offline');
      setColaPendientes([]);
      setSaving(false);
      setMensaje({ tipo: 'exito', texto: '✨ Cambios offline sincronizados con éxito!' });
      setTimeout(() => setMensaje(null), 4000);
      cargarSectoresGlobal(true);
    } catch (e) {
      setSaving(false);
      console.error("Error al sincronizar cola offline:", e);
    }
  }, [cargarSectoresGlobal]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setMensaje({ tipo: 'exito', texto: '🌐 Conectado. Sincronizando...' });
      setTimeout(() => setMensaje(null), 4000);
      sincronizarCambiosPendientes();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setMensaje({ tipo: 'error', texto: '⚠️ Sin internet. Modo Offline activado.' });
      setTimeout(() => setMensaje(null), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    try {
      const guardados = localStorage.getItem('cola_cambios_offline');
      if (guardados) setColaPendientes(JSON.parse(guardados));
    } catch (e) {
      console.warn("Error cargando cola offline:", e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sincronizarCambiosPendientes]);

  const guardarCambioOffline = (tipo, payload) => {
    const nuevoItem = { idTemp: Date.now(), tipo, payload };
    const nuevaCola = [...colaPendientes, nuevoItem];
    setColaPendientes(nuevaCola);
    try {
      localStorage.setItem('cola_cambios_offline', JSON.stringify(nuevaCola));
    } catch (e) {
      console.warn("No se pudo guardar en cola offline:", e);
    }
  };

  useEffect(() => {
    cargarSectoresGlobal();
  }, [cargarSectoresGlobal]);

  useEffect(() => {
    if (sectorSeleccionado) {
      const actualizado = todosLosSectores.find(s => String(s.id) === String(sectorSeleccionado.id));
      if (actualizado) {
        setSectorSeleccionado(actualizado);
        if (luminariaSeleccionada) {
          const lumActualizada = actualizado.luminarias?.find(l => String(l.id) === String(luminariaSeleccionada.id));
          if (lumActualizada) setLuminariaSeleccionada(lumActualizada);
        }
      }
    }
  }, [todosLosSectores, sectorSeleccionado, luminariaSeleccionada]);

  const seleccionarSectorLocal = useCallback((idSector) => {
    const encontrado = todosLosSectores.find(s => String(s.id) === String(idSector));
    if (encontrado) {
      setSectorSeleccionado(encontrado);
      setLuminariaSeleccionada(null);
      setModalListaSectores(false);
      setPanelMinimizado(false);
      setMensaje({ tipo: 'exito', texto: `⚡ Sector ${encontrado.clave} seleccionado.` });
      setTimeout(() => setMensaje(null), 2500);
    } else {
      setMensaje({ tipo: 'error', texto: `⚠️ Sector no encontrado.` });
      setTimeout(() => setMensaje(null), 3000);
    }
  }, [todosLosSectores]);

  useEffect(() => {
    if (modoSeguimiento) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const nuevaPos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setPosicionGPS(nuevaPos);

          if (todosLosSectores.length > 0) {
            let sectorMasCercano = null;
            let posteMasCercano = null;
            let menorDistanciaPoste = Infinity;

            todosLosSectores.forEach(sec => {
              if (sec.luminarias && sec.luminarias.length > 0) {
                sec.luminarias.forEach(lum => {
                  if (lum.latitud && lum.longitud) {
                    const dist = L.latLng(nuevaPos.lat, nuevaPos.lng).distanceTo([parseFloat(lum.latitud), parseFloat(lum.longitud)]);
                    if (dist < menorDistanciaPoste) {
                      menorDistanciaPoste = dist;
                      posteMasCercano = lum;
                      sectorMasCercano = sec;
                    }
                  }
                });
              }
            });

            if (posteMasCercano && sectorMasCercano && menorDistanciaPoste <= 40) {
              if (!sectorSeleccionado || String(sectorSeleccionado.id) !== String(sectorMasCercano.id)) {
                setSectorSeleccionado(sectorMasCercano);
              }
              setLuminariaSeleccionada(posteMasCercano);
              if (window.innerWidth < 768) {
                setPanelMinimizado(false);
              }
            }
          }
        },
        (err) => console.error("Error GPS automático:", err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [modoSeguimiento, sectorSeleccionado, todosLosSectores]);

  const sugerenciasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return [];
    return todosLosSectores.filter(s => 
      s.clave?.toLowerCase().includes(busqueda.toLowerCase()) || 
      s.nombreColonia?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.medidor?.toLowerCase().includes(busqueda.toLowerCase())
    ).slice(0, 6);
  }, [busqueda, todosLosSectores]);

  const guardarYSalirSector = () => {
    setSectorSeleccionado(null);
    setLuminariaSeleccionada(null);
    setModoCrearLuminaria(false);
    setPostesTemporales([]);
    setModoCrearSector(false);
    setBusqueda('');
    setMensaje({ tipo: 'exito', texto: '💾 Sector cerrado. Selecciona otro.' });
    setTimeout(() => setMensaje(null), 3000);
  };

  const limpiarYReiniciarCensoSector = () => {
    if (!sectorSeleccionado) return;
    if (!window.confirm(`🧹 ¿Limpiar y reiniciar el censo del sector "${sectorSeleccionado.clave}"? Todos los postes volverán a estado pendiente para un nuevo ciclo de censado anual.`)) return;

    setSaving(true);
    const luminariasLimpias = sectorSeleccionado.luminarias.map(lum => ({
      ...lum,
      estadoAuditoria: 'pendiente',
      observacion: ''
    }));

    const sectorActualizado = { ...sectorSeleccionado, luminarias: luminariasLimpias };
    setSectorSeleccionado(sectorActualizado);

    const listaActualizada = todosLosSectores.map(sec => String(sec.id) === String(sectorActualizado.id) ? sectorActualizado : sec);
    setTodosLosSectores(listaActualizada);

    const promesas = luminariasLimpias.map(lum => {
      const mutation = `mutation { actualizarLuminariaAuditoria(id: "${lum.id}", estado: "pendiente", observacion: "") { id } }`;
      if (!navigator.onLine) {
        guardarCambioOffline('AUDITORIA_POSTE', mutation);
        return Promise.resolve();
      }
      return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation })
      }).catch(() => guardarCambioOffline('AUDITORIA_POSTE', mutation));
    });

    Promise.all(promesas).then(() => {
      setSaving(false);
      setMensaje({ tipo: 'exito', texto: '✨ ¡Sector limpiado con éxito! Listo para un nuevo censo.' });
      setTimeout(() => setMensaje(null), 3000);
    });
  };

  const obtenerTotalesSector = (sec) => {
    const postes = sec?.luminarias?.length || 0;
    const auditados = sec?.luminarias?.filter(lum => lum.estadoAuditoria && lum.estadoAuditoria !== 'pendiente')?.length || 0;
    const porcentaje = postes > 0 ? Math.round((auditados / postes) * 100) : 0;
    return { postes, auditados, porcentaje };
  };

  const totalesSectorActual = obtenerTotalesSector(sectorSeleccionado);

  const actualizarAuditoriaPoste = (posteId, nuevoEstado, observacionTexto = '') => {
    if (!sectorSeleccionado) return;
    
    let yaEstabaCompletoAntes = totalesSectorActual.porcentaje === 100;

    const luminariasActualizadas = sectorSeleccionado.luminarias.map(lum => {
      if (String(lum.id) === String(posteId)) {
        return { ...lum, estadoAuditoria: nuevoEstado, observacion: observacionTexto };
      }
      return lum;
    });

    const sectorActualizado = { ...sectorSeleccionado, luminarias: luminariasActualizadas };
    setSectorSeleccionado(sectorActualizado);

    const listaActualizada = todosLosSectores.map(sec => String(sec.id) === String(sectorActualizado.id) ? sectorActualizado : sec);
    setTodosLosSectores(listaActualizada);

    const nuevosTotales = obtenerTotalesSector(sectorActualizado);
    if (!yaEstabaCompletoAntes && nuevosTotales.porcentaje === 100) {
      reproducirAlertaCensoCompletado();
    }

    const mutation = `
      mutation {
        actualizarLuminariaAuditoria(id: "${posteId}", estado: "${nuevoEstado}", observacion: "${observacionTexto || ''}") { id }
      }
    `;
    if (!navigator.onLine) {
      guardarCambioOffline('AUDITORIA_POSTE', mutation);
      setMensaje({ tipo: 'exito', texto: `✓ Poste #${posteId} guardado (Offline).` });
    } else {
      fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) }).catch(() => {
        guardarCambioOffline('AUDITORIA_POSTE', mutation);
      });
      setMensaje({ tipo: 'exito', texto: `✓ Poste #${posteId} auditado.` });
    }
    
    setTimeout(() => {
      setLuminariaSeleccionada(null);
      setMensaje(null);
      if (window.innerWidth < 768) {
        setPanelMinimizado(true);
      }
    }, 400);
  };

  const handleMapaClick = (latlng) => {
    if (modoCrearLuminaria) {
      const nuevoPostePin = {
        idTemp: 'temp_' + Date.now() + Math.random(),
        latitud: latlng.lat,
        longitud: latlng.lng,
        tipo_lampara: nuevaLuminariaForm.tipo_lampara,
        capacidad: nuevaLuminariaForm.capacidad,
        cantidad_postes: parseInt(nuevaLuminariaForm.cantidad_postes || 1),
        luminarias_por_poste: parseInt(nuevaLuminariaForm.luminarias_por_poste || 1),
        descripcion: nuevaLuminariaForm.descripcion || ''
      };
      setPostesTemporales(prev => [...prev, nuevoPostePin]);
      setMensaje({ tipo: 'exito', texto: `📍 Poste #${postesTemporales.length + 1} marcado en borrador.` });
      setTimeout(() => setMensaje(null), 2000);
    } else if (modoCrearSector) {
      setNuevoSectorForm(prev => ({ ...prev, latitud: latlng.lat, longitud: latlng.lng }));
      setMensaje({ tipo: 'exito', texto: '📍 Ubicación capturada para el sector.' });
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  const guardarLotesPostes = async () => {
    if (!sectorSeleccionado || postesTemporales.length === 0) return;
    setSaving(true);
    setMensaje({ tipo: 'exito', texto: '⏳ Guardando postes y actualizando mapa...' });

    const promesas = postesTemporales.map(poste => {
      const mutation = `
        mutation {
          crearLuminaria(input: {
            sectorId: ${parseInt(sectorSeleccionado.id)},
            cantidadPostes: ${poste.cantidad_postes},
            latitud: ${poste.latitud},
            longitud: ${poste.longitud},
            tipoLampara: "${poste.tipo_lampara}",
            descripcion: "${poste.descripcion}",
            luminariasPorPoste: ${poste.luminarias_por_poste},
            capacidad: "${poste.capacidad}"
          }) { id }
        }
      `;

      if (!navigator.onLine) {
        guardarCambioOffline('CREAR_LUMINARIA', mutation);
        return Promise.resolve();
      }

      return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation })
      }).catch(() => guardarCambioOffline('CREAR_LUMINARIA', mutation));
    });

    await Promise.all(promesas);

    setSaving(false);
    setModoCrearLuminaria(false);
    setPostesTemporales([]);
    
    cargarSectoresGlobal(true);
    
    setMensaje({ tipo: 'exito', texto: '✨ ¡Postes guardados con éxito! Haz clic en el sector para verlos pintados en el mapa.' });
    setTimeout(() => setMensaje(null), 4500);
  };

  const guardarCambiosSector = () => {
    if (!sectorSeleccionado) return;
    setSaving(true);
    const mutation = `
      mutation {
        actualizarSector(input: {
          id: "${sectorSeleccionado.id}",
          clave: "${sectorSeleccionado.clave || ''}",
          clasificacion: "${sectorSeleccionado.clasificacion || ''}",
          nombreColonia: "${sectorSeleccionado.nombreColonia || ''}",
          consumoIdeal: ${parseFloat(sectorSeleccionado.consumoIdeal || 0)},
          consumoAceptable: ${parseFloat(sectorSeleccionado.consumoAceptable || 0)},
          consumoMaximo: ${parseFloat(sectorSeleccionado.consumoMaximo || 0)},
          medidor: "${sectorSeleccionado.medidor || ''}",
          cuenta: "${sectorSeleccionado.cuenta || ''}",
          carga: ${parseFloat(sectorSeleccionado.carga || 0)},
          cpd: ${parseFloat(sectorSeleccionado.cpd || 0)},
          tarifa: "${sectorSeleccionado.tarifa || '07'}"
        }) { id clave }
      }
    `;

    if (!navigator.onLine) {
      guardarCambioOffline('ACTUALIZAR_SECTOR', mutation);
      setSaving(false);
      setEditandoSector(false);
      setMensaje({ tipo: 'exito', texto: '💾 Sector guardado (Offline).' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setMensaje({ tipo: 'exito', texto: '💾 Sector actualizado.' });
          setEditandoSector(false);
          cargarSectoresGlobal(true);
        }
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(() => {
        guardarCambioOffline('ACTUALIZAR_SECTOR', mutation);
        setSaving(false);
        setEditandoSector(false);
        setMensaje({ tipo: 'exito', texto: '💾 Sin red. Guardado en cola.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const eliminarSectorSeleccionado = () => {
    if (!sectorSeleccionado) return;
    if (!window.confirm(`⚠️ ¿Estás seguro de eliminar el sector "${sectorSeleccionado.clave}" y todas sus luminarias? Esta acción no se puede deshacer.`)) return;
    
    setSaving(true);
    const sectorIdActual = sectorSeleccionado.id;
    
    const sectorEliminadoId = String(sectorIdActual);
    const listaRestante = todosLosSectores.filter(s => String(s.id) !== sectorEliminadoId);
    setTodosLosSectores(listaRestante);
    setSectorSeleccionado(null);
    setLuminariaSeleccionada(null);

    const mutation = `mutation { eliminarSector(id: "${sectorIdActual}") }`;

    if (!navigator.onLine) {
      guardarCambioOffline('ELIMINAR_SECTOR', mutation);
      setSaving(false);
      setMensaje({ tipo: 'exito', texto: '🗑️ Sector eliminado (Offline).' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(() => {
        setSaving(false);
        setMensaje({ tipo: 'exito', texto: '🗑️ Sector eliminado correctamente.' });
        cargarSectoresGlobal(true);
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(() => {
        guardarCambioOffline('ELIMINAR_SECTOR', mutation);
        setSaving(false);
        setMensaje({ tipo: 'exito', texto: '🗑️ Sin red. Guardado en cola.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const guardarCambiosLuminaria = () => {
    if (!luminariaSeleccionada) return;
    setSaving(true);
    const mutation = `
      mutation {
        actualizarLuminaria(input: {
          id: "${luminariaSeleccionada.id}",
          cantidadPostes: ${parseInt(luminariaSeleccionada.cantidadPostes || 1)},
          luminariasPorPoste: ${parseInt(luminariaSeleccionada.luminariasPorPoste || 1)},
          tipoLampara: "${luminariaSeleccionada.tipoLampara || 'LED'}",
          capacidad: "${luminariaSeleccionada.capacidad || '70'}",
          descripcion: "${luminariaSeleccionada.descripcion || ''}"
        }) { id }
      }
    `;

    if (!navigator.onLine) {
      guardarCambioOffline('ACTUALIZAR_LUMINARIA', mutation);
      setSaving(false);
      setEditandoPoste(false);
      setMensaje({ tipo: 'exito', texto: '⚡ Poste guardado (Offline).' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setMensaje({ tipo: 'exito', texto: '⚡ Poste actualizado.' });
          setEditandoPoste(false);
          cargarSectoresGlobal(true);
        }
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(() => {
        guardarCambioOffline('ACTUALIZAR_LUMINARIA', mutation);
        setSaving(false);
        setEditandoPoste(false);
        setMensaje({ tipo: 'exito', texto: '⚡ Sin red. Guardado en cola.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const eliminarLuminariaSeleccionada = () => {
    if (!sectorSeleccionado || !luminariaSeleccionada) return;
    if (!window.confirm(`¿Eliminar poste #${luminariaSeleccionada.id}?`)) return;
    
    setSaving(true);
    const posteIdAEliminar = String(luminariaSeleccionada.id);

    const luminariasFiltradas = sectorSeleccionado.luminarias.filter(l => String(l.id) !== posteIdAEliminar);
    const sectorActualizado = { ...sectorSeleccionado, luminarias: luminariasFiltradas };
    setSectorSeleccionado(sectorActualizado);
    setTodosLosSectores(prev => prev.map(s => String(s.id) === String(sectorActualizado.id) ? sectorActualizado : s));
    setLuminariaSeleccionada(null);

    const mutation = `mutation { eliminarLuminaria(id: "${posteIdAEliminar}") }`;

    if (!navigator.onLine) {
      guardarCambioOffline('ELIMINAR_LUMINARIA', mutation);
      setSaving(false);
      setMensaje({ tipo: 'exito', texto: '🗑️ Poste eliminado (Offline).' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error backend eliminando luminaria:", resData.errors);
          setMensaje({ tipo: 'error', texto: '⚠️ Error al eliminar en servidor.' });
        } else {
          setMensaje({ tipo: 'exito', texto: '🗑️ Poste eliminado correctamente.' });
        }
        cargarSectoresGlobal(true);
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(() => {
        guardarCambioOffline('ELIMINAR_LUMINARIA', mutation);
        setSaving(false);
        setMensaje({ tipo: 'exito', texto: '🗑️ Sin red. Guardado en cola.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const guardarNuevoSector = () => {
    setSaving(true);
    const mutation = `
      mutation {
        crearSector(input: {
          clave: "${nuevoSectorForm.clave}", clasificacion: "${nuevoSectorForm.clasificacion}", nombreColonia: "${nuevoSectorForm.nombreColonia}",
          latitud: ${parseFloat(nuevoSectorForm.latitud)}, longitud: ${parseFloat(nuevoSectorForm.longitud)},
          consumoIdeal: ${parseFloat(nuevoSectorForm.consumo_ideal)}, consumoAceptable: ${parseFloat(nuevoSectorForm.consumo_aceptable)},
          consumoMaximo: ${parseFloat(nuevoSectorForm.consumo_maximo)}, medidor: "${nuevoSectorForm.medidor}", cuenta: "${nuevoSectorForm.cuenta}",
          carga: ${parseFloat(nuevoSectorForm.carga)}, cpd: ${parseFloat(nuevoSectorForm.cpd)}, tarifa: "${nuevoSectorForm.tarifa}"
        }) { id clave clasificacion latitud longitud nombreColonia medidor cuenta }
      }
    `;

    if (!navigator.onLine) {
      guardarCambioOffline('CREAR_SECTOR', mutation);
      setSaving(false);
      setModoCrearSector(false);
      setMensaje({ tipo: 'exito', texto: '🏢 Sector registrado (Offline).' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors && resData.data?.crearSector) {
          const nuevoSecServidor = { ...resData.data.crearSector, luminarias: [] };
          const listaActualizada = [...todosLosSectores, nuevoSecServidor];
          
          setTodosLosSectores(listaActualizada);
          setSectorSeleccionado(nuevoSecServidor);
          setModoCrearSector(false);
          setMensaje({ tipo: 'exito', texto: `🏢 Sector registrado correctamente.` });
        } else {
          cargarSectoresGlobal(true);
          setModoCrearSector(false);
          setMensaje({ tipo: 'exito', texto: `🏢 Sector registrado.` });
        }
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(() => {
        guardarCambioOffline('CREAR_SECTOR', mutation);
        setSaving(false);
        setModoCrearSector(false);
        setMensaje({ tipo: 'exito', texto: '🏢 Sin red. Guardado en cola.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const renderizarContenidoPanel = () => {
    if (modoCrearSector) {
      return (
        <div className="space-y-2 text-xs">
          <p className="text-[9px] text-slate-400">{nuevoSectorForm.latitud ? '✅ Coordenada capturada.' : '👉 Haz clic en el mapa para marcar ubicación del sector.'}</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Clave (Ej. SEC-080)" value={nuevoSectorForm.clave} onChange={e => setNuevoSectorForm({...nuevoSectorForm, clave: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded-xl text-white font-semibold text-xs" />
            <input type="text" placeholder="RPU / Medidor" value={nuevoSectorForm.medidor} onChange={e => setNuevoSectorForm({...nuevoSectorForm, medidor: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded-xl text-white font-semibold text-xs" />
          </div>
          <input type="text" placeholder="Nombre de Colonia" value={nuevoSectorForm.nombreColonia} onChange={e => setNuevoSectorForm({...nuevoSectorForm, nombreColonia: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded-xl text-white font-semibold text-xs" />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModoCrearSector(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl font-black uppercase cursor-pointer text-xs">Cancelar</button>
            <button type="button" onClick={guardarNuevoSector} disabled={saving || !nuevoSectorForm.latitud} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-black uppercase cursor-pointer disabled:opacity-50 shadow-lg">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      );
    }

    if (modoCrearLuminaria) {
      return (
        <div className="space-y-2.5 text-xs">
          <div className="bg-amber-950/50 border border-amber-500/40 p-2.5 rounded-2xl text-amber-200">
            <p className="font-bold flex items-center gap-1">⚡ Modo Pintar Postes Activo</p>
            <p className="text-[10px] mt-0.5 text-slate-300">Toca el mapa para marcar los postes. Llevas <span className="font-black text-amber-400 text-sm">{postesTemporales.length}</span> poste(s) marcado(s).</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Tipo Lámpara:</label>
              <input type="text" value={nuevaLuminariaForm.tipo_lampara} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, tipo_lampara: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Capacidad (Watts):</label>
              <input type="text" value={nuevaLuminariaForm.capacidad} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, capacidad: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Lámparas x Poste:</label>
              <input 
                type="number" 
                min="1" 
                max="6" 
                value={nuevaLuminariaForm.luminarias_por_poste} 
                onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, luminarias_por_poste: parseInt(e.target.value) || 1})} 
                className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" 
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Cant. Postes:</label>
              <input 
                type="number" 
                min="1" 
                value={nuevaLuminariaForm.cantidad_postes} 
                onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, cantidad_postes: parseInt(e.target.value) || 1})} 
                className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" 
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => { setModoCrearLuminaria(false); setPostesTemporales([]); }} 
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-black uppercase cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={guardarLotesPostes} 
              disabled={saving || postesTemporales.length === 0} 
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 rounded-xl font-black uppercase cursor-pointer disabled:opacity-40 shadow-lg"
            >
              {saving ? 'Guardando...' : `Guardar Lote (${postesTemporales.length})`}
            </button>
          </div>
        </div>
      );
    }

    if (luminariaSeleccionada) {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Poste ID / Censo:</p>
              <p className="font-black text-cyan-300 text-sm">Poste #{luminariaSeleccionada.id}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Lámparas:</p>
              <p className="font-black text-emerald-400 text-sm">{luminariaSeleccionada.luminariasPorPoste || 1} Unidades</p>
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Especificación:</p>
              <p className="font-bold text-slate-200 text-xs">{luminariaSeleccionada.tipoLampara || 'LED'} - {luminariaSeleccionada.capacidad || '70'} Watts</p>
            </div>
            <button type="button" onClick={() => setEditandoPoste(!editandoPoste)} className="text-[9px] bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 py-1 rounded-xl font-black uppercase cursor-pointer transition-all">
              {editandoPoste ? 'Cerrar' : 'Editar'}
            </button>
          </div>

          {editandoPoste && (
            <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold">Tipo:</label>
                  <input type="text" value={luminariaSeleccionada.tipoLampara || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, tipoLampara: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" />
                </div>
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold">Capacidad:</label>
                  <input type="text" value={luminariaSeleccionada.capacidad || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, capacidad: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" />
                </div>
                <div>
                  <label className="text-[8px] text-slate-400 uppercase font-bold">Cant. Lamps:</label>
                  <input type="number" value={luminariaSeleccionada.luminariasPorPoste || 1} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, luminariasPorPoste: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded-xl text-white text-xs font-semibold" />
                </div>
              </div>
              <button type="button" onClick={guardarCambiosLuminaria} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-1.5 rounded-xl font-black uppercase cursor-pointer text-xs shadow-lg">Guardar Modificaciones</button>
            </div>
          )}

          <div className="pt-1">
            <button 
              type="button"
              onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'ok', luminariaSeleccionada.observacion)}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                luminariaSeleccionada.estadoAuditoria === 'ok' 
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-300/50 shadow-emerald-500/80 scale-[1.02]' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/60'
              }`}
            >
              <Check size={20} className="stroke-[3]" /> OK
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button 
              type="button"
              onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'falla', luminariaSeleccionada.observacion)}
              className={`py-2 px-1 rounded-xl font-bold text-[10px] uppercase cursor-pointer transition-all flex flex-col items-center gap-0.5 ${luminariaSeleccionada.estadoAuditoria === 'falla' ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'}`}
            >
              <AlertTriangle size={13} className="text-amber-400" /> No enciende
            </button>
            <button 
              type="button"
              onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'irregular', luminariaSeleccionada.observacion)}
              className={`py-2 px-1 rounded-xl font-bold text-[10px] uppercase cursor-pointer transition-all flex flex-col items-center gap-0.5 ${luminariaSeleccionada.estadoAuditoria === 'irregular' ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'}`}
            >
              <FileText size={13} className="text-purple-400" /> Irregular
            </button>
            <button 
              type="button"
              onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'no_existe', luminariaSeleccionada.observacion)}
              className={`py-2 px-1 rounded-xl font-bold text-[10px] uppercase cursor-pointer transition-all flex flex-col items-center gap-0.5 ${luminariaSeleccionada.estadoAuditoria === 'no_existe' ? 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'}`}
            >
              <XCircle size={13} className="text-rose-400" /> No existe
            </button>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest block">Observación de campo / Anomalía:</label>
            <textarea 
              rows="2"
              placeholder="Escribe aquí los detalles encontrados..."
              value={luminariaSeleccionada.observacion || ''}
              onChange={(e) => {
                const val = e.target.value;
                setLuminariaSeleccionada({...luminariaSeleccionada, observacion: val});
              }}
              onBlur={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, luminariaSeleccionada.estadoAuditoria || 'pendiente', luminariaSeleccionada.observacion)}
              className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-2xl text-xs font-semibold text-white outline-none focus:border-cyan-500 shadow-inner"
            ></textarea>
          </div>

          <div className="pt-1">
            <button type="button" onClick={eliminarLuminariaSeleccionada} className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 py-1.5 rounded-xl text-[10px] font-black uppercase cursor-pointer border border-rose-500/40 transition-all flex items-center justify-center gap-1.5">
              <Trash2 size={12} /> Eliminar este Poste
            </button>
          </div>
        </div>
      );
    }

    if (sectorSeleccionado) {
      return (
        <div className="space-y-2.5 text-xs">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Total Luminarias (Postes):</p>
                <p className="font-black text-cyan-400 text-sm">{totalesSectorActual.postes} Registradas</p>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Avance Censo:</p>
                  <p className="font-black text-emerald-400 text-sm">{totalesSectorActual.auditados} / {totalesSectorActual.postes} ({totalesSectorActual.porcentaje}%)</p>
                </div>
                {totalesSectorActual.porcentaje === 100 && (
                  <button 
                    type="button"
                    onClick={limpiarYReiniciarCensoSector}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl text-[10px] font-bold uppercase shadow-lg flex items-center gap-1 cursor-pointer transition-all animate-bounce"
                    title="Clean / Reiniciar censo de este sector para nuevo año"
                  >
                    <RotateCcw size={14} /> Clean
                  </button>
                )}
              </div>
            </div>
             
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                <span>Progreso de Actualización</span>
                <span className="text-cyan-300">{totalesSectorActual.porcentaje}% Completado</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 h-full transition-all duration-500 rounded-full shadow-lg"
                  style={{ width: `${totalesSectorActual.porcentaje}%` }}
                ></div>
              </div>
            </div>
          </div>

          {editandoSector ? (
            <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={sectorSeleccionado.clave || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, clave: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded-xl text-white text-xs font-semibold" placeholder="Clave" />
                <input type="text" value={sectorSeleccionado.cuenta || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, cuenta: e.target.value})} className="bg-slate-900 border border-slate-700 p-2 rounded-xl text-white text-xs font-semibold" placeholder="Cuenta" />
              </div>
              <input type="text" value={sectorSeleccionado.nombreColonia || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, nombreColonia: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-xl text-white text-xs font-semibold" placeholder="Colonia" />
              <button type="button" onClick={guardarCambiosSector} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-black uppercase cursor-pointer text-xs shadow-lg">{saving ? 'Guardando...' : 'Guardar Datos Sector'}</button>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Lista de Postes:</p>
                <button 
                  type="button" 
                  onClick={eliminarSectorSeleccionado} 
                  className="text-[9px] text-rose-400 hover:text-rose-300 font-bold uppercase flex items-center gap-1 cursor-pointer bg-rose-950/40 border border-rose-900/60 px-2 py-1 rounded-lg transition-all"
                >
                  <Trash2 size={11} /> Eliminar Sector
                </button>
              </div>
              {sectorSeleccionado.luminarias && sectorSeleccionado.luminarias.length > 0 ? (
                sectorSeleccionado.luminarias.map((lum, idx) => {
                  const est = lum.estadoAuditoria || 'pendiente';
                  const lampsPorPoste = lum.luminariasPorPoste || 1;
                  return (
                    <div 
                      key={lum.id} 
                      onClick={() => { 
                        setLuminariaSeleccionada(lum); 
                        setEditandoPoste(false); 
                        if (window.innerWidth < 768) setPanelMinimizado(false); 
                      }}
                      className={`p-2.5 rounded-2xl border flex justify-between items-center cursor-pointer transition-all hover:border-cyan-500 shadow-sm ${
                        est === 'ok' ? 'bg-emerald-950/40 border-emerald-500/50' : 
                        est === 'falla' ? 'bg-amber-950/40 border-amber-500/50' : 
                        est === 'irregular' ? 'bg-purple-950/40 border-purple-500/50' :
                        est === 'no_existe' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div>
                        <span className="font-black text-cyan-300 text-xs">Poste #{idx + 1} (ID: {lum.id})</span>
                        <p className="text-[10px] text-slate-400 font-semibold">{lampsPorPoste} Lámpara(s) | {lum.tipoLampara || 'LED'} - {lum.capacidad || '70'}W</p>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider ${
                        est === 'ok' ? 'bg-emerald-900 text-emerald-200' :
                        est === 'falla' ? 'bg-amber-900 text-amber-200' :
                        est === 'irregular' ? 'bg-purple-900 text-purple-200' :
                        est === 'no_existe' ? 'bg-rose-900 text-rose-200' : 'bg-slate-800 text-slate-300'
                      }`}>{est === 'pendiente' ? 'Revisar' : est}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-slate-500 text-center py-4">No hay postes registrados en este sector.</p>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-5">
        <Layers size={24} className="text-cyan-400 mx-auto mb-2 animate-bounce" />
        <p className="text-xs font-bold text-slate-200">Ningún sector seleccionado</p>
        <p className="text-[10px] text-slate-400 mt-1">Toca un pin en el mapa, activa <span className="text-cyan-300 font-bold">"GPS Auto"</span> o usa <span className="text-cyan-300 font-bold">"Sectores"</span>.</p>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-60px)] bg-[#070b14] font-sans text-slate-100 overflow-hidden flex flex-col">
       
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer center={[20.628, -87.076]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ForzarRecargaMapa />
          <ActualizarMapa 
            sector={sectorSeleccionado} luminaria={luminariaSeleccionada} 
            modoCrearSector={modoCrearSector} modoCrearLuminaria={modoCrearLuminaria}
            ubicacionUsuario={ubicacionUsuario} modoSeguimiento={modoSeguimiento} posicionGPS={posicionGPS}
          />
          <BotonMiUbicacion 
            ocultar={Boolean(sectorSeleccionado && !modoCrearLuminaria)} 
            onUbicacionObtenida={(coords) => {
              setUbicacionUsuario(coords);
              if (modoCrearSector) setNuevoSectorForm(prev => ({ ...prev, latitud: coords.lat, longitud: coords.lng }));
              else if (modoCrearLuminaria) setNuevaLuminariaForm(prev => ({ ...prev, latitud: coords.lat, longitud: coords.lng }));
            }} 
          />
          <CapturarClicMapa activoLuminaria={modoCrearLuminaria} activoSector={modoCrearSector} onAgregarCoordenada={handleMapaClick} />

          {modoSeguimiento && posicionGPS && (
            <Pane name="gps-vivo" style={{ zIndex: 500 }}>
              <Marker position={[posicionGPS.lat, posicionGPS.lng]} icon={L.divIcon({
                html: `<div style="width: 28px; height: 28px; background: #06b6d4; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 15px #06b6d4; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`,
                iconSize: [28, 28], iconAnchor: [14, 14]
              })} />
            </Pane>
          )}

          {!sectorSeleccionado && !modoCrearSector && (
            <Pane name="todos-sectores" style={{ zIndex: 400 }}>
              {todosLosSectores.map(sec => (
                <Marker 
                  key={`sec-map-${sec.id}`}
                  position={[parseFloat(sec.latitud) || 20.628, parseFloat(sec.longitud) || -87.076]} 
                  icon={crearIconoSector(false, sec, mesesOrden)}
                  eventHandlers={{ 
                    click: () => {
                      seleccionarSectorLocal(sec.id);
                    } 
                  }}
                />
              ))}
            </Pane>
          )}

          {!modoCrearSector && sectorSeleccionado && (
            <Pane name="sector-activo" style={{ zIndex: 400 }}>
              <Marker 
                position={[parseFloat(sectorSeleccionado.latitud) || 20.628, parseFloat(sectorSeleccionado.longitud) || -87.076]} 
                icon={crearIconoSector(true, sectorSeleccionado, mesesOrden)}
                eventHandlers={{ click: () => { setLuminariaSeleccionada(null); setModoCrearLuminaria(false); setPostesTemporales([]); setEditandoSector(false); } }}
              />
            </Pane>
          )}

          {!modoCrearSector && sectorSeleccionado?.luminarias?.map((lum) => {
            const esSeleccionada = String(luminariaSeleccionada?.id) === String(lum.id);
            const lat = parseFloat(lum.latitud) || 20.628;
            const lng = parseFloat(lum.longitud) || -87.076;
            const porPoste = parseInt(lum.luminariasPorPoste) || 1;

            if (esSeleccionada) {
              return (
                <React.Fragment key={`lum-active-${lum.id}`}>
                  <CircleMarker center={[lat, lng]} radius={16} pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.35, weight: 3 }} />
                  <Marker position={[lat, lng]} icon={crearIconoPoste3D(porPoste, lum.estadoAuditoria)} eventHandlers={{ click: () => { setLuminariaSeleccionada(lum); if (window.innerWidth < 768) setPanelMinimizado(false); } }} />
                </React.Fragment>
              );
            }

            let colorPin = '#dc2626'; 
            if (lum.estadoAuditoria === 'ok') colorPin = '#10b981';
            if (lum.estadoAuditoria === 'falla') colorPin = '#f59e0b';
            if (lum.estadoAuditoria === 'irregular') colorPin = '#a855f7';
            if (lum.estadoAuditoria === 'no_existe') colorPin = '#64748b';

            return (
              <CircleMarker 
                key={`lum-circle-${lum.id}`} 
                center={[lat, lng]} 
                radius={9} 
                pathOptions={{ 
                  color: '#0f172a', 
                  fillColor: colorPin, 
                  fillOpacity: 0.9, 
                  weight: 1.5, 
                  pane: 'markerPane' 
                }}
                eventHandlers={{ 
                  click: () => { 
                    setLuminariaSeleccionada(lum); 
                    if (window.innerWidth < 768) {
                      setPanelMinimizado(false);
                    }
                  } 
                }}
              />
            );
          })}

          {modoCrearLuminaria && postesTemporales.map((p, idx) => (
            <Marker 
              key={`temp-pin-${p.idTemp}`} 
              position={[p.latitud, p.longitud]} 
              icon={L.divIcon({
                html: `<div style="width: 26px; height: 26px; background: #f59e0b; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #f59e0b;"><span style="color: black; font-weight: bold; font-size: 11px;">${idx + 1}</span></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
              })} 
            />
          ))}

          {modoCrearSector && nuevoSectorForm.latitud && (
            <Marker position={[nuevoSectorForm.latitud, nuevoSectorForm.longitud]} icon={iconoTrianguloAzulNuevo} />
          )}
        </MapContainer>
      </div>

      <div className={`absolute z-10 pointer-events-none flex p-3 md:p-4 gap-3 transition-all duration-300 ${panelMinimizado ? 'bottom-2 left-3 right-3 md:left-4 md:w-[440px]' : 'inset-x-2 top-2 bottom-2 md:inset-auto md:top-4 md:left-4 md:w-[440px] md:max-h-[calc(100vh-32px)]'}`}>
        <div className="pointer-events-auto w-full bg-slate-950/95 border border-slate-800/90 p-3.5 md:p-4 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col h-full max-h-full">
            
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-2 rounded-xl text-white shadow-lg">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h1 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                  Auditoria Express <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-md border border-cyan-500/30">Móvil</span>
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {isOnline ? (
                    <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><Wifi size={9} /> Online {colaPendientes.length > 0 ? `(${colaPendientes.length})` : ''}</span>
                  ) : (
                    <span className="text-[9px] text-amber-400 font-bold flex items-center gap-1 animate-pulse"><WifiOff size={9} /> Offline ({colaPendientes.length} por subir)</span>
                  )}
                  {colaPendientes.length > 0 && isOnline && (
                    <button type="button" onClick={sincronizarCambiosPendientes} className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 cursor-pointer">
                      <CloudUpload size={10} /> Subir
                    </button>
                  )}
                </div>
              </div>
            </div>
             
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={() => setPanelMinimizado(!panelMinimizado)} 
                className="bg-slate-900 text-cyan-400 border border-slate-700 p-1.5 rounded-xl cursor-pointer"
                title={panelMinimizado ? "Expandir panel" : "Minimizar panel para ver mapa"}
              >
                {panelMinimizado ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {!panelMinimizado && (
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 mt-2">
               
              <div className="flex items-center justify-between gap-1.5">
                <button 
                  type="button"
                  onClick={() => setModalListaSectores(true)}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <List size={14} /> Sectores ({todosLosSectores.length})
                </button>
                <button 
                  type="button"
                  onClick={() => { setModoCrearSector(true); setSectorSeleccionado(null); setLuminariaSeleccionada(null); setModoCrearLuminaria(false); setPostesTemporales([]); }} 
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer shadow-md flex items-center gap-1"
                >
                  <Plus size={12} /> Sector
                </button>
                <button 
                  type="button"
                  onClick={() => setModoSeguimiento(!modoSeguimiento)} 
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer border flex items-center gap-1 ${
                    modoSeguimiento ? 'bg-emerald-600 text-white animate-pulse shadow-lg border-emerald-400' : 'bg-slate-900 text-cyan-400 border-slate-700'
                  }`}
                  title="Activar seguimiento automático por GPS en auto"
                >
                  <Disc size={12} /> {modoSeguimiento ? 'GPS Auto' : 'GPS'}
                </button>
                <button 
                  type="button"
                  onClick={() => { cargarSectoresGlobal(true); if(isOnline) sincronizarCambiosPendientes(); }} 
                  className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 p-2 rounded-xl cursor-pointer" 
                  title="Sincronizar"
                >
                  <RefreshCw size={13} className={loadingGlobal ? "animate-spin text-cyan-400" : ""} />
                </button>
              </div>

              {mensaje && (
                <div className="px-3 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 border shadow-xl bg-slate-900/95 border-emerald-500/50 text-emerald-200 animate-fadeIn">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>{mensaje.texto}</span>
                </div>
              )}

              {sectorSeleccionado && (
                <button 
                  type="button"
                  onClick={guardarYSalirSector}
                  className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 py-2 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <ArrowLeft size={13} /> Change Sector
                </button>
              )}

              <div className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="🔍 Buscar clave, colonia o RPU..." 
                    value={busqueda} 
                    onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
                    onFocus={() => setMostrarSugerencias(true)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 pl-9 pr-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-cyan-500 shadow-inner" 
                  />
                </div>

                {mostrarSugerencias && sugerenciasFiltradas.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-44 overflow-y-auto z-50 divide-y divide-slate-800">
                    {sugerenciasFiltradas.map(sec => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          seleccionarSectorLocal(sec.id);
                          setBusqueda(`${sec.clave} - RPU: ${sec.medidor || 'S/N'}`);
                          setMostrarSugerencias(false);
                          setModoCrearLuminaria(false);
                          setPostesTemporales([]);
                          setLuminariaSeleccionada(null);
                          setModoCrearSector(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-cyan-950/60 transition-colors flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-cyan-300">{sec.clave}</p>
                          <p className="text-[10px] text-slate-400">Col: {sec.nombreColonia || 'S/N'} {sec.medidor ? `| RPU: ${sec.medidor}` : ''}</p>
                        </div>
                        <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded-lg font-bold">Elegir</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/70 border border-slate-800/80 p-3 rounded-2xl space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                    <Edit3 size={13} /> 
                    {modoCrearSector ? 'Registrar Sector' : modoCrearLuminaria ? 'Pintar Postes Masivo' : luminariaSeleccionada ? `Auditoría Poste #${luminariaSeleccionada.id}` : sectorSeleccionado ? `Sector: ${sectorSeleccionado.clave}` : 'Selecciona un Sector'}
                  </h3>
                  {sectorSeleccionado && !luminariaSeleccionada && !modoCrearSector && !modoCrearLuminaria && (
                    <button type="button" onClick={() => setEditandoSector(!editandoSector)} className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 cursor-pointer flex items-center gap-1">
                      {editandoSector ? <Unlock size={10} className="text-amber-400" /> : <Lock size={10} />} {editandoSector ? 'Editando' : 'Editar'}
                    </button>
                  )}
                  {luminariaSeleccionada && (
                    <button type="button" onClick={() => { setLuminariaSeleccionada(null); setEditandoPoste(false); }} className="text-[9px] bg-slate-800 text-cyan-400 px-2.5 py-1 rounded-xl font-black uppercase cursor-pointer">← Volver</button>
                  )}
                </div>

                {renderizarContenidoPanel()}

              </div>

            </div>
          )}

          {!panelMinimizado && sectorSeleccionado && !modoCrearSector && !modoCrearLuminaria && (
            <div className="pt-2 shrink-0">
              <button 
                type="button"
                onClick={() => { setLuminariaSeleccionada(null); setPostesTemporales([]); setModoCrearLuminaria(true); }} 
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl shadow-cyan-600/30 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={15} className="stroke-[3]" /> Streetlights 
              </button>
            </div>
          )}

        </div>
      </div>

      {modalListaSectores && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wider">Seleccionar Sector</h3>
                <p className="text-[10px] text-slate-400">Total de sectores disponibles: {todosLosSectores.length}</p>
              </div>
              <button 
                type="button"
                onClick={() => setModalListaSectores(false)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold uppercase border border-slate-700 cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>
             
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex gap-2">
              <input 
                type="text" 
                placeholder="🔍 Filtrar por clave o colonia..." 
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 px-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => { setModalListaSectores(false); setModoCrearSector(true); setSectorSeleccionado(null); setPostesTemporales([]); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap shadow-md cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} /> Nuevo
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-800/60">
              {todosLosSectores
                .filter(s => s.clave?.toLowerCase().includes(busqueda.toLowerCase()) || s.nombreColonia?.toLowerCase().includes(busqueda.toLowerCase()))
                .map(sec => {
                  const totales = obtenerTotalesSector(sec);
                  const censadoTotal = totales.postes > 0 && totales.auditados === totales.postes;
                  return (
                    <div 
                      key={`modal-sec-${sec.id}`}
                      onClick={() => seleccionarSectorLocal(sec.id)}
                      className="pt-2 first:pt-0 pb-2 hover:bg-cyan-950/30 p-2.5 rounded-2xl transition-colors cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-cyan-300">⚡ {sec.clave}</span>
                          {censadoTotal && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">Censado 100%</span>
                          )}
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">RPU: {sec.medidor || 'S/N'}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Colonia: {sec.nombreColonia || 'No especificada'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black ${censadoTotal ? 'text-emerald-400' : 'text-cyan-400'}`}>{totales.auditados} / {totales.postes} Postes</span>
                        <p className="text-[9px] text-slate-500">{totales.porcentaje}% Auditado</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Censo;