import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ComposedChart, Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COLORS = {
  alumbrado: '#eab308',       // Amarillo/ámbar para alumbrado
  inmuebles: '#10b981',       // Verde para inmuebles
  costo: '#eab308',           // Amarillo para gastos / importes generales
  consumoMadre: '#10b981',    // Verde para consumo general en gráfica madre
  alerta: '#ef4444', 
  aceptable: '#f59e0b', 
  bg: '#020617',          
  card: 'transparent', 
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#64748b', 
  white: '#ffffff',
  luzTooltip: '#38bdf8'       
};

// --- MEMORIA GLOBAL EN RAM Y CACHÉ DE SESIÓN ---
let memoriaGlobalDashboard = null;

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

// --- TOOLTIP PERSONALIZADO ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        pointerEvents: 'none', 
        padding: '8px 12px', 
        background: 'rgba(15, 23, 42, 0.95)', 
        borderRadius: '8px', 
        border: '1px solid rgba(56, 189, 248, 0.4)', 
        boxShadow: '0 8px 20px rgba(0,0,0,0.9)',
        backdropFilter: 'blur(6px)'
      }}>
        {label && (
          <p style={{ 
            margin: '0 0 4px 0', 
            fontSize: '11px', 
            fontWeight: '900', 
            textTransform: 'uppercase', 
            color: COLORS.luzTooltip,
            letterSpacing: '0.05em'
          }}>
            {label}
          </p>
        )}
        {payload.map((entry, index) => {
          const nameLower = entry.name.toLowerCase();
          let colorPunto = COLORS.alumbrado;
          if (nameLower.includes('consumo') || nameLower.includes('kwh') || nameLower.includes('inmuebles')) {
            colorPunto = COLORS.inmuebles;
          }

          return (
            <div key={index} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              margin: '3px 0', 
              color: COLORS.luzTooltip
            }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: colorPunto, 
                boxShadow: `0 0 6px ${colorPunto}` 
              }}></span>
              <span style={{ color: COLORS.luzTooltip }}>{entry.name}:</span>
              <span style={{ fontWeight: '900', color: COLORS.luzTooltip }}>
                {nameLower.includes('consumo') || nameLower.includes('kwh') 
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
  const [rangoTiempo, setRangoTiempo] = useState("anual"); 
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [seleccion, setSeleccion] = useState(null); 
  const [busqueda, setBusqueda] = useState("");
  const [listaSugerencias, setListaSugerencias] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [loading, setLoading] = useState(false);

  const dashboardRef = useRef(null);

  const exportarPDF = async () => {
    if (!dashboardRef.current) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        backgroundColor: COLORS.bg,
        useCORS: true,
        scrollX: 0,
        scrollY: 0
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_Dashboard_${anio}.pdf`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
    } finally {
      setExportando(false);
    }
  };

  const getMesKey = (m) => {
    if (!m) return null;
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    let val = m.toString().trim().toUpperCase();
    if (!isNaN(val)) return meses[parseInt(val) - 1];
    return meses.find(n => val.startsWith(n.toUpperCase())) || null;
  };

  // --- CARGA DE DATOS OPTIMIZADA CON RAM Y SESIÓN ---
  const fetchData = useCallback(async (forzarRecarga = false) => {
    const cacheKey = `cache_dashboard_${anio}`;

    if (!forzarRecarga && memoriaGlobalDashboard) {
      setTodosLosSectores(memoriaGlobalDashboard);
      setLoading(false);
      return;
    }

    const datosGuardados = sessionStorage.getItem(cacheKey);
    if (!forzarRecarga && datosGuardados) {
      const parsedData = JSON.parse(datosGuardados);
      memoriaGlobalDashboard = parsedData;
      setTodosLosSectores(parsedData);
      setLoading(false);
      return;
    }

    setLoading(true);
    const query = `query { 
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
        body: JSON.stringify({ query }),
      });

      const result = await res.json();
      const newSectores = result.data?.todosLosSectores || [];
      
      memoriaGlobalDashboard = newSectores;
      setTodosLosSectores(newSectores);
      sessionStorage.setItem(cacheKey, JSON.stringify(newSectores));
    } catch (err) { 
      console.error("Error al cargar dashboard:", err); 
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    if (busqueda.length < 2) { setListaSugerencias([]); return; }
    const term = busqueda.toLowerCase();
    const listado = [];
    const coloniasVistas = new Set();

    const sectoresArray = Array.isArray(todosLosSectores) ? todosLosSectores : [];

    sectoresArray.forEach(s => {
      const col = s.nombreColonia?.toUpperCase() || "";
      const clave = s.clave?.toUpperCase() || "";
      if (col.toLowerCase().includes(term) && !coloniasVistas.has(col)) {
        coloniasVistas.add(col);
        listado.push({ tipo: 'Colonia', nombre: col, data: sectoresArray.filter(sect => sect.nombreColonia === s.nombreColonia) });
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
    meses.forEach(m => map[m] = { name: m, alum_pago: 0, inm_pago: 0, alum_kwh: 0, inm_kwh: 0, tieneDatos: false });
    
    const sectoresArray = Array.isArray(todosLosSectores) ? todosLosSectores : [];

    sectoresArray.forEach(s => {
      const esInmueble = s.clasificacion?.toUpperCase().includes("INMUEBLE");
      (s.recibos || []).forEach(r => {
        if (parseInt(r.anio) === parseInt(anio)) {
          const mk = getMesKey(r.mes);
          if (mk && map[mk]) {
            if (esInmueble) { 
              map[mk].inm_pago += (r.importe || 0); 
              map[mk].inm_kwh += (r.consumoKwh || 0); 
            } else { 
              map[mk].alum_pago += (r.importe || 0); 
              map[mk].alum_kwh += (r.consumoKwh || 0); 
            }
            if ((r.importe || 0) > 0 || (r.consumoKwh || 0) > 0) {
              map[mk].tieneDatos = true;
            }
          }
        }
      });
    });

    let resultado = meses.map(m => ({ 
      ...map[m], 
      total_pago: map[m].alum_pago + map[m].inm_pago, 
      total_kwh: map[m].alum_kwh + map[m].inm_kwh 
    }));

    resultado = resultado.filter(item => item.tieneDatos);

    if (rangoTiempo === 'sem1') {
      resultado = resultado.slice(0, 6);
    } else if (rangoTiempo === 'trim1') {
      resultado = resultado.slice(0, 3);
    }

    return resultado;
  }, [todosLosSectores, anio, rangoTiempo]);

  const kpiVariacion = useMemo(() => {
    if (processedGeneral.length < 2) return { general: { porcentaje: 0, esAumento: true } };
    const ultimo = processedGeneral[processedGeneral.length - 1];
    const anterior = processedGeneral[processedGeneral.length - 2];
    
    const calcDiff = (curr, prev) => {
      if (prev === 0) return { porcentaje: 0, esAumento: true };
      const diff = ((curr - prev) / prev) * 100;
      return { porcentaje: Math.abs(diff).toFixed(1), esAumento: diff >= 0 };
    };

    return { general: calcDiff(ultimo.total_pago, anterior.total_pago) };
  }, [processedGeneral]);

  const kpiVariacionPagos = useMemo(() => {
    if (processedGeneral.length < 2) return { alumbrado: { porcentaje: 0, esAumento: true }, inmuebles: { porcentaje: 0, esAumento: true } };
    const ultimo = processedGeneral[processedGeneral.length - 1];
    const anterior = processedGeneral[processedGeneral.length - 2];

    const calcDiff = (curr, prev) => {
      if (prev === 0) return { porcentaje: 0, esAumento: true };
      const diff = ((curr - prev) / prev) * 100;
      return { porcentaje: Math.abs(diff).toFixed(1), esAumento: diff >= 0 };
    };

    return {
      alumbrado: calcDiff(ultimo.alum_pago, anterior.alum_pago),
      inmuebles: calcDiff(ultimo.inm_pago, anterior.inm_pago)
    };
  }, [processedGeneral]);

  const kpiVariacionConsumos = useMemo(() => {
    if (processedGeneral.length < 2) return { alumbrado: { porcentaje: 0, esAumento: true }, inmuebles: { porcentaje: 0, esAumento: true } };
    const ultimo = processedGeneral[processedGeneral.length - 1];
    const anterior = processedGeneral[processedGeneral.length - 2];

    const calcDiff = (curr, prev) => {
      if (prev === 0) return { porcentaje: 0, esAumento: true };
      const diff = ((curr - prev) / prev) * 100;
      return { porcentaje: Math.abs(diff).toFixed(1), esAumento: diff >= 0 };
    };

    return {
      alumbrado: calcDiff(ultimo.alum_kwh, anterior.alum_kwh),
      inmuebles: calcDiff(ultimo.inm_kwh, anterior.inm_kwh)
    };
  }, [processedGeneral]);

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
    const sectoresArray = Array.isArray(todosLosSectores) ? todosLosSectores : [];
    const dataAProcesar = seleccion ? seleccion.data : sectoresArray;
    
    let tp = 0, tl = 0;
    const acumulado = meses.reduce((acc, m) => { acc[m] = { valor: 0, importe: 0, tieneDatos: false }; return acc; }, {});
    
    const seguroProcesar = Array.isArray(dataAProcesar) ? dataAProcesar : [];

    seguroProcesar.forEach(s => {
      tp += (s.luminarias || []).length;
      tl += (s.luminarias || []).reduce((a, c) => a + (c.luminariasPorPoste || 0), 0);
      
      (s.recibos || []).forEach(r => {
        if (parseInt(r.anio) === parseInt(anio)) {
          const mk = getMesKey(r.mes);
          if (mk && acumulado[mk]) { 
            acumulado[mk].valor += (r.consumoKwh || 0); 
            acumulado[mk].importe += (r.importe || 0);
            if ((r.consumoKwh || 0) > 0 || (r.importe || 0) > 0) acumulado[mk].tieneDatos = true;
          }
        }
      });
    });

    let listaMeses = meses.map(m => ({ name: m, valor: acumulado[m].valor, importe: acumulado[m].importe, tieneDatos: acumulado[m].tieneDatos }));
    listaMeses = listaMeses.filter(item => item.tieneDatos);

    if (rangoTiempo === 'sem1') listaMeses = listaMeses.slice(0, 6);
    if (rangoTiempo === 'trim1') listaMeses = listaMeses.slice(0, 3);

    return {
      grafica: listaMeses,
      postes: tp, 
      luminarias: tl, 
      numSectores: dataAProcesar.length,
      totalKwh: listaMeses.reduce((s, m) => s + m.valor, 0),
      totalImporte: listaMeses.reduce((s, m) => s + m.importe, 0),
      limiteMax: (seleccion && seleccion.tipo === 'Sector') ? seleccion.data[0].consumoMaximo : null
    };
  }, [seleccion, anio, todosLosSectores, rangoTiempo]);

  return (
    <div ref={dashboardRef} style={{ 
      backgroundColor: COLORS.bg, 
      width: '100vw', 
      height: 'calc(100vh - 45px)', 
      maxHeight: 'calc(100vh - 45px)', 
      overflow: 'hidden', 
      color: 'white', 
      padding: '6px 16px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px', 
      boxSizing: 'border-box', 
      fontFamily: 'system-ui',
      position: 'fixed',
      top: '45px',
      left: 0,
      margin: 0,
      zIndex: 10
    }}>
      
      {/* HEADER TABS & CONTROLES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: '#0b0f19', padding: '2px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setView('general')} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'general' ? COLORS.costo : 'transparent', color: view === 'general' ? '#000' : 'white', fontSize: '11px', fontWeight: 'bold' }}>PANORAMA GENERAL</button>
          <button onClick={() => setView('especifico')} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'especifico' ? COLORS.costo : 'transparent', color: view === 'especifico' ? '#000' : 'white', fontSize: '11px', fontWeight: 'bold' }}>ANÁLISIS ESPECÍFICO</button>
        </div>

        <div style={{ display: 'flex', background: '#0b0f19', padding: '2px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setRangoTiempo('trim1')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: rangoTiempo === 'trim1' ? '#334155' : 'transparent', color: rangoTiempo === 'trim1' ? '#38bdf8' : COLORS.text, fontSize: '10px', fontWeight: 'bold' }}>1er Trim</button>
          <button onClick={() => setRangoTiempo('sem1')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: rangoTiempo === 'sem1' ? '#334155' : 'transparent', color: rangoTiempo === 'sem1' ? '#38bdf8' : COLORS.text, fontSize: '10px', fontWeight: 'bold' }}>1er Semestre</button>
          <button onClick={() => setRangoTiempo('anual')} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: rangoTiempo === 'anual' ? '#334155' : 'transparent', color: rangoTiempo === 'anual' ? '#38bdf8' : COLORS.text, fontSize: '10px', fontWeight: 'bold' }}>Año Completo</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => {
            memoriaGlobalDashboard = null;
            sessionStorage.removeItem(`cache_dashboard_${anio}`);
            fetchData(true);
          }} disabled={loading} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          <button onClick={exportarPDF} disabled={exportando} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
            <span></span> {exportando ? 'Generando PDF...' : 'Descargar PDF'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0f19', padding: '3px 10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: '9px', color: COLORS.text, fontWeight: 'bold' }}>EJERCICIO</span>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '12px', fontWeight: '900', outline: 'none', cursor: 'pointer' }}>
              <option value="2024" style={{background: '#070a12'}}>2024</option>
              <option value="2025" style={{background: '#070a12'}}>2025</option>
              <option value="2026" style={{background: '#070a12'}}>2026</option>
            </select>
          </div>
        </div>
      </div>

      {view === 'general' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '4px' }}>
          {/* GRÁFICA 1 */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '8px 14px', borderRadius: '12px', flex: 1.2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', flexShrink: 0, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: COLORS.text, fontWeight: 'bold' }}>EVOLUCIÓN MENSUAL {anio}</span>
                <span style={{ 
                  fontSize: '9px', 
                  background: kpiVariacion.general.esAumento ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                  color: kpiVariacion.general.esAumento ? '#ef4444' : '#10b981', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 'bold', 
                  border: `1px solid ${kpiVariacion.general.esAumento ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` 
                }}>
                  {kpiVariacion.general.esAumento ? '▲' : '▼'} {kpiVariacion.general.porcentaje}% vs mes ant.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                <div><div style={{ fontSize: '7px', color: COLORS.text }}>PROM. kWh</div><div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.costo }}>${totalesGeneral.costoUnitario.toFixed(2)}</div></div>
                <div><div style={{ fontSize: '7px', color: COLORS.consumoMadre, fontWeight: 'bold' }}>CONSUMO</div><div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.consumoMadre }}>{formatMK(totalesGeneral.kwh)} kWh</div></div>
                <div><div style={{ fontSize: '7px', color: COLORS.costo, fontWeight: 'bold' }}>IMPORTE</div><div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.costo }}>{formatCurrencyMK(totalesGeneral.pago)}</div></div>
              </div>
            </div>
            
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedGeneral} margin={{ top: 4, right: 4, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEvolucionImportes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.costo} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={COLORS.costo} stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="gradConsumoMadre" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.consumoMadre} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={COLORS.consumoMadre} stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tick={{fill: COLORS.text, fontSize: 9}} />
                  <YAxis yAxisId="left" axisLine={false} tick={{fill: COLORS.costo, fontSize: 8}} tickCount={4} tickFormatter={formatCurrencyMK} width={55} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tick={{fill: COLORS.consumoMadre, fontSize: 8}} tickCount={4} tickFormatter={formatMK} width={45} />
                  
                  <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 999 }} />
                  
                  <Area yAxisId="left" type="monotone" dataKey="total_pago" name="IMPORTES" fill="url(#gradEvolucionImportes)" stroke={COLORS.costo} strokeWidth={3} dot={{ r: 3, fill: COLORS.costo }} activeDot={{ r: 6.5, fill: COLORS.costo, stroke: '#fff', strokeWidth: 2 }} />
                  <Area yAxisId="right" type="monotone" dataKey="total_kwh" name="Consumo (kWh)" stroke={COLORS.consumoMadre} fill="url(#gradConsumoMadre)" fillOpacity={1} strokeWidth={3} dot={{ r: 3.5, fill: COLORS.consumoMadre }} activeDot={{ r: 6.5, fill: COLORS.consumoMadre, stroke: '#fff', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1, minHeight: 0 }}>
            {/* GRÁFICA 2: DISTRIBUCIÓN DE CONSUMO */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '8px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', paddingBottom: '2px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: COLORS.text }}> CONSUMO (kWh)</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '8px', background: kpiVariacionConsumos.inmuebles.esAumento ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: kpiVariacionConsumos.inmuebles.esAumento ? '#ef4444' : '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                    Inm: {kpiVariacionConsumos.inmuebles.esAumento ? '▲' : '▼'} {kpiVariacionConsumos.inmuebles.porcentaje}%
                  </span>
                  <span style={{ fontSize: '8px', background: kpiVariacionConsumos.alumbrado.esAumento ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: kpiVariacionConsumos.alumbrado.esAumento ? '#ef4444' : '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                    Alum: {kpiVariacionConsumos.alumbrado.esAumento ? '▲' : '▼'} {kpiVariacionConsumos.alumbrado.porcentaje}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '6px', color: COLORS.alumbrado, fontWeight: 'bold', display: 'block' }}>ALUMBRADO</span>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: COLORS.alumbrado }}>{formatMK(totalesGeneral.alumKwh)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '6px', color: COLORS.inmuebles, fontWeight: 'bold', display: 'block' }}>INMUEBLES</span>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: COLORS.inmuebles }}>{formatMK(totalesGeneral.inmKwh)}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedGeneral} margin={{ top: 4, right: 4, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAlumbradoLuz" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.alumbrado} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={COLORS.alumbrado} stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="gradInmuebles" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.inmuebles} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={COLORS.inmuebles} stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 8}} />
                    <YAxis axisLine={false} tick={{fill: COLORS.text, fontSize: 8}} tickCount={3} tickFormatter={formatMK} width={45} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 999 }} />
                    
                    <Area type="linear" dataKey="inm_kwh" name="Inmuebles" stroke={COLORS.inmuebles} strokeWidth={2.5} fill="url(#gradInmuebles)" dot={{ r: 2.5, fill: COLORS.inmuebles }} activeDot={{ r: 5, fill: COLORS.inmuebles, stroke: '#fff', strokeWidth: 2 }} />
                    <Area type="linear" dataKey="alum_kwh" name="Alumbrado" stroke={COLORS.alumbrado} strokeWidth={2.5} fill="url(#gradAlumbradoLuz)" dot={{ r: 2.5, fill: COLORS.alumbrado }} activeDot={{ r: 5, fill: COLORS.alumbrado, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICA 3: PAGOS */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '8px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', paddingBottom: '2px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', color: COLORS.text }}> PAGOS (MXN)</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '8px', background: kpiVariacionPagos.inmuebles.esAumento ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: kpiVariacionPagos.inmuebles.esAumento ? '#ef4444' : '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                    Inm: {kpiVariacionPagos.inmuebles.esAumento ? '▲' : '▼'} {kpiVariacionPagos.inmuebles.porcentaje}%
                  </span>
                  <span style={{ fontSize: '8px', background: kpiVariacionPagos.alumbrado.esAumento ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: kpiVariacionPagos.alumbrado.esAumento ? '#ef4444' : '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                    Alum: {kpiVariacionPagos.alumbrado.esAumento ? '▲' : '▼'} {kpiVariacionPagos.alumbrado.porcentaje}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '6px', color: COLORS.alumbrado, fontWeight: 'bold', display: 'block' }}>ALUMBRADO</span>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: COLORS.alumbrado }}>{formatCurrencyMK(totalesGeneral.alumPago)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '6px', color: COLORS.inmuebles, fontWeight: 'bold', display: 'block' }}>INMUEBLES</span>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: COLORS.inmuebles }}>{formatCurrencyMK(totalesGeneral.inmPago)}</span>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedGeneral} margin={{ top: 4, right: 4, left: 5, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 8}} />
                    <YAxis axisLine={false} tick={{fill: COLORS.text, fontSize: 8}} tickCount={3} tickFormatter={formatCurrencyMK} width={50} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 999 }} />
                    
                    <Bar dataKey="alum_pago" name="Alumbrado" fill={COLORS.alumbrado} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="inm_pago" name="Inmuebles" fill={COLORS.inmuebles} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '4px' }}>
          {/* VISTA ANÁLISIS ESPECÍFICO */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input type="text" placeholder="🔍 Buscar por RPU o nombre de colonia..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: '#0b0f19', color: 'white', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            {listaSugerencias.length > 0 && (
              <div style={{ position: 'absolute', top: '38px', width: '100%', background: '#070a12', borderRadius: '10px', zIndex: 100, border: `1px solid ${COLORS.border}`, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.8)' }}>
                {listaSugerencias.map((sug, i) => (
                  <div key={i} onClick={() => { setSeleccion(sug); setBusqueda(sug.nombre); setListaSugerencias([]); }} 
                       style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i === listaSugerencias.length -1 ? 'none' : `1px solid ${COLORS.border}`, fontSize: '11px' }}>
                    <span style={{ fontWeight: 'bold', color: COLORS.alumbrado }}>{sug.nombre}</span> <span style={{fontSize: '9px', color: COLORS.text, marginLeft: '5px'}}>— {sug.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', flexShrink: 0 }}>
            {[
              { label: 'SECTORES', val: infoEspecifica.numSectores, col: 'white' },
              { label: 'INFRAESTRUCTURA', val: formatNumber(infoEspecifica.postes) + " Postes", col: 'white' },
              { label: 'LUMINARIAS', val: formatNumber(infoEspecifica.luminarias), col: COLORS.alumbrado },
              { label: 'CONS. PERÍODO', val: formatMK(infoEspecifica.totalKwh) + " kWh", col: COLORS.inmuebles },
              { label: 'INV. PERÍODO', val: formatCurrencyMK(infoEspecifica.totalImporte), col: COLORS.alumbrado }
            ].map((item, idx) => (
              <div key={idx} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '6px 4px', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: 7, color: COLORS.text, margin: '0 0 1px 0', fontWeight: 'bold' }}>{item.label}</p>
                <p style={{ fontSize: 12, fontWeight: 900, color: item.col, margin: 0 }}>{item.val}</p>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minHeight: 0 }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '8px 12px', borderRadius: '12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '10px', color: COLORS.text, fontWeight: 'bold', flexShrink: 0 }}>⚡ CONSUMO (kWh)</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={infoEspecifica.grafica} margin={{ top: 4, right: 4, left: 5, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 8}} />
                    <YAxis tick={{fill: COLORS.text, fontSize: 8}} tickCount={3} tickFormatter={formatMK} width={45} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 999 }} />
                    <Bar dataKey="valor" name="Consumo" radius={[3, 3, 0, 0]} barSize={25}>
                      {infoEspecifica.grafica.map((e, i) => (
                        <Cell key={i} fill={infoEspecifica.limiteMax && e.valor > infoEspecifica.limiteMax ? COLORS.alerta : COLORS.inmuebles} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '8px 12px', borderRadius: '12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '10px', color: COLORS.text, fontWeight: 'bold', flexShrink: 0 }}>💰 PAGOS (MXN)</h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={infoEspecifica.grafica} margin={{ top: 4, right: 4, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradImporte" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.alumbrado} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={COLORS.alumbrado} stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{fill: COLORS.text, fontSize: 8}} />
                    <YAxis tick={{fill: COLORS.text, fontSize: 8}} tickCount={3} tickFormatter={formatCurrencyMK} width={50} />
                    <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 999 }} />
                    <Area type="monotone" dataKey="importe" name="Pago" stroke={COLORS.alumbrado} fill="url(#gradImporte)" fillOpacity={1} strokeWidth={2.5} dot={{ r: 2.5, fill: COLORS.alumbrado }} activeDot={{ r: 5, fill: COLORS.alumbrado, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;