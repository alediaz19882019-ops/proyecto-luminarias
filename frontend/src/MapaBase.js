import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, CircleMarker, Pane, Tooltip as MapTooltip } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = 'http://localhost:8085/graphql';

const IconoInfo = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);

const formatearNumero = (num) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(num) || 0);
};

const ActualizarMapa = ({ sector, colonia, todos }) => {
  const map = useMap();
  useEffect(() => {
    if (sector && sector.latitud) {
      map.setView([parseFloat(sector.latitud), parseFloat(sector.longitud)], 18, { animate: true });
    } else if (colonia) {
      const primerSector = todos.find(s => s.nombreColonia?.toUpperCase() === colonia.toUpperCase());
      if (primerSector) {
        map.setView([parseFloat(primerSector.latitud), parseFloat(primerSector.longitud)], 15, { animate: true });
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

  let color = '#2563eb'; 
  if (esAlerta) color = '#dc2626'; 
  else if (sector.clasificacion?.toUpperCase().includes("INMUEBLE")) color = '#ff8c00ff'; 

  const triClipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';

  return L.divIcon({ 
    html: `
      <div style="
        width: 20px; height: 20px; 
        position: relative; 
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.4)) drop-shadow(-1px -1px 1px rgba(255,255,255,0.2));
        transform: ${isActive ? 'scale(1.4) translateY(-5px)' : 'scale(1)'};
        transition: all 0.3s ease;
      ">
        <div style="position: absolute; width: 100%; height: 100%; background: #111; clip-path: ${triClipPath};"></div>
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
          ${esAlerta ? `<span style="color: white; font-weight: 900; font-size: 13px; margin-top: 2px; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); animation: saltoSuave 1.2s infinite ease-in-out;">!</span>` : ''}
        </div>
      </div>
    `, 
    iconSize: [20, 20], iconAnchor: [10, 20]
  });
};

const MapaBase = () => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [sectorActivo, setSectorActivo] = useState(null); 
  const [idsSectoresVisibles, setIdsSectoresVisibles] = useState([]); 
  const [busqueda, setBusqueda] = useState("");
  const [coloniaFiltrada, setColoniaFiltrada] = useState(null);
  const [modoBusquedaIndividual, setModoBusquedaIndividual] = useState(false);
  const [verAlumbrado, setVerAlumbrado] = useState(true);
  const [verInmuebles, setVerInmuebles] = useState(true);
  const [soloAlertas, setSoloAlertas] = useState(false); // NUEVO ESTADO
  const [anioSeleccionado, setAnioSeleccionado] = useState(2026);
  const [verGraficaConsumo, setVerGraficaConsumo] = useState(false);
  const [mostrarCFE, setMostrarCFE] = useState(false);
  const [mostrarObservacion, setMostrarObservacion] = useState(false);
  const [posConsumo, setPosConsumo] = useState({ x: 80, y: 120 });
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
  const arrastrando = useRef(null);
  const offset = useRef({ x: 0, y: 0 });
  const mesesOrden = useMemo(() => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], []);

  useEffect(() => {
    const query = `{ 
      todosLosSectores { 
        id clave clasificacion latitud longitud consumoIdeal consumoAceptable consumoMaximo nombreColonia medidor cuenta carga cpd tarifa 
        recibos { id anio mes consumoKwh importe lecturaAnterior lecturaActual notasObservaciones } 
        luminarias { id latitud longitud capacidad cantidadPostes luminariasPorPoste } 
      } 
    }`;
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
    .then(r => r.json()).then(res => { if (res.data?.todosLosSectores) setTodosLosSectores(res.data.todosLosSectores); });
  }, []);

  const sugerenciasFiltradas = useMemo(() => {
    if (busqueda.length < 2 || !mostrarSugerencias) return [];
    const q = busqueda.toUpperCase();
    const porClave = todosLosSectores.filter(s => s.clave?.toUpperCase().includes(q)).map(s => ({ tipo: 'SECTOR', nombre: s.clave, dato: s }));
    const coloniasUnicas = [...new Set(todosLosSectores.map(s => s.nombreColonia?.toUpperCase()))].filter(col => col && col.includes(q)).map(col => ({ tipo: 'COLONIA', nombre: col }));
    return [...porClave, ...coloniasUnicas].slice(0, 8);
  }, [todosLosSectores, busqueda, mostrarSugerencias]);

  const sectoresMostrados = useMemo(() => {
    return todosLosSectores.filter(s => {
      const esInmueble = s.clasificacion?.toUpperCase().includes("INMUEBLE");
      
      // Lógica para detectar Alerta (Rojo)
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
      
      // Filtro de Alerta Rojo
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
    <div onMouseMove={(e) => { if(arrastrando.current === 'consumo') setPosConsumo({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }); }} 
      onMouseUp={() => { arrastrando.current = null; }} 
      style={{ height: '100vh', width: '100%', position: 'relative', background: '#f8fafc', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000, width: '320px' }}>
        <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setMostrarSugerencias(true); }}
          style={{ width: '100%', padding: '14px 22px', borderRadius: '18px', border: 'none', boxShadow: '0 8px 25px rgba(0,0,0,0.15)', outline: 'none', fontSize: '14px', fontWeight: '700' }} />
        {sugerenciasFiltradas.length > 0 && (
          <div style={{ background: 'white', borderRadius: '15px', marginTop: '8px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            {sugerenciasFiltradas.map((sug, i) => (
              <div key={i} onClick={() => { 
                setBusqueda(sug.nombre); 
                setMostrarSugerencias(false); 
                if(sug.tipo==='COLONIA') {
                  setColoniaFiltrada(sug.nombre);
                  setSectorActivo(null);
                  setModoBusquedaIndividual(false);
                } else {
                  setColoniaFiltrada(null);
                  setSectorActivo(sug.dato);
                  setModoBusquedaIndividual(true); 
                  setVerGraficaConsumo(false); 
                  setIdsSectoresVisibles([sug.dato.id]);
                }
              }} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', fontSize: '12px', fontWeight: '800' }}>
                {sug.tipo === 'COLONIA' ? '📍' : '⚡'} {sug.nombre}
              </div>
            ))}
          </div>
        )}
      </div>

       <MapContainer center={[20.628, -87.076]} zoom={13} style={{ height: '100%', zIndex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ActualizarMapa sector={sectorActivo} colonia={coloniaFiltrada} todos={todosLosSectores} />
        
        <Pane name="sectores" style={{ zIndex: 400 }}>
          {sectoresMostrados.map(sec => (
            <Marker key={sec.id} position={[parseFloat(sec.latitud), parseFloat(sec.longitud)]} icon={crearIconoSector(sectorActivo?.id === sec.id, sec, mesesOrden)} 
              eventHandlers={{ click: () => { 
                setSectorActivo(sec); 
                setModoBusquedaIndividual(false); 
                setIdsSectoresVisibles(prev => prev.includes(sec.id) ? prev.filter(id => id !== sec.id) : [...prev, sec.id]);
              }}}>
              <MapTooltip direction="top" offset={[0, -15]} opacity={0.9}><span style={{ fontWeight: '800', fontSize: '12px' }}>{sec.id}</span></MapTooltip>
            </Marker>
          ))}
        </Pane>

        {todosLosSectores.filter(s => idsSectoresVisibles.includes(s.id)).map(s => 
          s.luminarias?.map(lum => (
            <CircleMarker key={`lum-${lum.id}`} center={[parseFloat(lum.latitud), parseFloat(lum.longitud)]} radius={6} pathOptions={{ color: 'black', fillColor: 'red', fillOpacity: 1, weight: 1.5, pane: 'markerPane' }}>
              <MapTooltip direction="top"><strong>{lum.capacidad} Watts</strong></MapTooltip>
            </CircleMarker>
          ))
        )}
      </MapContainer>

      <div style={{ position: 'absolute', bottom: 50, left: 10, zIndex: 5000, display: 'flex', gap: '5px', flexWrap: 'nowrap', maxWidth: '900px', alignItems: 'center' }}>
        <button onClick={() => setVerAlumbrado(!verAlumbrado)} style={{ background: verAlumbrado ? '#3b82f6' : 'white', color: verAlumbrado ? 'white' : '#64748b', border: '1px solid #000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}> ALUMBRADO</button>
        <button onClick={() => setVerInmuebles(!verInmuebles)} style={{ background: verInmuebles ? '#ff8c00ff' : 'white', color: verInmuebles ? 'white' : '#64748b', border: '1px solid #000', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}> INMUEBLES</button>
        
        {/* BOTÓN ALERTA ROJO */}
        <button onClick={() => setSoloAlertas(!soloAlertas)} style={{ background: soloAlertas ? '#dc2626' : 'white', color: soloAlertas ? 'white' : '#dc2626', border: '2px solid #dc2626', padding: '10px 18px', borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}> ALERTAS</button>
        
        <button onClick={() => { if(sectorActivo) setVerGraficaConsumo(!verGraficaConsumo); setMostrarCFE(false); setMostrarObservacion(false); }} style={{ background: verGraficaConsumo ? '#8b5cf6' : 'white', color: verGraficaConsumo ? 'white' : '#8b5cf6', border: '2px solid #000', padding: '10px 18px', borderRadius: '50px', fontWeight: 800, fontSize: '11px' }}> GRÁFICA</button>
        
        <button onClick={() => { 
          setIdsSectoresVisibles([]); 
          setSectorActivo(null); 
          setVerGraficaConsumo(false); 
          setBusqueda(""); 
          setColoniaFiltrada(null); 
          setModoBusquedaIndividual(false); 
          setSoloAlertas(false); // Limpiar alertas en Clean
        }} style={{ background: '#f1f5f9', color: '#ef4444', border: '1px solid #000', padding: '10px 18px', borderRadius: '50px', fontWeight: 800, fontSize: '11px' }}>CLEAN</button>
        
        <select value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(parseInt(e.target.value))} style={{ background: 'white', border: '1px solid #000', padding: '10px 15px', borderRadius: '50px', fontWeight: 800, fontSize: '11px' }}>{[2024, 2025, 2026, 2027].map(anio => <option key={anio} value={anio}>{anio}</option>)}</select>
      </div>

      {verGraficaConsumo && sectorActivo && (
        <div style={{ left: posConsumo.x, top: posConsumo.y, position: 'absolute', zIndex: 4000, width: '480px', background: 'white', padding: '25px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div onMouseDown={(e) => { arrastrando.current = 'consumo'; offset.current = { x: e.clientX - posConsumo.x, y: e.clientY - posConsumo.y }; }} style={{ cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div><p style={{ margin: 0, fontSize: '10px', color: '#3b82f6', fontWeight: 900 }}>{sectorActivo.nombreColonia}</p><h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>⚡ {sectorActivo.clave}</h3></div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => { setMostrarCFE(!mostrarCFE); setMostrarObservacion(false); }} style={{ background: mostrarCFE ? '#059669' : '#f0fdf4', color: mostrarCFE ? 'white' : '#059669', border: `1px solid #bbf7d0`, borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontWeight: '900', fontSize: '10px' }}>CFE</button>
              <button onClick={() => { setMostrarObservacion(!mostrarObservacion); setMostrarCFE(false); }} style={{ background: mostrarObservacion ? '#f59e0b' : (notaActual.tieneNota ? '#f0efeeff' : '#f8fafc'), color: mostrarObservacion ? 'white' : (notaActual.tieneNota ? '#fb9803ff' : '#f1af08ff'), border: `1px solid ${notaActual.tieneNota ? '#f59e0b' : '#e2e8f0'}`, borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontWeight: '900', fontSize: '10px' }}> <IconoInfo color="currentColor" /> </button>
              <button onClick={() => setVerGraficaConsumo(false)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: '900' }}>✕</button>
            </div>
          </div>

          {mostrarCFE && (
            <div style={{ marginTop: '12px', padding: '15px', background: '#f0fdf4', borderRadius: '15px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ gridColumn: 'span 3', marginBottom: '5px' }}><span style={{ background: '#059669', color: 'white', padding: '3px 10px', borderRadius: '8px', fontSize: '9px', fontWeight: 900 }}>DATOS DE {(reciboSeleccionado?.mes || 'S/D').toUpperCase()} {anioSeleccionado}</span></div>
                <div style={{ gridColumn: 'span 1' }}><small style={{ color: '#059669', fontWeight: 800, fontSize: '8px' }}>MEDIDOR</small><p style={{ margin: 0, fontWeight: 800, fontSize: '11px' }}>{sectorActivo.medidor || 'N/A'}</p></div>
                <div style={{ gridColumn: 'span 2' }}><small style={{ color: '#059669', fontWeight: 800, fontSize: '8px' }}>CUENTA</small><p style={{ margin: 0, fontWeight: 800, fontSize: '11px' }}>{sectorActivo.cuenta || 'N/A'}</p></div>
                <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px', margin: '5px 0' }}>
                  <div style={{ flex: 1, background: 'white', padding: '8px', borderRadius: '12px', border: '1px solid #dcfce7', textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '7px', fontWeight: 800, display: 'block' }}>LECTURA ANTERIOR</small><p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: '#166534' }}>{formatearNumero(reciboSeleccionado?.lecturaAnterior)}</p></div>
                  <div style={{ flex: 1, background: 'white', padding: '8px', borderRadius: '12px', border: '1px solid #dcfce7', textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '7px', fontWeight: 800, display: 'block' }}>ACTUAL</small><p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: '#166534' }}>{formatearNumero(reciboSeleccionado?.lecturaActual)}</p></div>
                </div>
                <div style={{ background: 'white', padding: '6px', borderRadius: '10px', textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '7px', fontWeight: 800 }}>CARGA</small><p style={{ margin: 0, fontSize: '11px', fontWeight: 900 }}>{sectorActivo.carga || 0}</p></div>
                <div style={{ background: 'white', padding: '6px', borderRadius: '10px', textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '7px', fontWeight: 800 }}>CPD</small><p style={{ margin: 0, fontSize: '11px', fontWeight: 900 }}>{sectorActivo.cpd || 0}</p></div>
                <div style={{ background: 'white', padding: '6px', borderRadius: '10px', textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '7px', fontWeight: 800 }}>TARIFA</small><p style={{ margin: 0, fontSize: '11px', fontWeight: 900 }}>{sectorActivo.tarifa || '5A'}</p></div>
                <div style={{ gridColumn: 'span 3', borderTop: '1px dashed #bbf7d0', paddingTop: '8px', display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '8px', fontWeight: 800 }}>📏 POSTES</small><p style={{ margin: 0, fontSize: '12px', fontWeight: 900 }}>{totalesInfraestructura.postes}</p></div>
                  <div style={{ textAlign: 'center' }}><small style={{ color: '#059669', fontSize: '8px', fontWeight: 800 }}>💡 LUMINARIAS</small><p style={{ margin: 0, fontSize: '12px', fontWeight: 900 }}>{totalesInfraestructura.lamparas}</p></div>
                </div>
              </div>
            </div>
          )}

          {mostrarObservacion && (
            <div style={{ marginTop: '12px', padding: '15px', background: notaActual.tieneNota ? '#fffbeb' : '#f8fafc', borderRadius: '15px', border: `1px solid ${notaActual.tieneNota ? '#fef3c7' : '#e2e8f0'}`, fontSize: '12px' }}>
              <strong style={{ fontSize: '10px', color: notaActual.tieneNota ? '#92400e' : '#64748b' }}>{notaActual.tieneNota ? `📝 NOTA (${notaActual.mes?.toUpperCase()})` : 'INFO'}</strong>
              <p style={{ margin: '5px 0 0', color: notaActual.tieneNota ? '#78350f' : '#94a3b8' }}>{notaActual.texto}</p>
            </div>
          )}

          <div style={{ height: '220px', marginTop: '15px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis tickFormatter={formatearNumero} axisLine={false} tick={{fill: '#94a3b8', fontSize: 10}} width={65} />
                <Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => [formatearNumero(v), "kWh"]} />
                <ReferenceLine y={Number(sectorActivo.consumoIdeal)} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'IDEAL', fill: '#10b981', fontSize: 8 }} />
                <ReferenceLine y={Number(sectorActivo.consumoAceptable)} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: 'ACEPTABLE', fill: '#f59e0b', fontSize: 8 }} />
                <ReferenceLine y={Number(sectorActivo.consumoMaximo)} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'right', value: 'MAXIMO', fill: '#ef4444', fontSize: 8 }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={30}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.valor > (Number(sectorActivo.consumoMaximo) || 99999) ? '#ef4444' : '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '15px' }}>
            <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '12px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '8px', color: '#16a34a', fontWeight: 800 }}>IDEAL</p><p style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#166534' }}>{formatearNumero(sectorActivo.consumoIdeal)}</p></div>
            <div style={{ background: '#fffbeb', padding: '8px', borderRadius: '12px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '8px', color: '#d97706', fontWeight: 800 }}>ACEPTABLE</p><p style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#92400e' }}>{formatearNumero(sectorActivo.consumoAceptable)}</p></div>
            <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '12px', textAlign: 'center' }}><p style={{ margin: 0, fontSize: '8px', color: '#dc2626', fontWeight: 800 }}>MÁXIMO</p><p style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#991b1b' }}>{formatearNumero(sectorActivo.consumoMaximo)}</p></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapaBase;