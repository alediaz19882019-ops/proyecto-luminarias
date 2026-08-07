import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = 'http://localhost:8085/graphql';

// Cálculo de distancia en metros (Haversine)
const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const rad1 = (lat1 * Math.PI) / 180;
  const rad2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad1) * Math.cos(rad2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Capturador de clics en el mapa
const CapturadorDeClics = ({ onMapaClick }) => {
  useMapEvents({
    click(e) {
      onMapaClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
};

// Controlador de cámara suave
const CentrarCamara = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      map.flyTo([coords.lat, coords.lng], 18, { animate: true });
    }
  }, [coords, map]);
  return null;
};

export default function ReportesPage() {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [coordsInspeccion, setCoordsInspeccion] = useState(null);
  const [cargandoGPS, setCargandoGPS] = useState(false);
  const [fallaText, setFallaText] = useState("");
  const [radioMetros, setRadioMetros] = useState(300);
  
  // Estados para el Buscador por Colonia/Sector
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Carga de datos de la API
  useEffect(() => {
    const query = `{ 
      todosLosSectores { 
        id clave latitud longitud nombreColonia
        luminarias { 
          id latitud longitud capacidad
        } 
      } 
    }`;
    
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
      .then(r => r.json())
      .then(res => {
        if (res.data && res.data.todosLosSectores) {
          setTodosLosSectores(res.data.todosLosSectores);
        }
      })
      .catch(err => console.error("Error al cargar datos:", err));
  }, []);

  // Sugerencias de búsqueda filtradas
  const sugerencias = useMemo(() => {
    if (busqueda.length < 2 || !mostrarSugerencias) return [];
    const q = busqueda.toUpperCase();
    
    const porClave = todosLosSectores
      .filter(s => s.clave?.toUpperCase().includes(q))
      .map(s => ({ tipo: 'SECTOR', texto: `Sector: ${s.clave} (${s.nombreColonia || 'Sin Colonia'})`, coords: { lat: parseFloat(s.latitud), lng: parseFloat(s.longitud) } }));
      
    const coloniasUnicas = [...new Set(todosLosSectores.map(s => s.nombreColonia?.toUpperCase()))]
      .filter(col => col && col.includes(q))
      .map(col => {
        const sectorRef = todosLosSectores.find(s => s.nombreColonia?.toUpperCase() === col);
        return {
          tipo: 'COLONIA',
          texto: `Colonia: ${col}`,
          coords: sectorRef ? { lat: parseFloat(sectorRef.latitud), lng: parseFloat(sectorRef.longitud) } : null
        };
      }).filter(c => c.coords !== null);

    return [...porClave, ...coloniasUnicas].slice(0, 6);
  }, [todosLosSectores, busqueda, mostrarSugerencias]);

  // Obtener GPS actual
  const obtenerUbicacionGPS = () => {
    setCargandoGPS(true);
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización.");
      setCargandoGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordsInspeccion({ lat: parseFloat(pos.coords.latitude), lng: parseFloat(pos.coords.longitude) });
        setCargandoGPS(false);
      },
      () => {
        alert("No se pudo obtener la ubicación GPS.");
        setCargandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClicEnMapa = (coords) => {
    setCoordsInspeccion(coords);
  };

  // Enviar Reporte
  const enviarReporte = async (luminariaId, sectorId) => {
    if (!fallaText.trim()) return alert("Ingresa una descripción de la falla.");

    const mutation = `mutation {
      crearMantenimiento(luminariaId: ${luminariaId}, sectorId: ${sectorId}, descripcion: "${fallaText}") {
        id estado
      }
    }`;

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation })
      });

      const copias = [...todosLosSectores];
      const sIdx = copias.findIndex(s => s.id === sectorId);
      if (sIdx > -1) {
        const lIdx = copias[sIdx].luminarias.findIndex(l => l.id === luminariaId);
        if (lIdx > -1) {
          if (!copias[sIdx].luminarias[lIdx].mantenimientos) copias[sIdx].luminarias[lIdx].mantenimientos = [];
          copias[sIdx].luminarias[lIdx].mantenimientos.push({ estado: 'PENDIENTE' });
        }
      }
      
      setTodosLosSectores(copias);
      setFallaText("");
      alert("¡Reporte levantado exitosamente!");
    } catch (e) {
      alert("Error al conectar con el servidor.");
    }
  };

  // Filtrar luminarias por cercanía al punto seleccionado
  const luminariasCercanas = useMemo(() => {
    if (!coordsInspeccion || !todosLosSectores.length) return [];
    const cercanas = [];

    todosLosSectores.forEach(s => {
      s.luminarias?.forEach(lum => {
        const lat = parseFloat(lum.latitud);
        const lng = parseFloat(lum.longitud);

        if (!isNaN(lat) && !isNaN(lng)) {
          const dist = calcularDistanciaMetros(coordsInspeccion.lat, coordsInspeccion.lng, lat, lng);
          if (dist <= radioMetros) {
            const tieneFalla = lum.mantenimientos?.some(m => m.estado === 'PENDIENTE') || false;
            cercanas.push({
              ...lum,
              lat,
              lng,
              distancia: Math.round(dist),
              sectorId: s.id,
              sectorClave: s.clave,
              tieneFalla
            });
          }
        }
      });
    });

    return cercanas;
  }, [todosLosSectores, coordsInspeccion, radioMetros]);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', fontFamily: 'Inter, system-ui, sans-serif', background: '#0f172a' }}>
      
      {/* 🌟 PANEL DE CONTROL SUPERIOR ELEGANTE */}
      <div style={{ 
        position: 'absolute', top: 20, left: 20, right: 20, zIndex: 1000, 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        pointerEvents: 'none', flexWrap: 'wrap', gap: '15px' 
      }}>
        
        {/* Tarjeta de Información e Indicadores */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', 
          padding: '14px 22px', borderRadius: '18px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', 
          pointerEvents: 'auto', border: '1px solid rgba(255,255,255,0.4)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
              MÓDULO DE MANTENIMIENTO
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            {coordsInspeccion ? (
              <span>Postes analizados en un radio de <strong style={{ color: '#2563eb' }}>{radioMetros}m</strong>: <strong style={{ color: '#8b5cf6', fontSize: '13px' }}>{luminariasCercanas.length} unidades</strong></span>
            ) : (
              <span style={{ color: '#be185d', fontWeight: 700 }}>💡 Busque una colonia, use su GPS o haga clic en el mapa</span>
            )}
          </p>
        </div>

        {/* Controles: Buscador + Radio + GPS */}
        <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Buscador por Colonia o Sector */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar Colonia o Sector..." 
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
              style={{ 
                background: 'white', border: '1px solid #cbd5e1', padding: '12px 18px', 
                borderRadius: '50px', fontWeight: 700, fontSize: '12px', width: '240px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', outline: 'none', color: '#1e293b'
              }}
            />
            {sugerencias.length > 0 && (
              <div style={{ 
                position: 'absolute', top: '110%', left: 0, right: 0, background: 'white', 
                borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', zIndex: 1100 
              }}>
                {sugerencias.map((sug, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      setCoordsInspeccion(sug.coords);
                      setBusqueda(sug.texto);
                      setMostrarSugerencias(false);
                    }}
                    style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#334155' }}
                    onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.target.style.background = 'white'}
                  >
                    {sug.tipo === 'COLONIA' ? '📍' : '⚡'} {sug.texto}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selector de Radio */}
          {coordsInspeccion && (
            <select 
              value={radioMetros} 
              onChange={(e) => setRadioMetros(Number(e.target.value))}
              style={{ 
                background: 'white', border: '1px solid #cbd5e1', padding: '12px 16px', 
                borderRadius: '50px', fontWeight: 800, fontSize: '12px', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', cursor: 'pointer', color: '#334155' 
              }}
            >
              <option value={100}>📏 Radio: 100m</option>
              <option value={300}>📏 Radio: 300m</option>
              <option value={500}>📏 Radio: 500m</option>
              <option value={1000}>📏 Radio: 1km</option>
            </select>
          )}

          {/* Botón GPS */}
          <button 
            onClick={obtenerUbicacionGPS}
            style={{ 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
              color: 'white', border: 'none', padding: '12px 22px', borderRadius: '50px', 
              cursor: 'pointer', fontWeight: 900, fontSize: '12px', 
              boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'transform 0.2s'
            }}
          >
            {cargandoGPS ? '⏳ Buscando...' : '📍 MI GPS'}
          </button>
        </div>
      </div>

      {/* 🗺️ MAPA INTERACTIVO */}
      <MapContainer center={[20.628, -87.076]} zoom={14} style={{ height: '100%', width: '100%', cursor: 'crosshair' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <CapturadorDeClics onMapaClick={handleClicEnMapa} />
        <CentrarCamara coords={coordsInspeccion} />

        {/* Punto de Inspección con Contorno Negro Definido */}
        {coordsInspeccion && (
          <CircleMarker
            center={[coordsInspeccion.lat, coordsInspeccion.lng]}
            radius={13}
            pathOptions={{ 
              color: '#000000',      // Contorno negro grueso
              fillColor: '#8b5cf6',  // Morado eléctrico elegante
              fillOpacity: 0.95, 
              weight: 3.5            
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <strong style={{ color: '#7c3aed', fontSize: '13px' }}>📍 Punto de Inspección</strong>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Postes analizados en el radio seleccionado</p>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Luminarias Cercanas con Contorno Negro Alta Visibilidad */}
        {luminariasCercanas.map(lum => (
          <CircleMarker
            key={`reporte-lum-${lum.id}`}
            center={[lum.lat, lum.lng]}
            radius={lum.tieneFalla ? 10 : 7.5}
            pathOptions={{
              color: '#000000',                                  // Contorno negro contrastante
              fillColor: lum.tieneFalla ? '#ef4444' : '#2563eb', // Rojo alerta o Azul normal
              fillOpacity: 0.95,
              weight: 2.5                                        // Grosor perfecto
            }}
          >
            <Popup minWidth={230}>
              <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>Luminaria #{lum.id}</h4>
                  <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, color: '#475569' }}>
                    {lum.distancia}m de distancia
                  </span>
                </div>
                
                <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Sector: <strong style={{ color: '#1e293b' }}>{lum.sectorClave}</strong> | Potencia: <strong style={{ color: '#1e293b' }}>{lum.capacidad || 'LED'}</strong>
                </p>

                {lum.tieneFalla ? (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '11px', fontWeight: 900 }}>⚠️ EN MANTENIMIENTO PENDIENTE</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      placeholder="Describa la falla (ej. Foco fundido, intermitente...)"
                      value={fallaText}
                      onChange={(e) => setFallaText(e.target.value)}
                      style={{ 
                        width: '100%', minHeight: '60px', padding: '8px', fontSize: '11px', 
                        borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', outline: 'none',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    />
                    <button
                      onClick={() => enviarReporte(lum.id, lum.sectorId)}
                      style={{ 
                        background: '#ef4444', color: 'white', padding: '8px 12px', 
                        borderRadius: '8px', border: 'none', fontWeight: 900, fontSize: '11px', 
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' 
                      }}
                    >
                      🚨 REGISTRAR REPORTE
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
