import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, CircleMarker, Pane, Tooltip as MapTooltip } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

const IconoInfo = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);

const formatearNumero = (num) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(num) || 0);
};

const CustomTooltipGrafica = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15, 23, 42, 0.95)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.5)', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
        <p style={{ margin: 0, color: '#38bdf8', fontWeight: '900', fontSize: '11px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          {label}: {formatearNumero(payload[0].value)} kWh
        </p>
      </div>
    );
  }
  return null;
};

const ActualizarMapa = ({ sector, colonia, todos }) => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    if (sector && sector.latitud) {
      map.setView([parseFloat(sector.latitud), parseFloat(sector.longitud)], 18, { animate: true });
    } else if (colonia) {
      const primerSector = todos.find(s => s.nombreColonia?.toUpperCase() === colonia.toUpperCase());
      if (primerSector) {
        map.setView([parseFloat(primerSector.latitud), parseFloat(primerSector.longitud)], 15, { animate: true });
      }
    } else if (todos && todos.length > 0 && !sector && !colonia) {
      const bounds = todos
        .filter(s => s.latitud && s.longitud)
        .map(s => [parseFloat(s.latitud), parseFloat(s.longitud)]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
      }
    }
  }, [sector, colonia, map, todos]);
  return null;
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

  let color = '#3b82f6'; 
  if (esAlerta) color = '#ef4444'; 
  else if (sector.clasificacion?.toUpperCase().includes("INMUEBLE")) color = '#f97316'; 

  const triClipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';

  return L.divIcon({ 
    html: `
      <div style="
        width: 22px; height: 22px; 
        position: relative; 
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
        transform: ${isActive ? 'scale(1.4) translateY(-4px)' : 'scale(1)'};
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      ">
        <div style="position: absolute; width: 100%; height: 100%; background: #0f172a; clip-path: ${triClipPath};"></div>
        <div style="
          position: absolute; 
          top: 1.5px; left: 1.5px; 
          width: calc(100% - 3px); height: calc(100% - 3px);
          background: ${color}; 
          clip-path: ${triClipPath};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${esAlerta ? `<span style="color: white; font-weight: 900; font-size: 12px; margin-top: 2px;">!</span>` : ''}
        </div>
      </div>
    `, 
    iconSize: [22, 22], iconAnchor: [11, 22]
  });
};

