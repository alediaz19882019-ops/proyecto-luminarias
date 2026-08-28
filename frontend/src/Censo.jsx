import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  MapPin, Plus, Trash2, Edit3, RefreshCw, 
  Layers, Search, CheckCircle2, Lock, Unlock, Check, Navigation, Disc, AlertTriangle, XCircle, FileText, ArrowLeft 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Pane, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

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
      map.setView([parseFloat(luminaria.latitud), parseFloat(luminaria.longitud)], 19, { animate: true });
    } else if (ubicacionUsuario && (modoCrearSector || modoCrearLuminaria)) {
      map.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 19, { animate: true });
    } else if (sector && sector.latitud && sector.longitud && !modoCrearSector && !modoSeguimiento) {
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
        alert("No se pudo obtener tu ubicación actual. Revisa los permisos de GPS.");
        setCentrando(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <button 
      onClick={irAUbicacionActual}
      className="absolute top-4 right-4 z-[1000] bg-slate-900/95 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 p-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold uppercase backdrop-blur-md transition-all cursor-pointer"
      title="Ir a mi ubicación actual con GPS"
      type="button"
    >
      <Navigation size={15} className={centrando ? "animate-spin text-emerald-400" : ""} />
      <span> GPS </span>
    </button>
  );
};

const crearIconoSectorPersonalizado = (isActive, colorBase = '#2563eb') => {
  const triClipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  return L.divIcon({ 
    html: `
      <div style="
        width: 24px; height: 24px; 
        position: relative; 
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));
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
    iconSize: [32, 32], iconAnchor: [16, 32], className: ''
  });
};

const crearIconoSector = (isActive, sector, mesesOrden) => {
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
const iconoTempLuminaria = L.divIcon({
  html: `<div style="width: 24px; height: 24px; background: #10b981; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);"><span style="color: white; font-weight: bold; font-size: 12px;">⚡</span></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

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

// Memoria global en RAM para evitar recargas dobles en la misma sesión de navegación
let memoriaGlobalCenso = null;

const Censo = () => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [sectorSeleccionado, setSectorSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);

  const [modoSeguimiento, setModoSeguimiento] = useState(false);
  const [posicionGPS, setPosicionGPS] = useState(null);
  const watchIdRef = useRef(null);

  const [editandoSector, setEditandoSector] = useState(false);
  const [editandoPoste, setEditandoPoste] = useState(false);

  const [luminariaSeleccionada, setLuminariaSeleccionada] = useState(null);
  const [modoCrearLuminaria, setModoCrearLuminaria] = useState(false);
  const [nuevaLuminariaForm, setNuevaLuminariaForm] = useState({
    cantidad_postes: 1, latitud: '', longitud: '', tipo_lampara: 'LED', descripcion: '', luminarias_por_poste: 1, capacidad: '70'
  });
  
  const [modoCrearSector, setModoCrearSector] = useState(false);
  const [nuevoSectorForm, setNuevoSectorForm] = useState({
    clave: '', clasificacion: 'ALUMBRADO PUBLICO', nombreColonia: '', latitud: '', longitud: '', consumo_ideal: 0, consumo_aceptable: 0, consumo_maximo: 0, medidor: '', cuenta: '', carga: 0, cpd: 0, tarifa: '07'
  });

  const mesesOrden = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

  // Función optimizada con caché de sesión y bandera anti-duplicados
  const cargarSectoresWithLuminarias = useCallback((forzarRecarga = false) => {
    const cacheKey = 'cache_censo_sectores';
    const flagKey = 'cargando_censo_en_proceso';

    if (!forzarRecarga && memoriaGlobalCenso) {
      setTodosLosSectores(memoriaGlobalCenso);
      return;
    }

    const datosGuardados = sessionStorage.getItem(cacheKey);
    if (!forzarRecarga && datosGuardados) {
      const parsedData = JSON.parse(datosGuardados);
      memoriaGlobalCenso = parsedData;
      setTodosLosSectores(parsedData);
      return;
    }

    if (sessionStorage.getItem(flagKey) === 'true' && !forzarRecarga) return;
    sessionStorage.setItem(flagKey, 'true');

    setLoading(true);
    const query = `{ 
      todosLosSectores { 
        id clave clasificacion latitud longitud consumoIdeal consumoAceptable consumoMaximo nombreColonia medidor cuenta carga cpd tarifa 
        recibos { id anio mes consumoKwh importe lecturaAnterior lecturaActual notasObservaciones } 
        luminarias { id cantidadPostes latitud longitud tipoLampara descripcion luminariasPorPoste capacidad } 
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
          const listaMapeada = data.data.todosLosSectores.map(sec => ({
            ...sec,
            luminarias: sec.luminarias?.map(lum => ({ 
              ...lum, 
              estadoAuditoria: lum.estadoAuditoria || 'pendiente',
              observacion: lum.observacion || ''
            })) || []
          }));
          memoriaGlobalCenso = listaMapeada;
          setTodosLosSectores(listaMapeada);
          sessionStorage.setItem(cacheKey, JSON.stringify(listaMapeada));
        }
        setLoading(false);
      })
      .catch(err => {
        sessionStorage.removeItem(flagKey);
        console.error("Error cargando sectores:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    cargarSectoresWithLuminarias();
  }, [cargarSectoresWithLuminarias]);

  const seleccionarSectorLocal = useCallback((idSector) => {
    const encontrado = todosLosSectores.find(s => String(s.id) === String(idSector));
    if (encontrado) {
      setSectorSeleccionado(encontrado);
      setLuminariaSeleccionada(null);
      setMensaje({ tipo: 'exito', texto: `⚡ Sector ${encontrado.clave} cargado de inmediato.` });
      setTimeout(() => setMensaje(null), 2000);
    } else {
      setMensaje({ tipo: 'error', texto: `⚠️ No se encontró el sector en memoria.` });
      setTimeout(() => setMensaje(null), 3000);
    }
  }, [todosLosSectores]);

  useEffect(() => {
    if (modoSeguimiento) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const nuevaPos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setPosicionGPS(nuevaPos);
          if (!sectorSeleccionado && todosLosSectores.length > 0) {
            let sectorCercano = null;
            let menorDistancia = Infinity;
            todosLosSectores.forEach(sec => {
              if (sec.latitud && sec.longitud) {
                const dist = L.latLng(nuevaPos.lat, nuevaPos.lng).distanceTo([parseFloat(sec.latitud), parseFloat(sec.longitud)]);
                if (dist < menorDistancia) { menorDistancia = dist; sectorCercano = sec; }
              }
            });
            if (sectorCercano && menorDistancia < 3000) {
              seleccionarSectorLocal(sectorCercano.id);
              setMensaje({ tipo: 'exito', texto: `📡 Sector detectado: ${sectorCercano.clave}` });
              setTimeout(() => setMensaje(null), 3000);
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
  }, [modoSeguimiento, sectorSeleccionado, todosLosSectores, seleccionarSectorLocal]);

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
    setModoCrearSector(false);
    setBusqueda('');
    setMensaje({ tipo: 'exito', texto: '💾 Cambios guardados. Selecciona otro sector.' });
    setTimeout(() => setMensaje(null), 3000);
  };

  const actualizarAuditoriaPoste = (posteId, nuevoEstado, observacionTexto = '') => {
    if (!sectorSeleccionado) return;
    const luminariasActualizadas = sectorSeleccionado.luminarias.map(lum => {
      if (String(lum.id) === String(posteId)) {
        return { ...lum, estadoAuditoria: nuevoEstado, observacion: observacionTexto };
      }
      return lum;
    });
    const sectorActualizado = { ...sectorSeleccionado, luminarias: luminariasActualizadas };
    setSectorSeleccionado(sectorActualizado);

    // Actualizar también en la lista general y en la caché local
    const listaActualizada = todosLosSectores.map(sec => String(sec.id) === String(sectorActualizado.id) ? sectorActualizado : sec);
    setTodosLosSectores(listaActualizada);
    memoriaGlobalCenso = listaActualizada;
    sessionStorage.setItem('cache_censo_sectores', JSON.stringify(listaActualizada));

    if (luminariaSeleccionada && String(luminariaSeleccionada.id) === String(posteId)) {
      setLuminariaSeleccionada({ ...luminariaSeleccionada, estadoAuditoria: nuevoEstado, observacion: observacionTexto });
    }
    setMensaje({ tipo: 'exito', texto: `✓ Poste #${posteId} actualizado correctamente.` });
    setTimeout(() => setMensaje(null), 2000);
  };

  const obtenerTotalesSector = (sec) => {
    const postes = sec?.luminarias?.length || 0;
    const auditados = sec?.luminarias?.filter(lum => lum.estadoAuditoria && lum.estadoAuditoria !== 'pendiente')?.length || 0;
    return { postes, auditados };
  };

  const handleMapaClick = (latlng) => {
    if (modoCrearLuminaria) {
      setNuevaLuminariaForm(prev => ({ ...prev, latitud: latlng.lat, longitud: latlng.lng }));
      setMensaje({ tipo: 'exito', texto: '📍 Coordenada capturada para la luminaria.' });
      setTimeout(() => setMensaje(null), 3000);
    } else if (modoCrearSector) {
      setNuevoSectorForm(prev => ({ ...prev, latitud: latlng.lat, longitud: latlng.lng }));
      setMensaje({ tipo: 'exito', texto: '📍 Coordenada capturada para el sector.' });
      setTimeout(() => setMensaje(null), 3000);
    }
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
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setMensaje({ tipo: 'exito', texto: '💾 Sector actualizado correctamente.' });
          setEditandoSector(false);
          memoriaGlobalCenso = null;
          sessionStorage.removeItem('cache_censo_sectores');
          cargarSectoresWithLuminarias(true);
        }
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
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setMensaje({ tipo: 'exito', texto: '⚡ Luminaria actualizada con éxito.' });
          setEditandoPoste(false);
          memoriaGlobalCenso = null;
          sessionStorage.removeItem('cache_censo_sectores');
          cargarSectoresWithLuminarias(true);
        }
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const eliminarLuminariaSeleccionada = () => {
    if (!sectorSeleccionado || !luminariaSeleccionada) return;
    if (!window.confirm(`¿Eliminar poste #${luminariaSeleccionada.id}?`)) return;
    setSaving(true);
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `mutation { eliminarLuminaria(id: "${luminariaSeleccionada.id}") }` }) })
      .then(() => {
        setSaving(false); setLuminariaSeleccionada(null);
        setMensaje({ tipo: 'exito', texto: '🗑️ Luminaria eliminada.' });
        memoriaGlobalCenso = null;
        sessionStorage.removeItem('cache_censo_sectores');
        cargarSectoresWithLuminarias(true);
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const confirmarCrearLuminaria = () => {
    if (!sectorSeleccionado) return;
    setSaving(true);
    const mutation = `
      mutation {
        crearLuminaria(input: {
          sectorId: ${parseInt(sectorSeleccionado.id)},
          cantidadPostes: ${parseInt(nuevaLuminariaForm.cantidad_postes)},
          latitud: ${parseFloat(nuevaLuminariaForm.latitud)},
          longitud: ${parseFloat(nuevaLuminariaForm.longitud)},
          tipoLampara: "${nuevaLuminariaForm.tipo_lampara}",
          descripcion: "${nuevaLuminariaForm.descripcion || ''}",
          luminariasPorPoste: ${parseInt(nuevaLuminariaForm.luminarias_por_poste)},
          capacidad: "${nuevaLuminariaForm.capacidad}"
        }) { id }
      }
    `;
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setModoCrearLuminaria(false);
          setNuevaLuminariaForm({ cantidad_postes: 1, latitud: '', longitud: '', tipo_lampara: 'LED', descripcion: '', luminarias_por_poste: 1, capacidad: '70' });
          setMensaje({ tipo: 'exito', texto: `⚡ Luminaria guardada con éxito.` });
          memoriaGlobalCenso = null;
          sessionStorage.removeItem('cache_censo_sectores');
          cargarSectoresWithLuminarias(true);
        }
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
        }) { id clave }
      }
    `;
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: mutation }) })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (!resData.errors) {
          setModoCrearSector(false);
          setMensaje({ tipo: 'exito', texto: `🏢 Sector registrado correctamente.` });
          memoriaGlobalCenso = null;
          sessionStorage.removeItem('cache_censo_sectores');
          cargarSectoresWithLuminarias(true); 
        }
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const totalesSectorActual = obtenerTotalesSector(sectorSeleccionado);

  return (
    <div className="relative w-full h-[calc(100vh-60px)] bg-[#070b14] font-sans text-slate-100 overflow-hidden flex flex-col">
      
      {/* 1. MAPA DE FONDO INTERACTIVO */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer center={[20.628, -87.076]} zoom={13} style={{ width: '100%', height: '100%' }}>
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

          {/* MARCADOR SECTOR */}
          {!modoCrearSector && sectorSeleccionado && (
            <Pane name="sector-activo" style={{ zIndex: 400 }}>
              <Marker 
                position={[parseFloat(sectorSeleccionado.latitud) || 20.628, parseFloat(sectorSeleccionado.longitud) || -87.076]} 
                icon={crearIconoSector(true, sectorSeleccionado, mesesOrden)}
                eventHandlers={{ click: () => { setLuminariaSeleccionada(null); setModoCrearLuminaria(false); setEditandoSector(false); } }}
              />
            </Pane>
          )}

          {/* LUMINARIAS CON ESTILO CHECKLIST */}
          {!modoCrearSector && sectorSeleccionado?.luminarias?.map((lum) => {
            const esSeleccionada = String(luminariaSeleccionada?.id) === String(lum.id);
            const lat = parseFloat(lum.latitud) || 20.628;
            const lng = parseFloat(lum.longitud) || -87.076;
            const porPoste = parseInt(lum.luminariasPorPoste) || 1;

            if (esSeleccionada) {
              return (
                <React.Fragment key={`lum-active-${lum.id}`}>
                  <Circle center={[lat, lng]} radius={45} pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.25, weight: 3 }} />
                  <Marker position={[lat, lng]} icon={crearIconoPoste3D(porPoste, lum.estadoAuditoria)} eventHandlers={{ click: () => setLuminariaSeleccionada(lum) }} />
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
                key={`lum-circle-${lum.id}`} center={[lat, lng]} radius={8} 
                pathOptions={{ color: '#ffffff', fillColor: colorPin, fillOpacity: 1, weight: 2, pane: 'markerPane' }}
                eventHandlers={{ click: () => { setLuminariaSeleccionada(lum); } }}
              />
            );
          })}

          {modoCrearSector && nuevoSectorForm.latitud && (
            <Marker position={[nuevoSectorForm.latitud, nuevoSectorForm.longitud]} icon={iconoTrianguloAzulNuevo} />
          )}

          {modoCrearLuminaria && nuevaLuminariaForm.latitud && (
            <Marker position={[nuevaLuminariaForm.latitud, nuevaLuminariaForm.longitud]} icon={iconoTempLuminaria} />
          )}
        </MapContainer>
      </div>

      {/* 2. PANEL DE CONTROL COMPACTO Y DINÁMICO (IZQUIERDA) */}
      <div className="relative z-10 pointer-events-none flex h-full p-2.5 gap-2">
        <div className="pointer-events-auto w-full md:w-[400px] bg-slate-950/95 border border-slate-800/80 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col h-auto max-h-[calc(100vh-40px)]">
          
          <div className="space-y-2 overflow-y-auto pr-1">
            
            {/* ENCABEZADO */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
              <div className="flex items-center gap-1.5">
                <div className="bg-cyan-600 p-1 rounded-lg text-white"><MapPin size={13} /></div>
                <div>
                  <h1 className="text-xs font-black tracking-wider uppercase text-white">Auditoría Express</h1>
                  <span className="text-[8px] text-cyan-400 font-bold uppercase">Checklist de Campo</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setModoSeguimiento(!modoSeguimiento)} className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer border ${modoSeguimiento ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-900 text-cyan-400 border-slate-700'}`}>
                  <Disc size={10} className="inline mr-0.5" /> GPS
                </button>
                <button onClick={() => { setModoCrearSector(true); setLuminariaSeleccionada(null); setSectorSeleccionado(null); setModoCrearLuminaria(false); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase cursor-pointer">
                  <Plus size={10} className="inline" /> Sector
                </button>
                <button onClick={() => { memoriaGlobalCenso = null; sessionStorage.removeItem('cache_censo_sectores'); cargarSectoresWithLuminarias(true); }} className="bg-slate-900 text-slate-300 border border-slate-700 p-1 rounded-lg cursor-pointer" title="Sincronizar datos">
                  <RefreshCw size={11} className={loading ? "animate-spin text-cyan-400" : ""} />
                </button>
              </div>
            </div>

            {mensaje && (
              <div className="px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-2 border shadow-lg bg-slate-900 border-emerald-500/40 text-emerald-200">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span>{mensaje.texto}</span>
              </div>
            )}

            {/* BOTÓN DE GUARDAR Y SALIR (CAMBIAR DE SECTOR) SI HAY UN SECTOR ACTIVO */}
            {sectorSeleccionado && (
              <button 
                onClick={guardarYSalirSector}
                className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 py-1.5 px-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <ArrowLeft size={13} /> Guardar y Salir / Cambiar de Sector
              </button>
            )}

            {/* BUSCADOR RPU / AUTOCOMPLETAR */}
            <div className="relative">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Buscar por Clave, Colonia o RPU:</label>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Ej. SEC-001 o número de RPU..." 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
                  onFocus={() => setMostrarSugerencias(true)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none focus:border-cyan-500" 
                />
              </div>

              {mostrarSugerencias && sugerenciasFiltradas.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50">
                  {sugerenciasFiltradas.map(sec => (
                    <button
                      key={sec.id}
                      onClick={() => {
                        seleccionarSectorLocal(sec.id);
                        setBusqueda(`${sec.clave} - RPU: ${sec.medidor || 'S/N'}`);
                        setMostrarSugerencias(false);
                        setModoCrearLuminaria(false);
                        setLuminariaSeleccionada(null);
                        setModoCrearSector(false);
                      }}
                      className="w-full text-left p-2 hover:bg-cyan-950/60 border-b border-slate-800/60 transition-colors flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-cyan-300">{sec.clave}</p>
                        <p className="text-[9px] text-slate-400">Col: {sec.nombreColonia || 'S/N'} {sec.medidor ? `| RPU: ${sec.medidor}` : ''}</p>
                      </div>
                      <span className="text-[8px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded">Ver</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* VISTA DINÁMICA COMPACTA */}
            <div className="bg-slate-900/60 border border-slate-800 p-2 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                <h3 className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1">
                  <Edit3 size={11} /> 
                  {modoCrearSector ? 'Registrar Sector' : modoCrearLuminaria ? 'Nuevo Poste' : luminariaSeleccionada ? `Checklist Poste #${luminariaSeleccionada.id}` : sectorSeleccionado ? `Sector: ${sectorSeleccionado.clave}` : 'Panel General'}
                </h3>
                {sectorSeleccionado && !luminariaSeleccionada && !modoCrearSector && (
                  <button onClick={() => setEditandoSector(!editandoSector)} className="text-[8px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 cursor-pointer">
                    {editandoSector ? <Unlock size={8} className="text-amber-400 inline" /> : <Lock size={8} className="inline" />} {editandoSector ? 'Editando' : 'Editar'}
                  </button>
                )}
                {luminariaSeleccionada && (
                  <button onClick={() => { setLuminariaSeleccionada(null); setEditandoPoste(false); }} className="text-[8px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase cursor-pointer">← Volver</button>
                )}
              </div>

              {modoCrearSector ? (
                <div className="space-y-1.5 text-xs">
                  <p className="text-[8px] text-slate-400">{nuevoSectorForm.latitud ? '✅ Coordenada capturada.' : '👉 Haz clic en el mapa para marcar ubicación.'}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="text" placeholder="Clave (Ej. SEC-080)" value={nuevoSectorForm.clave} onChange={e => setNuevoSectorForm({...nuevoSectorForm, clave: e.target.value})} className="bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                    <input type="text" placeholder="Número RPU / Medidor" value={nuevoSectorForm.medidor} onChange={e => setNuevoSectorForm({...nuevoSectorForm, medidor: e.target.value})} className="bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                  </div>
                  <input type="text" placeholder="Nombre de Colonia" value={nuevoSectorForm.nombreColonia} onChange={e => setNuevoSectorForm({...nuevoSectorForm, nombreColonia: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                  <button onClick={guardarNuevoSector} disabled={saving || !nuevoSectorForm.latitud} className="w-full bg-blue-600 text-white py-1 rounded font-bold uppercase cursor-pointer disabled:opacity-50">Guardar Sector</button>
                </div>
              ) : modoCrearLuminaria ? (
                <div className="space-y-1.5 text-xs">
                  <p className="text-[8px] text-slate-400">{nuevaLuminariaForm.latitud ? '✅ Ubicación lista.' : '👉 Haz clic en el mapa para ubicar el poste.'}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="text" placeholder="Tipo Lámpara (LED)" value={nuevaLuminariaForm.tipo_lampara} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, tipo_lampara: e.target.value})} className="bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                    <input type="text" placeholder="Capacidad (70W)" value={nuevaLuminariaForm.capacidad} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, capacidad: e.target.value})} className="bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase">Cant. Postes:</label>
                      <input type="number" value={nuevaLuminariaForm.cantidad_postes} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, cantidad_postes: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 uppercase">Lamps x Poste:</label>
                      <input type="number" value={nuevaLuminariaForm.luminarias_por_poste} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, luminarias_por_poste: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-1 rounded text-white" />
                    </div>
                  </div>
                  <button onClick={confirmarCrearLuminaria} disabled={saving || !nuevaLuminariaForm.latitud} className="w-full bg-emerald-600 text-white py-1 rounded font-bold uppercase cursor-pointer disabled:opacity-50">Guardar Poste</button>
                </div>
              ) : luminariaSeleccionada ? (
                /* TARJETA DE CHECKLIST DETALLADA AL SELECCIONAR UN POSTE */
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <div>
                      <p className="text-[8px] text-slate-400">Poste ID / Número:</p>
                      <p className="font-bold text-cyan-300 text-xs">Poste #{luminariaSeleccionada.id}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-400">Luminarias por Poste:</p>
                      <p className="font-bold text-emerald-400 text-xs">{luminariaSeleccionada.luminariasPorPoste || 1} Lámpara(s)</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-[8px] text-slate-400">Tipo y Capacidad:</p>
                      <p className="font-bold text-slate-200 text-xs">{luminariaSeleccionada.tipoLampara || 'LED'} - {luminariaSeleccionada.capacidad || '70'}W</p>
                    </div>
                    <button onClick={() => setEditandoPoste(!editandoPoste)} className="text-[8px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase cursor-pointer">
                      {editandoPoste ? 'Cerrar' : 'Editar'}
                    </button>
                  </div>

                  {editandoPoste && (
                    <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase">Tipo:</label>
                          <input type="text" value={luminariaSeleccionada.tipoLampara || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, tipoLampara: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" />
                        </div>
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase">Capacidad:</label>
                          <input type="text" value={luminariaSeleccionada.capacidad || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, capacidad: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" />
                        </div>
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase">Cant. Lamps:</label>
                          <input type="number" value={luminariaSeleccionada.luminariasPorPoste || 1} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, luminariasPorPoste: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" />
                        </div>
                      </div>
                      <button onClick={guardarCambiosLuminaria} className="w-full bg-cyan-600 text-white py-1 rounded font-bold uppercase cursor-pointer text-xs">Guardar Cambios</button>
                    </div>
                  )}

                  {/* 🌟 BOTÓN "TODO LISTO (OK)" EXTRA LLAMATIVO Y GRANDE */}
                  <div className="pt-0.5">
                    <button 
                      onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'ok', luminariaSeleccionada.observacion)}
                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        luminariaSeleccionada.estadoAuditoria === 'ok' 
                          ? 'bg-emerald-500 text-slate-950 ring-2 ring-white shadow-emerald-500/50 scale-[1.02]' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/60'
                      }`}
                    >
                      <Check size={16} className="stroke-[3]" /> TODO LISTO (POSTE OK)
                    </button>
                  </div>

                  {/* OTROS BOTONES SECUNDARIOS DE CHECKLIST */}
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button 
                      onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'falla', luminariaSeleccionada.observacion)}
                      className={`py-1 rounded font-bold text-[9px] uppercase cursor-pointer transition-all ${luminariaSeleccionada.estadoAuditoria === 'falla' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-400'}`}
                    >
                      <AlertTriangle size={10} className="inline mr-0.5" /> No enciende
                    </button>
                    <button 
                      onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'irregular', luminariaSeleccionada.observacion)}
                      className={`py-1 rounded font-bold text-[9px] uppercase cursor-pointer transition-all ${luminariaSeleccionada.estadoAuditoria === 'irregular' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-900 text-slate-400'}`}
                    >
                      <FileText size={10} className="inline mr-0.5" /> Irregularidad
                    </button>
                    <button 
                      onClick={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, 'no_existe', luminariaSeleccionada.observacion)}
                      className={`py-1 rounded font-bold text-[9px] uppercase cursor-pointer transition-all ${luminariaSeleccionada.estadoAuditoria === 'no_existe' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-900 text-slate-400'}`}
                    >
                      <XCircle size={10} className="inline mr-0.5" /> No existe
                    </button>
                  </div>

                  {/* CAMPO DE OBSERVACIÓN */}
                  <div className="space-y-0.5 pt-0.5">
                    <label className="text-[8px] font-bold text-amber-400 uppercase tracking-wider block">Observación de campo / Irregularidad:</label>
                    <textarea 
                      rows="2"
                      placeholder="Escribe aquí los detalles o anomalías encontradas..."
                      value={luminariaSeleccionada.observacion || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLuminariaSeleccionada({...luminariaSeleccionada, observacion: val});
                      }}
                      onBlur={() => actualizarAuditoriaPoste(luminariaSeleccionada.id, luminariaSeleccionada.estadoAuditoria || 'pendiente', luminariaSeleccionada.observacion)}
                      className="w-full bg-slate-950 border border-slate-700 p-1.5 rounded text-xs text-white outline-none focus:border-cyan-500"
                    ></textarea>
                  </div>

                  <div className="pt-0.5">
                    <button onClick={eliminarLuminariaSeleccionada} className="w-full bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 py-1 rounded text-[9px] font-bold uppercase cursor-pointer border border-rose-500/40">
                      <Trash2 size={10} className="inline mr-1" /> Eliminar este Poste
                    </button>
                  </div>
                </div>
              ) : sectorSeleccionado ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <div>
                      <p className="text-[8px] text-slate-400">RPU (Medidor):</p>
                      <p className="font-bold text-cyan-400 text-xs">{sectorSeleccionado.medidor || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-400">Progreso:</p>
                      <p className="font-bold text-emerald-400 text-xs">{totalesSectorActual.auditados} / {totalesSectorActual.postes} Postes</p>
                    </div>
                  </div>

                  {editandoSector ? (
                    <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="grid grid-cols-2 gap-1">
                        <input type="text" value={sectorSeleccionado.clave || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, clave: e.target.value})} className="bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" placeholder="Clave" />
                        <input type="text" value={sectorSeleccionado.cuenta || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, cuenta: e.target.value})} className="bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" placeholder="Cuenta" />
                      </div>
                      <input type="text" value={sectorSeleccionado.nombreColonia || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, nombreColonia: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-xs" placeholder="Colonia" />
                      <button onClick={guardarCambiosSector} disabled={saving} className="w-full bg-emerald-600 text-white py-1 rounded font-bold uppercase cursor-pointer text-xs">Guardar Sector</button>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Haz clic en un poste para auditar:</p>
                      {sectorSeleccionado.luminarias && sectorSeleccionado.luminarias.length > 0 ? (
                        sectorSeleccionado.luminarias.map((lum, idx) => {
                          const est = lum.estadoAuditoria || 'pendiente';
                          const lampsPorPoste = lum.luminariasPorPoste || 1;
                          return (
                            <div 
                              key={lum.id} 
                              onClick={() => { setLuminariaSeleccionada(lum); setEditandoPoste(false); }}
                              className={`p-1.5 rounded-xl border flex justify-between items-center cursor-pointer transition-all hover:border-cyan-500 ${
                                est === 'ok' ? 'bg-emerald-950/40 border-emerald-500/50' : 
                                est === 'falla' ? 'bg-amber-950/40 border-amber-500/50' : 
                                est === 'irregular' ? 'bg-purple-950/40 border-purple-500/50' :
                                est === 'no_existe' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-cyan-300 text-xs">Poste #{idx + 1} (ID: {lum.id})</span>
                                <p className="text-[9px] text-slate-400">{lampsPorPoste} Lámpara(s) | {lum.tipoLampara || 'LED'} - {lum.capacidad || '70'}W</p>
                              </div>
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${
                                est === 'ok' ? 'bg-emerald-900 text-emerald-200' :
                                est === 'falla' ? 'bg-amber-900 text-amber-200' :
                                est === 'irregular' ? 'bg-purple-900 text-purple-200' :
                                est === 'no_existe' ? 'bg-rose-900 text-rose-200' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {est === 'pendiente' ? 'Revisar' : est}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[9px] text-slate-500 text-center py-3">No hay postes registrados en este sector.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <Layers size={16} className="text-slate-600 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">Busca un sector para iniciar el Checklist.</p>
                </div>
              )}
            </div>

          </div>

          {/* BOTÓN INFERIOR DE ACCIÓN */}
          <div className="pt-1.5">
            {sectorSeleccionado && !modoCrearSector && (
              <button onClick={() => { setLuminariaSeleccionada(null); setModoCrearLuminaria(true); }} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg cursor-pointer">
                <Plus size={13} className="inline mr-1" /> Agregar Nuevo Poste en este Sector
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Censo;