import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ComposedChart, Line, Cell
} from 'recharts';

const COLORS = {
  alumbrado: '#10b981', 
  inmuebles: '#eab308', 
  costo: '#6366f1',
  alerta: '#ef4444', 
  aceptable: '#f59e0b', 
  bg: '#020617',          
  card: 'transparent', 
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#64748b', 
  white: '#ffffff'
};

// --- FORMATEADORES ---
const formatMK = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v;
};

const formatCurrencyMK = (v) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
};

const formatCurrency = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v || 0);
const formatNumber = (v) => new Intl.NumberFormat('es-MX').format(Math.round(v || 0));

// --- TOOLTIP CON CONTORNO / SOMBRA DE ALTO CONTRASTE (TEXT-SHADOW) ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ pointerEvents: 'none', padding: '2px 4px' }}>
        {label && (
          <p style={{ 
            margin: '0 0 2px 0', 
            fontSize: '10px', 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            color: '#e2e8f0',
            textShadow: '0px 1px 3px #000000, 0px 0px 6px #000000'
          }}>
            {label}
          </p>
        )}
        {payload.map((entry, index) => {
          const colorSerie = entry.color || entry.fill || COLORS.white;
          return (
            <div key={index} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              margin: '2px 0', 
              color: colorSerie,
              textShadow: '0px 1px 4px #000000, 0px 0px 8px #000000, 0px 0px 2px #000000'
            }}>
              <span style={{ 
                width: '7px', 
                height: '7px', 
                borderRadius: '50%', 
                backgroundColor: colorSerie, 
                boxShadow: '0 0 4px #000' 
              }}></span>
              <span>{entry.name}:</span>
              <span style={{ fontWeight: '900' }}>
                {entry.name.toLowerCase().includes('consumo') || entry.name.toLowerCase().includes('kwh') 
                  ? `${formatNumber(entry.value)} kWh` 
                  : formatCurrency(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const [view, setView] = useState("general"); 
  const [anio, setAnio] = useState("2026");
  const [rawData, setRawData] = useState([]); 
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [seleccion, setSeleccion] = useState(null); 
  const [busqueda, setBusqueda] = useState("");
  const [listaSugerencias, setListaSugerencias] = useState([]);

  const getMesKey = (m) => {
    if (!m) return null;
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    let val = m.toString().trim().toUpperCase();
    if (!isNaN(val)) return meses[parseInt(val) - 1];
    return meses.find(n => val.startsWith(n.toUpperCase())) || null;
  };

  const fetchData = useCallback(async () => {
    const cacheKey = `cache_dashboard_${anio}`;
    const datosGuardados = sessionStorage.getItem(cacheKey);

    // Si ya existen datos en caché para este año, se cargan de inmediato sin llamar a la red
    if (datosGuardados) {
      const parsed = JSON.parse(datosGuardados);
      setRawData(parsed.rawData || []);
      setTodosLosSectores(parsed.todosLosSectores || []);
      return;
    }

    const query = `query($anio: Int!) { 
      recibosConsolidados(anio: $anio) { mes consumoKwh importe tipoServicio }
      todosLosSectores { 
        id clave clasificacion consumoIdeal consumoAceptable consumoMaximo nombreColonia
        recibos { anio mes consumoKwh importe } 
        luminarias { id luminariasPorPoste }
      } 
    }`;
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8085/graphql';
      
      const res = await fetch(API_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { anio: parseInt(anio) } }),
      });

      const result = await res.json();
      const newRaw = result.data?.recibosConsolidados || [];
      const newSectores = result.data?.todosLosSectores || [];

      setRawData(newRaw);
      setTodosLosSectores(newSectores);

      // Guardar en sessionStorage para agilizar próximas visitas en la misma pestaña
      sessionStorage.setItem(cacheKey, JSON.stringify({ rawData: newRaw, todosLosSectores: newSectores }));
    } catch (err) { console.error("Error al cargar dashboard:", err); }
  }, [anio]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (busqueda.length < 2) { setListaSugerencias([]); return; }
    const term = busqueda.toLowerCase();
    const listado = [];
    const coloniasVistas = new Set();

    todosLosSectores.forEach(s => {
      const col = s.nombreColonia?.toUpperCase() || "";
      const clave = s.clave?.toUpperCase() || "";
      if (col.toLowerCase().includes(term) && !coloniasVistas.has(col)) {
        coloniasVistas.add(col);
        listado.push({ tipo: 'Colonia', nombre: col, data: todosLosSectores.filter(sect => sect.nombreColonia === s.nombreColonia) });
      }
      if (clave.toLowerCase().includes(term)) {
        listado.push({ tipo: 'Sector', nombre: clave, data: [s] });
      }
    });
    setListaSugerencias(listado.slice(0, 8));
  }, [busqueda, todosLosSectores]);

  const processedGeneral = useMemo(() => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const map = {};
    meses.forEach(m => map[m] = { name: m, alum_pago: 0, inm_pago: 0, alum_kwh: 0, inm_kwh: 0 });
    
    if (parseInt(anio) === 2026) {
      todosLosSectores.forEach(s => {
        const esInmueble = s.clasificacion?.toUpperCase().includes("INMUEBLE");
        (s.recibos || []).forEach(r => {
          if (parseInt(r.anio) === 2026) {
            const mk = getMesKey(r.mes);
            if (mk && map[mk]) {
              if (esInmueble) { map[mk].inm_pago += (r.importe || 0); map[mk].inm_kwh += (r.consumoKwh || 0); }
              else { map[mk].alum_pago += (r.importe || 0); map[mk].alum_kwh += (r.consumoKwh || 0); }
            }
          }
        });
      });
    } else {
      rawData.forEach(r => {
        const mk = getMesKey(r.mes);
        if (mk && map[mk]) {
          if (r.tipoServicio?.toUpperCase().includes('ALUMBRADO')) {
            map[mk].alum_pago += (r.importe || 0); map[mk].alum_kwh += (r.consumoKwh || 0);
          } else {
            map[mk].inm_pago += (r.importe || 0); map[mk].inm_kwh += (r.consumoKwh || 0);
          }
        }
      });
    }
    return meses.map(m => ({ ...map[m], total_pago: map[m].alum_pago + map[m].inm_pago, total_kwh: map[m].alum_kwh + map[m].inm_kwh }));
  }, [rawData, todosLosSectores, anio]);

  const totalesGeneral = useMemo(() => {
    const sum = processedGeneral.reduce((acc, curr) => ({
      pago: acc.pago + curr.total_pago, kwh: acc.kwh + curr.total_kwh,
      alumKwh: acc.alumKwh + curr.alum_kwh, inmKwh: acc.inmKwh + curr.inm_kwh,
      alumPago: acc.alumPago + curr.alum_pago, inmPago: acc.inmPago + curr.inm_pago
    }), { pago: 0, kwh: 0, alumKwh: 0, inmKwh: 0, alumPago: 0, inmPago: 0 });
    return { ...sum, costoUnitario: sum.kwh > 0 ? sum.pago / sum.kwh : 0 };
  }, [processedGeneral]);

  const infoEspecifica = useMemo(() => {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dataAProcesar = seleccion ? seleccion.data : todosLosSectores;
    
    let tp = 0, tl = 0;
    const acumulado = meses.reduce((acc, m) => { acc[m] = { valor: 0, importe: 0 }; return acc; }, {});
    
    dataAProcesar.forEach(s => {
      tp += (s.luminarias || []).length;
      tl += (s.luminarias || []).reduce((a, c) => a + (c.luminariasPorPoste || 0), 0);
      
      (s.recibos || []).forEach(r => {
        if (parseInt(r.anio) === parseInt(anio)) {
          const mk = getMesKey(r.mes);
          if (mk && acumulado[mk]) { 
            acumulado[mk].valor += (r.consumoKwh || 0); 
            acumulado[mk].importe += (r.importe || 0);
          }
        }
      });
    });

    return {
      grafica: meses.map(m => ({ name: m, valor: acumulado[m].valor, importe: acumulado[m].importe })),
      postes: tp, 
      luminarias: tl, 
      numSectores: dataAProcesar.length,
      totalKwh: meses.reduce((s, m) => s + acumulado[m].valor, 0),
      totalImporte: meses.reduce((s, m) => s + acumulado[m].importe, 0),
      limiteMax: (seleccion && seleccion.tipo === 'Sector') ? seleccion.data[0].consumoMaximo : null
    };
  }, [seleccion, anio, todosLosSectores]);

  return (
    <div style={{ backgroundColor: COLORS.bg, height: '100vh', overflow: 'hidden', color: 'white', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box', fontFamily: 'system-ui' }}>
      
      {/* HEADER TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#0b0f19', padding: '3px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setView('general')} style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: view === 'general' ? COLORS.alumbrado : 'transparent', color: 'white', fontSize: '11px', fontWeight: 'bold' }}>PANORAMA GENERAL</button>
          <button onClick={() => setView('especifico')} style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: view === 'especifico' ? COLORS.alumbrado : 'transparent', color: 'white', fontSize: '11px', fontWeight: 'bold' }}>ANÁLISIS ESPECÍFICO</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0f19', padding: '4px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: '9px', color: COLORS.text, fontWeight: 'bold' }}>EJERCICIO</span>
          <select value={anio} onChange={(e) => setAnio(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '13px', fontWeight: '900', outline: 'none', cursor: 'pointer' }}>
            <option value="2024" style={{background: '#070a12'}}>2024</option>
            <option value="2025" style={{background: '#070a12'}}>2025</option>
            <option value="2026" style={{background: '#070a12'}}>2026</option>
          </select>
        </div>
      </div>

      {view === 'general' ? (
        <>
          {/* GRÁFICA 1: EVOLUCIÓN MENSUAL GENERAL */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '15px 20px', borderRadius: '15px', flex: 1.2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: COLORS.text, fontWeight: 'bold' }}>EVOLUCIÓN MENSUAL {anio}</span>
              <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                <div><div style={{ fontSize: '8px', color: COLORS.text }}>PROM. kWh</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: COLORS.costo }}>${totalesGeneral.costoUnitario.toFixed(2)}</div></div>
                <div><div style={{ fontSize: '8px', color: COLORS.alumbrado, fontWeight: 'bold' }}>CONSUMO</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: COLORS.alumbrado }}>{formatMK(totalesGeneral.kwh)} kWh</div></div>
                <div><div style={{ fontSize: '8px', color: COLORS.inmuebles, fontWeight: 'bold' }}>IMPORTE</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: COLORS.inmuebles }}>{formatCurrencyMK(totalesGeneral.pago)}</div></div>
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedGeneral}>
                  <defs>
                    <linearGradient id="gradEvolucionAmarillo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.inmuebles} stopOpacity={0.30}/>
                      <stop offset="95%" stopColor={COLORS.inmuebles} stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tick={{fill: COLORS.text, fontSize: 10}} />
                  <YAxis yAxisId="left" axisLine={false} tick={{fill: COLORS.inmuebles, fontSize: 9}} tickCount={5} tickFormatter={formatCurrencyMK} width={55} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tick={{fill: COLORS.alumbrado, fontSize: 9}} tickCount={5} tickFormatter={formatMK} width={55} />
                  
                  <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
                  
                  <Area yAxisId="left" type="monotone" dataKey="total_pago" name="IMPORTES" fill="url(#gradEvolucionAmarillo)" stroke={COLORS.inmuebles} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="total_kwh" name="Consumo (kWh)" stroke={COLORS.alumbrado} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.alumbrado, stroke: '#020617', strokeWidth: 1 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1, minHeight: 0 }}>
            
            {/* GRÁFICA 2: DISTRIBUCIÓN DE CONSUMO */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '12px', borderRadius: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '5px', borderBottom: `1px solid ${COLORS.border}` }}>
                <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: COLORS.text }}> CONSUMO (kWh)</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '7px', color: COLORS.alumbrado, fontWeight: 'bold', display: 'block' }}>ALUMBRADO</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: COLORS.alumbrado }}>{formatMK(totalesGeneral.alumKwh)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '7px', color: COLORS.inmuebles, fontWeight: 'bold', display: 'block' }}>INMUEBLES</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: COLORS.inmuebles }}>{formatMK(totalesGeneral.inmKwh)}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedGeneral}>
                    <defs>
                      <linearGradient id="gradAlumbrado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.alumbrado} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={COLORS.alumbrado} stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="gradInmuebles" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.inmuebles} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={COLORS.inmuebles} stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 9}} />
                    <YAxis axisLine={false} tick={{fill: COLORS.text, fontSize: 9}} tickCount={4} tickFormatter={formatMK} width={45} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
                    
                    <Area type="linear" dataKey="inm_kwh" name="Inmuebles" stroke={COLORS.inmuebles} strokeWidth={2} fill="url(#gradInmuebles)" dot={{ r: 3, fill: COLORS.inmuebles }} />
                    <Area type="linear" dataKey="alum_kwh" name="Alumbrado" stroke={COLORS.alumbrado} strokeWidth={2} fill="url(#gradAlumbrado)" dot={{ r: 3, fill: COLORS.alumbrado }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICA 3: COMPARATIVA DE PAGOS */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '12px', borderRadius: '15px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '5px', borderBottom: `1px solid ${COLORS.border}` }}>
                <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: COLORS.text }}> PAGOS (MXN)</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '7px', color: COLORS.alumbrado, fontWeight: 'bold', display: 'block' }}>ALUMBRADO</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: COLORS.alumbrado }}>{formatCurrencyMK(totalesGeneral.alumPago)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '7px', color: COLORS.inmuebles, fontWeight: 'bold', display: 'block' }}>INMUEBLES</span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: COLORS.inmuebles }}>{formatCurrencyMK(totalesGeneral.inmPago)}</span>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedGeneral} margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 9}} />
                    <YAxis axisLine={false} tick={{fill: COLORS.text, fontSize: 9}} tickCount={4} tickFormatter={formatCurrencyMK} width={50} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
                    
                    <Bar dataKey="alum_pago" name="Alumbrado" fill={COLORS.alumbrado} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="inm_pago" name="Inmuebles" fill={COLORS.inmuebles} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      ) : (
        <>
          {/* VISTA ANÁLISIS ESPECÍFICO */}
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="🔍 Buscar por RPU o nombre de colonia..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: '#0b0f19', color: 'white', fontSize: '13px', outline: 'none' }} />
            {listaSugerencias.length > 0 && (
              <div style={{ position: 'absolute', top: '50px', width: '100%', background: '#070a12', borderRadius: '12px', zIndex: 100, border: `1px solid ${COLORS.border}`, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.8)' }}>
                {listaSugerencias.map((sug, i) => (
                  <div key={i} onClick={() => { setSeleccion(sug); setBusqueda(sug.nombre); setListaSugerencias([]); }} 
                       style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: i === listaSugerencias.length -1 ? 'none' : `1px solid ${COLORS.border}`, fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: COLORS.alumbrado }}>{sug.nombre}</span> <span style={{fontSize: '10px', color: COLORS.text, marginLeft: '5px'}}>— {sug.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'SECTORES', val: infoEspecifica.numSectores, col: 'white' },
              { label: 'INFRAESTRUCTURA', val: formatNumber(infoEspecifica.postes) + " Postes", col: 'white' },
              { label: 'LUMINARIAS', val: formatNumber(infoEspecifica.luminarias), col: COLORS.alumbrado },
              { label: 'CONS. ANUAL', val: formatMK(infoEspecifica.totalKwh) + " kWh", col: 'white' },
              { label: 'INV. ANUAL', val: formatCurrencyMK(infoEspecifica.totalImporte), col: COLORS.inmuebles }
            ].map((item, idx) => (
              <div key={idx} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ fontSize: 8, color: COLORS.text, margin: '0 0 3px 0', fontWeight: 'bold' }}>{item.label}</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: item.col, margin: 0 }}>{item.val}</p>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '15px', borderRadius: '15px', flex: 1 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', color: COLORS.text, fontWeight: 'bold' }}>⚡ CONSUMO (kWh)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={infoEspecifica.grafica}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 9}} />
                  <YAxis tick={{fill: COLORS.text, fontSize: 9}} tickCount={4} tickFormatter={formatMK} width={45} />
                  <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
                  <Bar dataKey="valor" name="Consumo" radius={[4, 4, 0, 0]} barSize={35}>
                    {infoEspecifica.grafica.map((e, i) => (
                      <Cell key={i} fill={infoEspecifica.limiteMax && e.valor > infoEspecifica.limiteMax ? COLORS.alerta : COLORS.alumbrado} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '15px', borderRadius: '15px', flex: 1 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', color: COLORS.text, fontWeight: 'bold' }}>💰 PAGOS (MXN)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={infoEspecifica.grafica}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 9}} />
                  <YAxis tick={{fill: COLORS.text, fontSize: 9}} tickCount={4} tickFormatter={formatCurrencyMK} width={50} />
                  <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
                  <Area type="monotone" dataKey="importe" name="Pago" stroke={COLORS.inmuebles} fill={COLORS.inmuebles} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;