const crearIconoPoste3D = (luminariasPorPoste = 1) => {
  const numLamps = parseInt(luminariasPorPoste) >= 2 ? 2 : 1;
  const colorLuz = '#38bdf8'; 

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

const MapaBase = () => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [notificacion, setNotificacion] = useState(null);

  const mostrarToast = (mensaje, tipo = 'info') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 3500);
  };
  const [sectorActivo, setSectorActivo] = useState(null); 
  const [idsSectoresVisibles, setIdsSectoresVisibles] = useState([]); 
  const [busqueda, setBusqueda] = useState("");
  const [coloniaFiltrada, setColoniaFiltrada] = useState(null);
  const [modoBusquedaIndividual, setModoBusquedaIndividual] = useState(false);
  const [verAlumbrado, setVerAlumbrado] = useState(true);
  const [verInmuebles, setVerInmuebles] = useState(true);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [verModo3D, setVerModo3D] = useState(false); 
  const [anioSeleccionado, setAnioSeleccionado] = useState(2026);
  const [verGraficaConsumo, setVerGraficaConsumo] = useState(false);
  const [mostrarCFE, setMostrarCFE] = useState(false);
  const [mostrarObservacion, setMostrarObservacion] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [posGrafica, setPosGrafica] = useState({ x: window.innerWidth / 2 - 210, y: window.innerHeight / 2 - 220 });
  const arrastrandoGrafica = useRef(false);
  const offsetGrafica = useRef({ x: 0, y: 0 });

  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const mesesOrden = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

  useEffect(() => {
    setCargando(true);
    const datosGuardados = sessionStorage.getItem('cache_todos_sectores');
    if (datosGuardados) {
      setTodosLosSectores(JSON.parse(datosGuardados));
      setCargando(false);
      return;
    }

    const query = `{ 
      todosLosSectores { 
        id clave clasificacion latitud longitud consumoIdeal consumoAceptable consumoMaximo nombreColonia medidor cuenta carga cpd tarifa 
        recibos { id anio mes consumoKwh importe lecturaAnterior lecturaActual notasObservaciones } 
        luminarias { id latitud longitud capacidad cantidadPostes luminariasPorPoste } 
      } 
    }`;
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
    .then(r => r.json())
    .then(res => { 
      if (res.data?.todosLosSectores) {
        setTodosLosSectores(res.data.todosLosSectores);
        sessionStorage.setItem('cache_todos_sectores', JSON.stringify(res.data.todosLosSectores));
        mostrarToast('Datos sincronizados correctamente', 'exito');
      } else {
        mostrarToast('Error al obtener datos del servidor', 'error');
      }
      setCargando(false);
    })
    .catch(() => {
      mostrarToast('Falla de conexión con el servidor GraphQL', 'error');
      setCargando(false);
    });
  }, []);

  const sugerenciasFiltradas = useMemo(() => {
    if (busqueda.length < 2 || !mostrarSugerencias) return [];
    const q = busqueda.toUpperCase();
    const porClave = todosLosSectores.filter(s => s.clave?.toUpperCase().includes(q) || s.medidor?.toUpperCase().includes(q)).map(s => ({ tipo: 'SECTOR', nombre: `${s.clave} (Medidor: ${s.medidor || 'N/A'})`, dato: s }));
    const coloniasUnicas = [...new Set(todosLosSectores.map(s => s.nombreColonia?.toUpperCase()))].filter(col => col && col.includes(q)).map(col => ({ tipo: 'COLONIA', nombre: col }));
    return [...porClave, ...coloniasUnicas].slice(0, 8);
  }, [todosLosSectores, busqueda, mostrarSugerencias]);

  const sectoresMostrados = useMemo(() => {
    return todosLosSectores.filter(s => {
      const esInmueble = s.clasificacion?.toUpperCase().includes("INMUEBLE");
      const recibos = s.recibos || [];
      const ultimoRecibo = [...recibos].sort((a, b) => {
        const anioDiff = parseInt(b.anio) - parseInt(a.anio);
        return anioDiff !== 0 ? anioDiff : mesesOrden.indexOf(b.mes?.substring(0,3)) - mesesOrden.indexOf(a.mes?.substring(0,3));
      })[0];
      const consumoUltimo = ultimoRecibo ? parseFloat(ultimoRecibo.consumoKwh) : 0;
      const limiteMax = parseFloat(s.consumoMaximo) || 0;
      const esAlerta = consumoUltimo > limiteMax && limiteMax > 0;

      if (esInmueble && !verInmuebles) return false;
      if (!esInmueble && !verAlumbrado) return false;
      if (modoBusquedaIndividual && sectorActivo) return s.id === sectorActivo.id;
      if (coloniaFiltrada && s.nombreColonia?.toUpperCase() !== coloniaFiltrada.toUpperCase()) return false;
      if (soloAlertas && !esAlerta) return false;

      return true;
    });
  }, [todosLosSectores, verAlumbrado, verInmuebles, coloniaFiltrada, sectorActivo, modoBusquedaIndividual, soloAlertas, mesesOrden]);

  const chartData = useMemo(() => {
    if (!sectorActivo?.recibos) return [];
    return mesesOrden.map(mes => {
      const reg = sectorActivo.recibos.find(r => r.mes?.substring(0,3) === mes && parseInt(r.anio) === anioSeleccionado);
      return { mes, valor: reg ? parseFloat(reg.consumoKwh) : 0 };
    });
  }, [sectorActivo, anioSeleccionado, mesesOrden]);

  const reciboSeleccionado = useMemo(() => {
    if (!sectorActivo?.recibos) return null;
    const delAnio = sectorActivo.recibos.filter(r => parseInt(r.anio) === anioSeleccionado);
    if (delAnio.length > 0) {
        return [...delAnio].sort((a, b) => mesesOrden.indexOf(b.mes?.substring(0,3)) - mesesOrden.indexOf(a.mes?.substring(0,3)))[0];
    }
    return sectorActivo.recibos[0];
  }, [sectorActivo, anioSeleccionado, mesesOrden]);

  const totalesInfraestructura = useMemo(() => {
    if (!sectorActivo?.luminarias) return { postes: 0, lamparas: 0 };
    return sectorActivo.luminarias.reduce((acc, lum) => {
      const p = parseInt(lum.cantidadPostes) || 1;
      const l = (parseInt(lum.luminariasPorPoste) || 1) * p;
      return { postes: acc.postes + p, lamparas: acc.lamparas + l };
    }, { postes: 0, lamparas: 0 });
  }, [sectorActivo]);

  const notaActual = useMemo(() => {
    if (!reciboSeleccionado) return { tieneNota: false, texto: "No hay datos" };
    return { tieneNota: !!reciboSeleccionado.notasObservaciones, texto: reciboSeleccionado.notasObservaciones || "Sin observaciones.", mes: reciboSeleccionado.mes };
  }, [reciboSeleccionado]);

  return (
    <div 
      onMouseMove={(e) => { 
        if (arrastrandoGrafica.current) {
          setPosGrafica({ 
            x: e.clientX - offsetGrafica.current.x, 
            y: e.clientY - offsetGrafica.current.y 
          });
        }
      }} 
      onMouseUp={() => { arrastrandoGrafica.current = false; }} 
      style={{ height: '100vh', width: '100vw', position: 'relative', background: '#0b0f19', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      
      {/* SKELETON / SPINNER INDICADOR DE CARGA GLOBAL */}
      {cargando && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(11, 15, 25, 0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '48px', height: '48px', border: '4px solid rgba(56, 189, 248, 0.2)',
            borderTop: '4px solid #38bdf8', borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#38bdf8', fontWeight: 800, fontSize: '14px', marginTop: '16px', letterSpacing: '0.05em' }}>
            CARGANDO RED DE ALUMBRADO...
          </p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* SISTEMA DE NOTIFICACIONES TOAST */}
      {notificacion && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, background: notificacion.tipo === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.95)',
          color: notificacion.tipo === 'error' ? '#ffffff' : '#34d399', padding: '10px 20px', borderRadius: '12px', fontSize: '12px', fontWeight: 900,
          boxShadow: '0 10px 25px rgba(0,0,0,0.7)', border: notificacion.tipo === 'error' ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(52, 211, 153, 0.6)',
          backdropFilter: 'blur(8px)', animation: 'fadeInOut 3.5s ease'
        }}>
          {notificacion.tipo === 'error' ? '⚠️ ' : '✅ '} {notificacion.mensaje}
        </div>
      )}

      {/* MAPA CONTENEDOR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
         <MapContainer center={[20.628, -87.076]} zoom={13} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ActualizarMapa sector={sectorActivo} colonia={coloniaFiltrada} todos={todosLosSectores} />
          
          <Pane name="sectores" style={{ zIndex: 400 }}>
            {sectoresMostrados.map(sec => (
              <Marker key={sec.id} position={[parseFloat(sec.latitud), parseFloat(sec.longitud)]} icon={crearIconoSector(sectorActivo?.id === sec.id, sec, mesesOrden)} 
                eventHandlers={{ click: () => { 
                  setSectorActivo(sec); 
                  setModoBusquedaIndividual(false); 
                  setIdsSectoresVisibles(prev => prev.includes(sec.id) ? prev.filter(id => id !== sec.id) : [...prev, sec.id]);
                  mostrarToast(`Sector ${sec.clave} seleccionado`, 'exito');
                }}}>
              </Marker>
            ))}
          </Pane>

          {todosLosSectores.filter(s => idsSectoresVisibles.includes(s.id)).map(s => 
            s.luminarias?.map(lum => {
              if (verModo3D) {
                return (
                  <Marker 
                    key={`poste-3d-${lum.id}`} 
                    position={[parseFloat(lum.latitud), parseFloat(lum.longitud)]} 
                    icon={crearIconoPoste3D(lum.luminariasPorPoste)}
                  />
                );
              } else {
                return (
                  <CircleMarker 
                    key={`lum-${lum.id}`} 
                    center={[parseFloat(lum.latitud), parseFloat(lum.longitud)]} 
                    radius={9} 
                    pathOptions={{ color: '#0f172a', fillColor: '#ff0000', fillOpacity: 0.9, weight: 1.5, pane: 'markerPane' }}>
                    <MapTooltip direction="top" className="tooltip-sin-fondo">
                      <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.5)', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
                        <span style={{ color: '#38bdf8', fontWeight: '900', fontSize: '11px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                          {lum.capacidad || '70'} Watts
                        </span>
                      </div>
                    </MapTooltip>
                  </CircleMarker>
                );
              }
            })
          )}
        </MapContainer>
      </div>

      <style>{`
        .leaflet-tooltip.tooltip-sin-fondo, .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-tooltip.tooltip-sin-fondo::before {
          display: none !important;
        }

        .btn-menu-estilizado {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 6000;
          background: #1e293b;
          color: #ffffff;
          border: 2px solid #000000;
          padding: 10px 18px;
          border-radius: 50px;
          cursor: pointer;
          font-weight: 900;
          font-size: 12px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.6);
          transition: all 0.2s;
        }
        .btn-menu-estilizado:hover, .btn-menu-estilizado.activo {
          background: #38bdf8;
          color: #0f172a;
        }

        .menu-desplegable-container {
          display: none;
          position: absolute;
          top: 70px;
          right: 20px;
          z-index: 5999;
          flex-direction: column;
          gap: 8px;
        }
        .menu-desplegable-container.abierto {
          display: flex;
        }

        .menu-desplegable-container button:hover,
        .menu-desplegable-container select:hover {
          filter: brightness(1.25);
          transform: scale(1.02);
        }
      `}</style>

      {/* BUSCADOR EN LA ESQUINA SUPERIOR IZQUIERDA */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000, width: '300px' }}>
        <input type="text" placeholder="🔍 Clave, colonia o medidor..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
          style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', outline: 'none', fontSize: '12px', fontWeight: '700', color: '#ffffff', boxSizing: 'border-box' }} />
        {sugerenciasFiltradas.length > 0 && (
          <div style={{ background: '#0f172a', borderRadius: '10px', marginTop: '4px', overflow: 'hidden', boxShadow: '0 15px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {sugerenciasFiltradas.map((sug, i) => (
              <div key={i} onClick={() => { 
                setBusqueda(sug.nombre); 
                setMostrarSugerencias(false); 
                if(sug.tipo==='COLONIA') {
                  setColoniaFiltrada(sug.nombre);
                  setSectorActivo(null);
                  setModoBusquedaIndividual(false);
                  mostrarToast(`Filtro aplicado: ${sug.nombre}`, 'exito');
                } else {
                  setColoniaFiltrada(null);
                  setSectorActivo(sug.dato);
                  setModoBusquedaIndividual(true); 
                  setVerGraficaConsumo(false); 
                  setIdsSectoresVisibles([sug.dato.id]);
                  mostrarToast(`Sector ${sug.dato.clave} enfocado`, 'exito');
                }
              }} style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontWeight: '700', color: '#f8fafc' }}>
                {sug.tipo === 'COLONIA' ? '📍' : '⚡'} {sug.nombre}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTÓN DE MENÚ */}
      <button className={`btn-menu-estilizado ${menuAbierto ? 'activo' : ''}`} onClick={() => setMenuAbierto(!menuAbierto)}>
        {menuAbierto ? '✕ CERRAR' : '☰ MENÚ'}
      </button>

      {/* MENÚ DESPLEGABLE VERTICAL */}
      <div className={`menu-desplegable-container ${menuAbierto ? 'abierto' : ''}`}>
        <button onClick={() => { setVerAlumbrado(!verAlumbrado); setMenuAbierto(false); mostrarToast(`Alumbrado ${!verAlumbrado ? 'activado' : 'oculto'}`); }} style={{ background: verAlumbrado ? '#3b82f6' : '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>ALUMBRADO</button>
        <button onClick={() => { setVerInmuebles(!verInmuebles); setMenuAbierto(false); mostrarToast(`Inmuebles ${!verInmuebles ? 'activados' : 'ocultos'}`); }} style={{ background: verInmuebles ? '#f97316' : '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>INMUEBLES</button>
        <button onClick={() => { setSoloAlertas(!soloAlertas); setMenuAbierto(false); mostrarToast(`Filtro Alertas ${!soloAlertas ? 'activado' : 'desactivado'}`); }} style={{ background: soloAlertas ? '#ef4444' : '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>ALERTAS</button>
        <button onClick={() => { setVerModo3D(!verModo3D); setMenuAbierto(false); mostrarToast(`Modo 3D Postes ${!verModo3D ? 'activado' : 'desactivado'}`); }} style={{ background: verModo3D ? '#8b5cf6' : '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>3D POSTES</button>
        <button onClick={() => { if(sectorActivo) { setVerGraficaConsumo(!verGraficaConsumo); setMostrarCFE(false); setMostrarObservacion(false); } else { mostrarToast('Selecciona un sector primero', 'error'); } setMenuAbierto(false); }} style={{ background: verGraficaConsumo ? '#06b6d4' : '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>GRÁFICA</button>
        
        <button onClick={() => { 
          setIdsSectoresVisibles([]); 
          setSectorActivo(null); 
          setVerGraficaConsumo(false); 
          setBusqueda(""); 
          setColoniaFiltrada(null); 
          setModoBusquedaIndividual(false); 
          setSoloAlertas(false); 
          setVerModo3D(false);
          setMenuAbierto(false);
          mostrarToast('Mapa limpiado', 'exito');
        }} style={{ background: '#dc2626', color: '#ffffff', border: '2px solid #000000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 900, fontSize: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', transition: 'all 0.2s' }}>CLEAN</button>
        
        <select value={anioSeleccionado} onChange={(e) => { setAnioSeleccionado(parseInt(e.target.value)); setMenuAbierto(false); mostrarToast(`Año actualizado a ${e.target.value}`, 'exito'); }} style={{ background: '#1e293b', color: '#ffffff', border: '2px solid #000000', padding: '10px 14px', borderRadius: '50px', fontWeight: 900, fontSize: '12px', outline: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.6)', width: '160px', textAlign: 'center', transition: 'all 0.2s' }}>{[2024, 2025, 2026, 2027].map(anio => <option key={anio} value={anio} style={{ color: '#000' }}>{anio}</option>)}</select>
      </div>

      {/* TARJETA DE GRÁFICA MOVIBLE (DRAGGABLE) */}
      {verGraficaConsumo && sectorActivo && (
        <div 
          style={{ 
            left: `${posGrafica.x}px`, top: `${posGrafica.y}px`, 
            position: 'absolute', zIndex: 6000, width: '420px', 
            maxHeight: '85vh', overflowY: 'auto', background: '#0f172a', color: '#f8fafc', padding: '20px', 
            borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)', boxSizing: 'border-box' 
          }}
        >
          <div 
            onMouseDown={(e) => {
              arrastrandoGrafica.current = true;
              offsetGrafica.current = {
                x: e.clientX - posGrafica.x,
                y: e.clientY - posGrafica.y
              };
            }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', cursor: 'grab', userSelect: 'none' }}
          >
            <div><p style={{ margin: 0, fontSize: '9px', color: '#38bdf8', fontWeight: 800, letterSpacing: '0.05em' }}>{sectorActivo.nombreColonia}</p><h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#ffffff' }}>⚡ {sectorActivo.clave}</h3></div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <button onClick={() => { setMostrarCFE(!mostrarCFE); setMostrarObservacion(false); }} style={{ background: mostrarCFE ? '#059669' : 'rgba(5, 150, 105, 0.15)', color: mostrarCFE ? 'white' : '#34d399', border: '1px solid rgba(5, 150, 105, 0.4)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: '900', fontSize: '9px' }}>CFE</button>
              <button onClick={() => { setMostrarObservacion(!mostrarObservacion); setMostrarCFE(false); }} style={{ background: mostrarObservacion ? '#f59e0b' : (notaActual.tieneNota ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.08)'), color: mostrarObservacion ? 'white' : (notaActual.tieneNota ? '#fbbf24' : '#94a3b8'), border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontWeight: '900', fontSize: '9px' }}> <IconoInfo color="currentColor" /> </button>
              <button onClick={() => setVerGraficaConsumo(false)} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          </div>

          {mostrarCFE && (
            <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(6, 78, 59, 0.3)', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <div style={{ gridColumn: 'span 3', marginBottom: '2px' }}><span style={{ background: '#059669', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 900 }}>PERÍODO: {(reciboSeleccionado?.mes || 'S/D').toUpperCase()} {anioSeleccionado}</span></div>
                <div style={{ gridColumn: 'span 1' }}><small style={{ color: '#34d399', fontWeight: 800, fontSize: '7px' }}>MEDIDOR</small><p style={{ margin: 0, fontWeight: 800, fontSize: '10px', color: '#fff' }}>{sectorActivo.medidor || 'N/A'}</p></div>
                <div style={{ gridColumn: 'span 2' }}><small style={{ color: '#34d399', fontWeight: 800, fontSize: '7px' }}>CUENTA</small><p style={{ margin: 0, fontWeight: 800, fontSize: '10px', color: '#fff' }}>{sectorActivo.cuenta || 'N/A'}</p></div>
                <div style={{ gridColumn: 'span 3', display: 'flex', gap: '4px', margin: '3px 0' }}>
                  <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.6)', padding: '5px', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)', textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '6px', fontWeight: 800, display: 'block' }}>ANT.</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>{formatearNumero(reciboSeleccionado?.lecturaAnterior)}</p></div>
                  <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.6)', padding: '5px', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)', textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '6px', fontWeight: 800, display: 'block' }}>ACT.</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>{formatearNumero(reciboSeleccionado?.lecturaActual)}</p></div>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '4px', borderRadius: '6px', textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '6px', fontWeight: 800 }}>CARGA</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900 }}>{sectorActivo.carga || 0}</p></div>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '4px', borderRadius: '6px', textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '6px', fontWeight: 800 }}>CPD</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900 }}>{sectorActivo.cpd || 0}</p></div>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '4px', borderRadius: '6px', textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '6px', fontWeight: 800 }}>TARIFA</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900 }}>{sectorActivo.tarifa || '5A'}</p></div>
                <div style={{ gridColumn: 'span 3', borderTop: '1px dashed rgba(52, 211, 153, 0.3)', paddingTop: '4px', display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '7px', fontWeight: 800 }}>POSTES</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900 }}>{totalesInfraestructura.postes}</p></div>
                  <div style={{ textAlign: 'center' }}><small style={{ color: '#34d399', fontSize: '7px', fontWeight: 800 }}>LUMINARIAS</small><p style={{ margin: 0, fontSize: '10px', fontWeight: 900 }}>{totalesInfraestructura.lamparas}</p></div>
                </div>
              </div>
            </div>
          )}

          {mostrarObservacion && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(120, 53, 15, 0.3)', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.3)', fontSize: '11px' }}>
              <strong style={{ fontSize: '9px', color: '#fbbf24' }}>NOTA ({notaActual.mes?.toUpperCase()})</strong>
              <p style={{ margin: '3px 0 0', color: '#fde68a', lineHeight: '1.4' }}>{notaActual.texto}</p>
            </div>
          )}

          <div style={{ height: '170px', marginTop: '12px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="mes" tick={{fill: '#94a3b8', fontSize: 9}} />
                <YAxis tickFormatter={formatearNumero} axisLine={false} tick={{fill: '#94a3b8', fontSize: 8}} width={45} />
                <Tooltip content={<CustomTooltipGrafica />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <ReferenceLine y={Number(sectorActivo.consumoIdeal)} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'IDEAL', fill: '#10b981', fontSize: 6 }} />
                <ReferenceLine y={Number(sectorActivo.consumoAceptable)} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: 'ACEPTAB', fill: '#f59e0b', fontSize: 6 }} />
                <ReferenceLine y={Number(sectorActivo.consumoMaximo)} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'right', value: 'MAX', fill: '#ef4444', fontSize: 6 }} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={16}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.valor > (Number(sectorActivo.consumoMaximo) || 99999) ? '#ef4444' : '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}><p style={{ margin: 0, fontSize: '7px', color: '#34d399', fontWeight: 800 }}>IDEAL</p><p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#6ee7b7' }}>{formatearNumero(sectorActivo.consumoIdeal)}</p></div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}><p style={{ margin: 0, fontSize: '7px', color: '#fbbf24', fontWeight: 800 }}>ACEPTABLE</p><p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#fde68a' }}>{formatearNumero(sectorActivo.consumoAceptable)}</p></div>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.1)' }}><p style={{ margin: 0, fontSize: '7px', color: '#f87171', fontWeight: 800 }}>MÁXIMO</p><p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#fca5a5' }}>{formatearNumero(sectorActivo.consumoMaximo)}</p></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapaBase;