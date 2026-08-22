import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, Plus, Trash2, Edit3, Save, RefreshCw, 
  Layers, Search, CheckCircle2, AlertCircle, Loader2, Building2, X, Lock, Unlock, Check, Navigation, Disc 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Pane, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Apuntando al entorno local de la Mac
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8085/graphql';

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
      className="absolute top-4 right-4 z-[450] bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 p-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold uppercase backdrop-blur-md transition-all cursor-pointer"
      title="Ir a mi ubicación actual con GPS"
      type="button"
    >
      <Navigation size={15} className={centrando ? "animate-spin text-emerald-400" : ""} />
      <span className="hidden md:inline"> GPS </span>
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

const crearIconoPoste3D = (luminariasPorPoste = 1) => {
  const numLamps = parseInt(luminariasPorPoste) >= 2 ? 2 : 1;

  const cabezalesHtml = numLamps >= 2 
    ? `
      <div style="display: flex; gap: 6px; align-items: flex-end;">
        <div style="width: 14px; height: 8px; background: linear-gradient(to bottom, #38bdf8, #0369a1); border-radius: 4px 4px 0 0; box-shadow: 0 0 10px #38bdf8;"></div>
        <div style="width: 14px; height: 8px; background: linear-gradient(to bottom, #38bdf8, #0369a1); border-radius: 4px 4px 0 0; box-shadow: 0 0 10px #38bdf8;"></div>
      </div>
    `
    : `
      <div style="width: 18px; height: 9px; background: linear-gradient(to bottom, #38bdf8, #0369a1); border-radius: 6px 6px 0 0; box-shadow: 0 0 12px #38bdf8;"></div>
    `;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 60px; height: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        transform: translateY(-10px);
        filter: drop-shadow(0 6px 6px rgba(0,0,0,0.7));
      ">
        <div style="
          position: absolute; bottom: 2px;
          width: 44px; height: 24px;
          background: radial-gradient(circle, rgba(56,189,248,0.5) 0%, rgba(56,189,248,0) 70%);
          border-radius: 50%;
        "></div>
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
  html: `
    <div style="
      width: 24px; height: 24px; 
      background: #10b981; 
      border: 2px solid white; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
    ">
      <span style="color: white; font-weight: bold; font-size: 12px;">⚡</span>
    </div>
  `,
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
  const [editandoLuminaria, setEditandoLuminaria] = useState(false);

  const [luminariaSeleccionada, setLuminariaSeleccionada] = useState(null);
  const [modoCrearLuminaria, setModoCrearLuminaria] = useState(false);
  const [nuevaLuminariaForm, setNuevaLuminariaForm] = useState({
    cantidad_postes: 1,
    latitud: '',
    longitud: '',
    tipo_lampara: 'LED',
    descripcion: '',
    luminarias_por_poste: 1,
    capacidad: '70'
  });
  
  const [modoCrearSector, setModoCrearSector] = useState(false);
  const [nuevoSectorForm, setNuevoSectorForm] = useState({
    clave: '',
    clasificacion: 'ALUMBRADO PUBLICO',
    nombreColonia: '',
    latitud: '',
    longitud: '',
    consumo_ideal: 0,
    consumo_aceptable: 0,
    consumo_maximo: 0,
    medidor: '',
    cuenta: '',
    carga: 0,
    cpd: 0,
    tarifa: '07'
  });

  const mesesOrden = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

  const cargarCensoSectores = () => {
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
        if (data.data?.todosLosSectores) {
          const sectoresConRevision = data.data.todosLosSectores.map(sec => ({
            ...sec,
            luminarias: sec.luminarias?.map(lum => ({ ...lum, revisada: lum.revisada || false })) || []
          }));
          setTodosLosSectores(sectoresConRevision);
          
          if (sectorSeleccionado) {
            const actualizado = sectoresConRevision.find(s => String(s.id) === String(sectorSeleccionado.id));
            if (actualizado) setSectorSeleccionado(actualizado);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando censo desde MySQL/GraphQL:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    cargarCensoSectores();
  }, []);

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
                if (dist < menorDistancia) {
                  menorDistancia = dist;
                  sectorCercano = sec;
                }
              }
            });

            if (sectorCercano && menorDistancia < 3000) {
              setSectorSeleccionado(sectorCercano);
              setMensaje({ tipo: 'exito', texto: `📡 Sector detectado automáticamente: ${sectorCercano.clave}` });
              setTimeout(() => setMensaje(null), 3000);
            }
          }

          if (sectorSeleccionado?.luminarias) {
            const posteCercano = sectorSeleccionado.luminarias.find(lum => {
              const dist = L.latLng(nuevaPos.lat, nuevaPos.lng).distanceTo([parseFloat(lum.latitud), parseFloat(lum.longitud)]);
              return dist < 40;
            });

            if (posteCercano) {
              setLuminariaSeleccionada(prev => {
                if (String(prev?.id) !== String(posteCercano.id)) {
                  setEditandoLuminaria(false);
                  return posteCercano;
                }
                return prev;
              });
            }
          }
        },
        (err) => console.error("Error en seguimiento GPS automático:", err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [modoSeguimiento, sectorSeleccionado, todosLosSectores]);

  const obtenerTotalesSector = (sec) => {
    const postes = sec?.luminarias?.length || 0;
    const totalLuminarias = sec?.luminarias?.reduce((acc, lum) => {
      const porPoste = parseInt(lum.luminariasPorPoste) || 1;
      const cantPostesLum = parseInt(lum.cantidadPostes) || 1;
      return acc + (porPoste * cantPostesLum);
    }, 0) || 0;
    const revisadas = sec?.luminarias?.filter(lum => lum.revisada)?.length || 0;
    return { postes, totalLuminarias, revisadas };
  };

  const sugerenciasFiltradas = useMemo(() => {
    if (busqueda.length < 2 || !mostrarSugerencias) return [];
    const q = busqueda.toUpperCase();
    return todosLosSectores.filter(s => s.clave?.toUpperCase().includes(q) || s.nombreColonia?.toUpperCase().includes(q)).slice(0, 8);
  }, [todosLosSectores, busqueda, mostrarSugerencias]);

  const handleMapaClick = (latlng) => {
    if (modoCrearLuminaria) {
      setNuevaLuminariaForm(prev => ({ ...prev, latitud: latlng.lat, longitud: latlng.lng }));
      setMensaje({ tipo: 'exito', texto: '📍 Coordenada capturada manualmente para la luminaria.' });
      setTimeout(() => setMensaje(null), 3000);
    } else if (modoCrearSector) {
      setNuevoSectorForm(prev => ({ ...prev, latitud: latlng.lat, longitud: latlng.lng }));
      setMensaje({ tipo: 'exito', texto: '📍 Coordenada capturada manualmente para el sector.' });
      setTimeout(() => setMensaje(null), 3000);
    }
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
        }) {
          id
        }
      }
    `;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error al actualizar luminaria en MySQL:", resData.errors);
          setMensaje({ tipo: 'error', texto: 'El servidor rechazó actualizar la luminaria.' });
        } else {
          setEditandoLuminaria(false);
          setMensaje({ tipo: 'exito', texto: '⚡ Luminaria actualizada y consumos recalculados con éxito.' });
          cargarCensoSectores(); 
        }
        setTimeout(() => setMensaje(null), 4000);
      })
      .catch(err => {
        setSaving(false);
        console.error("Error de conexión:", err);
        setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const marcarOkManual = () => {
    if (!sectorSeleccionado || !luminariaSeleccionada) return;
    const listaLuminarias = sectorSeleccionado.luminarias || [];
    const luminariasModificadas = listaLuminarias.map(lum => 
      lum.id === luminariaSeleccionada.id ? { ...lum, revisada: true } : lum
    );
    setSectorSeleccionado({ ...sectorSeleccionado, luminarias: luminariasModificadas });
    setLuminariaSeleccionada({ ...luminariaSeleccionada, revisada: true });
    setMensaje({ tipo: 'exito', texto: `✓ Poste #${luminariaSeleccionada.id} marcado como revisado.` });
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarLuminariaSeleccionada = () => {
    if (!sectorSeleccionado || !luminariaSeleccionada) return;
    if (!window.confirm(`¿Estás seguro de eliminar el poste #${luminariaSeleccionada.id}?`)) return;
    setSaving(true);

    const mutation = `
      mutation {
        eliminarLuminaria(id: "${luminariaSeleccionada.id}")
      }
    `;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error al eliminar luminaria:", resData.errors);
          setMensaje({ tipo: 'error', texto: 'El servidor rechazó eliminar la luminaria.' });
        } else {
          setLuminariaSeleccionada(null);
          setEditandoLuminaria(false);
          setMensaje({ tipo: 'exito', texto: '🗑️ Luminaria eliminada y consumos recalculados.' });
          cargarCensoSectores();
        }
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(err => {
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
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
        }) {
          id
        }
      }
    `;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error MySQL/GraphQL en luminaria:", resData.errors);
          setMensaje({ tipo: 'error', texto: 'El servidor rechazó guardar la luminaria.' });
        } else {
          setModoCrearLuminaria(false);
          setNuevaLuminariaForm({ cantidad_postes: 1, latitud: '', longitud: '', tipo_lampara: 'LED', descripcion: '', luminarias_por_poste: 1, capacidad: '70' });
          setMensaje({ tipo: 'exito', texto: `⚡ Luminaria guardada y consumos recalculados.` });
          cargarCensoSectores(); 
        }
        setTimeout(() => setMensaje(null), 4000);
      })
      .catch(err => {
        console.error("Error de conexión:", err);
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'No se pudo conectar con el servidor backend.' });
        setTimeout(() => setMensaje(null), 4000);
      });
  };

  const guardarModificacionSectorPanel = () => {
    if (!sectorSeleccionado) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setEditandoSector(false);
      setMensaje({ tipo: 'exito', texto: `Sector ${sectorSeleccionado.clave} actualizado correctamente.` });
      setTimeout(() => setMensaje(null), 3000);
    }, 400);
  };

  const guardarNuevoSector = () => {
    setSaving(true);

    const mutation = `
      mutation {
        crearSector(input: {
          clave: "${nuevoSectorForm.clave}",
          clasificacion: "${nuevoSectorForm.clasificacion}",
          nombreColonia: "${nuevoSectorForm.nombreColonia}",
          latitud: ${parseFloat(nuevoSectorForm.latitud)},
          longitud: ${parseFloat(nuevoSectorForm.longitud)},
          consumoIdeal: ${parseFloat(nuevoSectorForm.consumo_ideal)},
          consumoAceptable: ${parseFloat(nuevoSectorForm.consumo_aceptable)},
          consumoMaximo: ${parseFloat(nuevoSectorForm.consumo_maximo)},
          medidor: "${nuevoSectorForm.medidor}",
          cuenta: "${nuevoSectorForm.cuenta}",
          carga: ${parseFloat(nuevoSectorForm.carga)},
          cpd: ${parseFloat(nuevoSectorForm.cpd)},
          tarifa: "${nuevoSectorForm.tarifa}"
        }) {
          id
          clave
        }
      }
    `;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error MySQL/GraphQL en sector:", resData.errors);
          setMensaje({ tipo: 'error', texto: 'El servidor rechazó guardar el sector.' });
        } else {
          setModoCrearSector(false);
          setNuevoSectorForm({ clave: '', clasificacion: 'ALUMBRADO PUBLICO', nombreColonia: '', latitud: '', longitud: '', consumo_ideal: 0, consumo_aceptable: 0, consumo_maximo: 0, medidor: '', cuenta: '', carga: 0, cpd: 0, tarifa: '07' });
          setMensaje({ tipo: 'exito', texto: `🏢 Sector registrado en MySQL correctamente.` });
          cargarCensoSectores(); 
        }
        setTimeout(() => setMensaje(null), 5000);
      })
      .catch(err => {
        console.error("Error de conexión:", err);
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'No se pudo conectar con el servidor backend.' });
        setTimeout(() => setMensaje(null), 4000);
      });
  };

  const eliminarSector = () => {
    if (!sectorSeleccionado) return;
    if (!window.confirm(`¿Estás seguro de dar de baja el sector ${sectorSeleccionado.clave}?`)) return;
    setSaving(true);

    const mutation = `
      mutation {
        eliminarSector(id: "${sectorSeleccionado.id}")
      }
    `;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
      .then(res => res.json())
      .then(resData => {
        setSaving(false);
        if (resData.errors) {
          console.error("Error al eliminar sector:", resData.errors);
          setMensaje({ tipo: 'error', texto: 'El servidor rechazó dar de baja el sector.' });
        } else {
          setMensaje({ tipo: 'exito', texto: 'Sector eliminado de MySQL correctamente.' });
          setSectorSeleccionado(null);
          cargarCensoSectores();
        }
        setTimeout(() => setMensaje(null), 3000);
      })
      .catch(err => {
        setSaving(false);
        setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
        setTimeout(() => setMensaje(null), 3000);
      });
  };

  const totalesSectorActual = obtenerTotalesSector(sectorSeleccionado);

  return (
    <div className="h-screen w-screen bg-[#070b14] p-3 md:p-4 font-sans text-slate-100 flex flex-col overflow-hidden">
      <div className="max-w-[1700px] w-full mx-auto flex flex-col h-full gap-2.5">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-[#111827] border border-slate-800/80 px-4 py-2 rounded-xl shadow-xl flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-600 to-blue-800 p-2 rounded-lg shadow-md border border-cyan-500/30">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wider uppercase text-white">Módulo de Censo </h1>
                <span className="bg-cyan-500/10 text-cyan-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-widest">
                  Geolocalización 
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium"></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setModoSeguimiento(!modoSeguimiento)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border shadow-md ${
                modoSeguimiento 
                  ? 'bg-emerald-600 animate-pulse text-white border-emerald-400' 
                  : 'bg-slate-800 text-cyan-400 border-slate-700/60 hover:bg-slate-700'
              }`}
              title="Cambia automáticamente de poste conforme avanzas en auto o caminando"
            >
              <Disc size={14} className={modoSeguimiento ? "animate-spin" : ""} /> 
              <span>{modoSeguimiento ? ' Activado' : 'Seguimiento '}</span>
            </button>

            <button 
              onClick={() => { 
                setModoCrearSector(true); 
                setLuminariaSeleccionada(null);
                setSectorSeleccionado(null);
                setModoCrearLuminaria(false);
                setUbicacionUsuario(null);
                setNuevoSectorForm({ clave: '', clasificacion: 'ALUMBRADO PUBLICO', nombreColonia: '', latitud: '', longitud: '', consumo_ideal: 0, consumo_aceptable: 0, consumo_maximo: 0, medidor: '', cuenta: '', carga: 0, cpd: 0, tarifa: '07' });
              }}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 text-white border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Plus size={14} /> <span>Nuevo Sector</span>
            </button>
            <button 
              onClick={cargarCensoSectores} 
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-cyan-400" : ""} /> 
              <span>Sincronizar </span>
            </button>
          </div>
        </div>

        {mensaje && (
          <div className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 border shadow-md shrink-0 ${
            mensaje.tipo === 'exito' ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}>
            {mensaje.tipo === 'exito' ? <CheckCircle2 size={15} className="text-emerald-400" /> : <AlertCircle size={15} className="text-rose-400" />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          
          {/* LISTA DE SECTORES */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl shadow-lg flex flex-col h-full min-h-0 relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-cyan-400" /> Sectores ({todosLosSectores.length})
              </span>
              {sectorSeleccionado && (
                <button 
                  onClick={() => { setSectorSeleccionado(null); setLuminariaSeleccionada(null); }}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase cursor-pointer border border-slate-700"
                >
                  Ver Todos
                </button>
              )}
            </div>
            
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar clave o colonia..." 
                value={busqueda} 
                onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500/50 text-slate-200 pl-9 pr-3 py-1.5 rounded-lg text-xs font-medium outline-none" 
              />
              {sugerenciasFiltradas.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                  {sugerenciasFiltradas.map((sec, i) => {
                    const { postes, totalLuminarias, revisadas } = obtenerTotalesSector(sec);
                    return (
                      <div 
                        key={i} 
                        onClick={() => { 
                          setBusqueda(sec.clave); 
                          setMostrarSugerencias(false); 
                          setSectorSeleccionado(sec);
                          setLuminariaSeleccionada(null);
                          setModoCrearLuminaria(false);
                          setEditandoSector(false);
                          setModoCrearSector(false);
                          setUbicacionUsuario(null);
                        }} 
                        className="p-2.5 cursor-pointer hover:bg-slate-800 text-xs font-bold border-b border-slate-800 flex justify-between items-center text-slate-200 gap-2"
                      >
                        <span className="truncate">⚡ [ID:{sec.id}] {sec.clave} - {sec.nombreColonia || 'Sin colonia'}</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-mono shrink-0">
                          {postes}P / {totalLuminarias}L (✓ {revisadas})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-1">
              {todosLosSectores
                .filter(s => s.clave?.toLowerCase().includes(busqueda.toLowerCase()) || s.nombreColonia?.toLowerCase().includes(busqueda.toLowerCase()))
                .map(sec => {
                  const esSeleccionado = String(sectorSeleccionado?.id) === String(sec.id);
                  const { postes, totalLuminarias, revisadas } = obtenerTotalesSector(sec);
                  return (
                    <button 
                      key={sec.id} 
                      onClick={() => { 
                        setSectorSeleccionado(sec); 
                        setModoCrearLuminaria(false); 
                        setLuminariaSeleccionada(null); 
                        setModoCrearSector(false); 
                        setEditandoSector(false);
                        setUbicacionUsuario(null);
                      }} 
                      className={`w-full p-2.5 rounded-lg text-left border transition-all flex justify-between items-center cursor-pointer ${
                        esSeleccionado 
                          ? 'bg-gradient-to-r from-cyan-950/50 to-slate-900 border-cyan-500/60 shadow-md' 
                          : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <p className={`text-xs font-black uppercase flex items-center gap-1.5 ${esSeleccionado ? 'text-cyan-400' : 'text-slate-200'}`}>
                          [ID: {sec.id}] {sec.clave}
                          {revisadas > 0 && <span className="text-[10px] text-emerald-400">✓</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{sec.nombreColonia || 'Sin colonia'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                          {postes}P / {totalLuminarias}L
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* MAPA */}
          <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 p-2 rounded-xl shadow-lg flex flex-col h-full min-h-0 relative">
            <div className="absolute top-4 left-4 z-[400] bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded-lg backdrop-blur-md shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modoSeguimiento ? 'bg-emerald-400 animate-ping' : modoCrearLuminaria || modoCrearSector ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
                <span className="text-xs font-bold text-white uppercase">
                  {modoSeguimiento ? '⚡ Radar Activo: Autodetectando sector y postes...' : modoCrearSector ? 'Haz clic o usa GPS para señalar el nuevo sector' : modoCrearLuminaria ? 'Haz clic o usa GPS para ubicar la luminaria' : sectorSeleccionado ? `Sector Activo: ID ${sectorSeleccionado.id} - ${sectorSeleccionado.clave}` : 'Vista General: Todos los Sectores'}
                </span>
              </div>
              {modoCrearSector && (
                <button onClick={() => setModoCrearSector(false)} className="text-xs bg-rose-600 px-2 py-1 rounded text-white font-bold cursor-pointer">Cancelar</button>
              )}
            </div>

            <div className="flex-1 w-full h-full rounded-lg overflow-hidden border border-slate-800 relative">
              <MapContainer center={[20.628, -87.076]} zoom={13} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ActualizarMapa 
                  sector={sectorSeleccionado} 
                  luminaria={luminariaSeleccionada} 
                  modoCrearSector={modoCrearSector} 
                  modoCrearLuminaria={modoCrearLuminaria}
                  ubicacionUsuario={ubicacionUsuario}
                  modoSeguimiento={modoSeguimiento}
                  posicionGPS={posicionGPS}
                />
                
                <BotonMiUbicacion 
                  ocultar={Boolean(sectorSeleccionado && !modoCrearLuminaria)} 
                  onUbicacionObtenida={(coords) => {
                    setUbicacionUsuario(coords);
                    if (modoCrearSector) {
                      setNuevoSectorForm(prev => ({ ...prev, latitud: coords.lat, longitud: coords.lng }));
                      setMensaje({ tipo: 'exito', texto: '📍 GPS capturado para el nuevo sector.' });
                      setTimeout(() => setMensaje(null), 3000);
                    } else if (modoCrearLuminaria) {
                      setNuevaLuminariaForm(prev => ({ ...prev, latitud: coords.lat, longitud: coords.lng }));
                      setMensaje({ tipo: 'exito', texto: '📍 GPS capturado con alta exactitud para la nueva luminaria.' });
                      setTimeout(() => setMensaje(null), 3000);
                    }
                  }} 
                />
                
                <CapturarClicMapa activoLuminaria={modoCrearLuminaria} activoSector={modoCrearSector} onAgregarCoordenada={handleMapaClick} />

                {!modoCrearSector && !sectorSeleccionado && todosLosSectores.map((sec) => (
                  <Marker 
                    key={`sec-gen-${sec.id}`}
                    position={[parseFloat(sec.latitud) || 20.628, parseFloat(sec.longitud) || -87.076]} 
                    icon={crearIconoSector(false, sec, mesesOrden)}
                    eventHandlers={{ 
                      click: () => { 
                        setSectorSeleccionado(sec); 
                        setLuminariaSeleccionada(null); 
                      } 
                    }}
                  />
                ))}

                {!modoCrearSector && sectorSeleccionado && (
                  <Pane name="sector-activo" style={{ zIndex: 400 }}>
                    <Marker 
                      position={[parseFloat(sectorSeleccionado.latitud) || 20.628, parseFloat(sectorSeleccionado.longitud) || -87.076]} 
                      icon={crearIconoSector(true, sectorSeleccionado, mesesOrden)}
                      eventHandlers={{ 
                        click: () => { 
                          setLuminariaSeleccionada(null); 
                          setModoCrearLuminaria(false); 
                          setEditandoSector(false);
                        } 
                      }}
                    />
                  </Pane>
                )}

                {/* RENDERIZADO DE LUMINARIAS CON CLAVES ÚNICAS */}
                {!modoCrearSector && sectorSeleccionado?.luminarias?.map((lum) => {
                  const esSeleccionada = String(luminariaSeleccionada?.id) === String(lum.id);
                  const colorPin = lum.revisada ? '#10b981' : '#dc2626';
                  const lat = parseFloat(lum.latitud) || 20.628;
                  const lng = parseFloat(lum.longitud) || -87.076;
                  const porPoste = parseInt(lum.luminariasPorPoste) || 1;

                  if (esSeleccionada) {
                    return (
                      <React.Fragment key={`lum-active-${lum.id}`}>
                        <Circle 
                          center={[lat, lng]} 
                          radius={50} 
                          className="animate-pulse"
                          pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.2, weight: 3 }} 
                        />
                        <Marker 
                          position={[lat, lng]} 
                          icon={crearIconoPoste3D(porPoste)}
                          eventHandlers={{ click: () => setLuminariaSeleccionada(lum) }}
                        />
                      </React.Fragment>
                    );
                  }

                  return (
                    <CircleMarker 
                      key={`lum-circle-${lum.id}`} 
                      center={[lat, lng]} 
                      radius={8} 
                      pathOptions={{ 
                        color: '#ffffff', 
                        fillColor: colorPin, 
                        fillOpacity: 1, 
                        weight: 2, 
                        pane: 'markerPane' 
                      }}
                      eventHandlers={{ click: () => { setLuminariaSeleccionada(lum); setEditandoLuminaria(false); } }}
                    />
                  );
                })}

                {modoCrearSector && nuevoSectorForm.latitud && nuevoSectorForm.longitud && (
                  <Marker 
                    position={[nuevoSectorForm.latitud, nuevoSectorForm.longitud]} 
                    icon={iconoTrianguloAzulNuevo}
                  />
                )}

                {modoCrearLuminaria && nuevaLuminariaForm.latitud && nuevaLuminariaForm.longitud && (
                  <Marker 
                    position={[nuevaLuminariaForm.latitud, nuevaLuminariaForm.longitud]} 
                    icon={iconoTempLuminaria}
                  />
                )}
              </MapContainer>
            </div>
          </div>

          {/* PANEL INTELIGENTE DERECHO */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl shadow-lg flex flex-col h-full min-h-0 justify-between">
            <div className="space-y-3 overflow-y-auto pr-1">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <Edit3 size={14} /> 
                  {modoCrearSector ? 'Nuevo Sector' : modoCrearLuminaria ? 'Nueva Luminaria' : luminariaSeleccionada ? `Poste #${luminariaSeleccionada.id} ${luminariaSeleccionada.revisada ? '✓' : ''}` : sectorSeleccionado ? `Sector ID: ${sectorSeleccionado.id}` : 'Panel de Control'}
                </h3>

                <div className="flex items-center gap-1.5">
                  {sectorSeleccionado && !modoCrearSector && !modoCrearLuminaria && !luminariaSeleccionada && (
                    <button 
                      onClick={() => setEditandoSector(!editandoSector)}
                      className={`text-[10px] font-bold uppercase flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        editandoSector ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {editandoSector ? <Unlock size={11} className="text-amber-400" /> : <Lock size={11} />}
                      {editandoSector ? 'Editando' : 'Editar'}
                    </button>
                  )}

                  {luminariaSeleccionada && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={marcarOkManual}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex items-center gap-1 shadow-md transition-all border border-emerald-400 cursor-pointer"
                        title="Marcar como revisado manualmente"
                      >
                        <Check size={12} className="stroke-[3]" /> OK
                      </button>

                      <button 
                        onClick={() => setEditandoLuminaria(!editandoLuminaria)}
                        className={`text-[10px] font-bold uppercase flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          editandoLuminaria ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {editandoLuminaria ? <Unlock size={11} className="text-amber-400" /> : <Lock size={11} />}
                        {editandoLuminaria ? 'Editando' : 'Editar'}
                      </button>

                      <button 
                        onClick={eliminarLuminariaSeleccionada}
                        className="bg-rose-600 hover:bg-rose-500 text-white p-1 rounded border border-rose-500 transition-all shadow-md cursor-pointer"
                        title="Eliminar este poste"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}

                  {sectorSeleccionado && !modoCrearSector && !modoCrearLuminaria && !luminariaSeleccionada && (
                    <button 
                      onClick={eliminarSector}
                      className="text-rose-400 hover:text-rose-300 text-[10px] font-bold uppercase flex items-center gap-1 bg-rose-950/40 border border-rose-900/50 px-2 py-0.5 rounded cursor-pointer"
                    >
                      <Trash2 size={11} /> Baja
                    </button>
                  )}
                </div>
              </div>

              {modoCrearSector ? (
                <div className="space-y-2 bg-slate-950/80 p-2.5 rounded-xl border border-blue-500/40 text-xs">
                  <div className="flex justify-between items-center text-blue-400 font-black uppercase">
                    <span className="flex items-center gap-1"><Building2 size={14} /> Registrar Sector</span>
                    <button onClick={() => setModoCrearSector(false)} className="cursor-pointer"><X size={14} /></button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {nuevoSectorForm.latitud ? '✅ Coordenada capturada.' : '👉 Haz clic en el mapa O presiona "Usar Mi GPS Actual".'}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Clave:</label>
                      <input type="text" value={nuevoSectorForm.clave} onChange={e => setNuevoSectorForm({...nuevoSectorForm, clave: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" placeholder="Ej. SEC-080" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Colonia:</label>
                      <input type="text" value={nuevoSectorForm.nombreColonia} onChange={e => setNuevoSectorForm({...nuevoSectorForm, nombreColonia: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Clasificación:</label>
                      <input type="text" value={nuevoSectorForm.clasificacion} onChange={e => setNuevoSectorForm({...nuevoSectorForm, clasificacion: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Tarifa:</label>
                      <input type="text" value={nuevoSectorForm.tarifa} onChange={e => setNuevoSectorForm({...nuevoSectorForm, tarifa: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Medidor:</label>
                      <input type="text" value={nuevoSectorForm.medidor} onChange={e => setNuevoSectorForm({...nuevoSectorForm, medidor: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Cuenta CFE:</label>
                      <input type="text" value={nuevoSectorForm.cuenta} onChange={e => setNuevoSectorForm({...nuevoSectorForm, cuenta: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">C. Ideal:</label>
                      <input type="number" step="0.01" value={nuevoSectorForm.consumo_ideal} onChange={e => setNuevoSectorForm({...nuevoSectorForm, consumo_ideal: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">C. Aceptable:</label>
                      <input type="number" step="0.01" value={nuevoSectorForm.consumo_aceptable} onChange={e => setNuevoSectorForm({...nuevoSectorForm, consumo_aceptable: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">C. Máximo:</label>
                      <input type="number" step="0.01" value={nuevoSectorForm.consumo_maximo} onChange={e => setNuevoSectorForm({...nuevoSectorForm, consumo_maximo: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Carga:</label>
                      <input type="number" step="0.001" value={nuevoSectorForm.carga} onChange={e => setNuevoSectorForm({...nuevoSectorForm, carga: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setModoCrearSector(false)} className="w-1/2 bg-slate-800 text-slate-300 py-1.5 rounded font-bold uppercase cursor-pointer">Cancelar</button>
                    <button onClick={guardarNuevoSector} disabled={saving || !nuevoSectorForm.latitud} className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded font-bold uppercase disabled:opacity-50 cursor-pointer shadow-md transition-all flex items-center justify-center">
                      {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null} Guardar
                    </button>
                  </div>
                </div>
              ) : modoCrearLuminaria ? (
                <div className="space-y-2 bg-slate-950/80 p-2.5 rounded-xl border border-emerald-500/40 text-xs">
                  <div className="flex justify-between items-center text-emerald-400 font-black uppercase">
                    <span>Registrar Poste</span>
                    <button onClick={() => setModoCrearLuminaria(false)} className="cursor-pointer"><X size={14} /></button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {nuevaLuminariaForm.latitud ? '✅ Coordenada capturada con éxito.' : '👉 Haz clic en el mapa O presiona "Usar Mi GPS Actual".'}
                  </p>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad Postes:</label>
                    <input type="number" value={nuevaLuminariaForm.cantidad_postes} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, cantidad_postes: parseInt(e.target.value) || 1})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo Lámpara:</label>
                    <input type="text" value={nuevaLuminariaForm.tipo_lampara} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, tipo_lampara: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Capacidad (ej. 70W):</label>
                    <input type="text" value={nuevaLuminariaForm.capacidad} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, capacidad: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Luminarias por Poste:</label>
                    <input type="number" value={nuevaLuminariaForm.luminarias_por_poste} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, luminarias_por_poste: parseInt(e.target.value) || 1})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción:</label>
                    <input type="text" value={nuevaLuminariaForm.descripcion} onChange={e => setNuevaLuminariaForm({...nuevaLuminariaForm, descripcion: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-1.5 rounded text-white font-bold" placeholder="Opcional" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setModoCrearLuminaria(false)} className="w-1/2 bg-slate-800 text-slate-300 py-1.5 rounded font-bold uppercase cursor-pointer">Cancelar</button>
                    <button onClick={confirmarCrearLuminaria} disabled={saving || !nuevaLuminariaForm.latitud} className="w-1/2 bg-emerald-600 text-white py-1.5 rounded font-bold uppercase disabled:opacity-50 cursor-pointer flex items-center justify-center">
                      {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null} Guardar
                    </button>
                  </div>
                </div>
              ) : luminariaSeleccionada ? (
                <div className={`space-y-2 bg-slate-950/80 p-2.5 rounded-xl border text-xs transition-all ${editandoLuminaria ? 'border-amber-500/50' : 'border-cyan-500/40'}`}>
                  
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-slate-300">Estado de Revisión:</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      luminariaSeleccionada.revisada ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {luminariaSeleccionada.revisada ? '✓ REVISADA' : '❌ PENDIENTE'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-cyan-400 font-black uppercase pt-1">
                    <span className="flex items-center gap-1">
                      {editandoLuminaria ? <Unlock size={12} className="text-amber-400" /> : <Lock size={12} />}
                      Atributos Poste
                    </span>
                    <button onClick={() => { setLuminariaSeleccionada(null); setEditandoLuminaria(false); }} className="cursor-pointer"><X size={14} /></button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad Postes:</label>
                    <input type="number" readOnly={!editandoLuminaria} value={luminariaSeleccionada.cantidadPostes || 1} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, cantidadPostes: parseInt(e.target.value) || 1})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoLuminaria ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo Lámpara:</label>
                    <input type="text" readOnly={!editandoLuminaria} value={luminariaSeleccionada.tipoLampara || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, tipoLampara: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoLuminaria ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Capacidad (Watts):</label>
                    <input type="text" readOnly={!editandoLuminaria} value={luminariaSeleccionada.capacidad || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, capacidad: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoLuminaria ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Luminarias por Poste:</label>
                    <input type="number" readOnly={!editandoLuminaria} value={luminariaSeleccionada.luminariasPorPoste || 1} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, luminariasPorPoste: parseInt(e.target.value) || 1})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoLuminaria ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción:</label>
                    <input type="text" readOnly={!editandoLuminaria} value={luminariaSeleccionada.descripcion || ''} onChange={e => setLuminariaSeleccionada({...luminariaSeleccionada, descripcion: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoLuminaria ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                  </div>

                  {editandoLuminaria && (
                    <button onClick={guardarCambiosLuminaria} disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded font-bold uppercase mt-2 shadow-md cursor-pointer">
                      {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : <Save size={13} className="inline mr-1" />} Guardar 
                    </button>
                  )}
                </div>
              ) : sectorSeleccionado ? (
                <div className={`space-y-2 bg-slate-950/80 p-2.5 rounded-xl border text-xs transition-all ${editandoSector ? 'border-amber-500/50' : 'border-blue-500/40'}`}>
                  {!editandoSector && (
                    <p className="text-[10px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 flex justify-between items-center font-bold">
                      <span>Progreso: <strong className="text-emerald-400">{totalesSectorActual.revisadas}</strong> de <strong className="text-cyan-400">{totalesSectorActual.postes}</strong> postes revisados</span>
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">ID Sector:</label>
                      <input type="text" readOnly value={sectorSeleccionado.id || ''} className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-cyan-400 font-bold opacity-80" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Clave:</label>
                      <input type="text" readOnly={!editandoSector} value={sectorSeleccionado.clave || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, clave: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Clasificación:</label>
                      <input type="text" readOnly={!editandoSector} value={sectorSeleccionado.clasificacion || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, clasificacion: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Medidor:</label>
                      <input type="text" readOnly={!editandoSector} value={sectorSeleccionado.medidor || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, medidor: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Cuenta CFE:</label>
                      <input type="text" readOnly={!editandoSector} value={sectorSeleccionado.cuenta || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, cuenta: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Consumo Ideal:</label>
                      <input type="number" step="0.01" readOnly={!editandoSector} value={sectorSeleccionado.consumoIdeal || 0} onChange={e => setSectorSeleccionado({...sectorSeleccionado, consumoIdeal: parseFloat(e.target.value) || 0})} className={`w-full bg-slate-900 border p-1.5 rounded text-cyan-300 font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-90'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Consumo Aceptable:</label>
                      <input type="number" step="0.01" readOnly={!editandoSector} value={sectorSeleccionado.consumoAceptable || 0} onChange={e => setSectorSeleccionado({...sectorSeleccionado, consumoAceptable: parseFloat(e.target.value) || 0})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Consumo Máximo:</label>
                      <input type="number" step="0.01" readOnly={!editandoSector} value={sectorSeleccionado.consumoMaximo || 0} onChange={e => setSectorSeleccionado({...sectorSeleccionado, consumoMaximo: parseFloat(e.target.value) || 0})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Tarifa:</label>
                      <input type="text" readOnly={!editandoSector} value={sectorSeleccionado.tarifa || ''} onChange={e => setSectorSeleccionado({...sectorSeleccionado, tarifa: e.target.value})} className={`w-full bg-slate-900 border p-1.5 rounded text-white font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-80'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">Carga (kW):</label>
                      <input type="number" step="0.001" readOnly={!editandoSector} value={sectorSeleccionado.carga || 0} onChange={e => setSectorSeleccionado({...sectorSeleccionado, carga: parseFloat(e.target.value) || 0})} className={`w-full bg-slate-900 border p-1.5 rounded text-cyan-300 font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-90'}`} />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400 uppercase text-[9px]">CPD:</label>
                      <input type="number" step="0.001" readOnly={!editandoSector} value={sectorSeleccionado.cpd || 0} onChange={e => setSectorSeleccionado({...sectorSeleccionado, cpd: parseFloat(e.target.value) || 0})} className={`w-full bg-slate-900 border p-1.5 rounded text-cyan-300 font-bold ${editandoSector ? 'border-amber-500/60' : 'border-slate-800 opacity-90'}`} />
                    </div>
                  </div>

                  {editandoSector && (
                    <button onClick={guardarModificacionSectorPanel} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-bold uppercase mt-2 shadow-md cursor-pointer">
                      {saving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : <Save size={13} className="inline mr-1" />} Guardar Sector
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <MapPin size={24} className="text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">Selecciona un sector o luminaria para ver y editar sus atributos.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button 
                onClick={() => { setLuminariaSeleccionada(null); setModoCrearLuminaria(true); }}
                disabled={!sectorSeleccionado || modoCrearSector}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Plus size={14} /> Agregar Nueva Luminaria
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Censo;