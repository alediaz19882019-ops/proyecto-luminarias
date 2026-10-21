import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'https://proy-alumbrado.duckdns.org/graphql';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [dashboardData, setDashboardData] = useState([]); 
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false); 
  const [porcentajeCarga, setPorcentajeCarga] = useState(0);
  const [mostrarPantallaCarga, setMostrarPantallaCarga] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const fetchingRef = useRef(false);

  const forzarReLogin = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken(null);
    window.location.href = '/login';
  }, []);

  const apiFetch = useCallback(async (url, options = {}) => {
    const currentToken = localStorage.getItem('token') || token;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (response.status === 401 || (data.errors && data.errors.some(err => err.message === 'Unable to authenticate you' || err.id === 'Unauthorized'))) {
        forzarReLogin();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error en la petición de red:', error);
      throw error;
    }
  }, [token, forzarReLogin]);

  // CARGA GLOBAL OPTIMIZADA CON LOADER ORBITAL 3D Y VELOCIDAD REAL
  const cargarSectoresGlobal = useCallback((forzarRecarga = false) => {
    if (!forzarRecarga && todosLosSectores.length > 0) return;
    if (fetchingRef.current && !forzarRecarga) return;

    fetchingRef.current = true;
    setLoadingGlobal(true);
    setMostrarPantallaCarga(true);
    setPorcentajeCarga(15);

    // Incremento dinámico de porcentaje mientras responde el servidor
    const intervaloProgreso = setInterval(() => {
      setPorcentajeCarga(prev => {
        if (prev >= 95) return 95;
        return prev + Math.floor(Math.random() * 8) + 2;
      });
    }, 200);

    const query = `{ 
      todosLosSectores { 
        id 
        clave 
        clasificacion 
        nombreColonia
        latitud 
        longitud 
        consumoIdeal
        consumoAceptable
        consumoMaximo 
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
        luminarias {
          id
          latitud
          longitud
          cantidadPostes
          luminariasPorPoste
          tipoLampara
          capacidad
        }
      } 
    }`;

    apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ query })
    })
      .then(async data => {
        clearInterval(intervaloProgreso);
        setPorcentajeCarga(100);
        
        if (data && data.data?.todosLosSectores) {
          setTodosLosSectores(data.data.todosLosSectores);
        }
        
        fetchingRef.current = false;
        setLoadingGlobal(false);

        // Transición suave al terminar
        setTimeout(() => {
          setMostrarPantallaCarga(false);
        }, 350);
      })
      .catch(err => {
        clearInterval(intervaloProgreso);
        fetchingRef.current = false;
        setLoadingGlobal(false);
        setMostrarPantallaCarga(false);
        console.error("Error cargando todos los sectores con luminarias y recibos:", err);
      });
  }, [todosLosSectores.length, apiFetch]);

  const cargarDashboardResumen = useCallback(async (anioConsulta = 2026, forzar = false) => {
    setLoadingDashboard(true);

    const query = `query {
      dashboardResumen(anio: ${anioConsulta}) {
        mes
        anio
        alumPago
        inmPago
        alumKwh
        inmKwh
      }
    }`;

    try {
      const data = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ query })
      });
      if (data && data.data?.dashboardResumen) {
        setDashboardData(data.data.dashboardResumen);
      } else {
        setDashboardData([]);
      }
    } catch (err) {
      console.error("Error al cargar el resumen del dashboard:", err);
      setDashboardData([]);
    } finally {
      setLoadingDashboard(false);
    }
  }, [apiFetch]);

  const obtenerSectorCompleto = useCallback(async (id) => {
    const query = `query {
      sectorPorId(id: ${id}) {
        id clave clasificacion nombreColonia latitud longitud 
        consumoIdeal consumoAceptable consumoMaximo medidor cuenta carga cpd tarifa
        recibos { id anio mes consumoKwh importe lecturaAnterior lecturaActual notasObservaciones }
        luminarias { id latitud longitud luminariasPorPoste cantidadPostes tipoLampara capacidad descripcion }
      }
    }`;

    try {
      const data = await apiFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ query })
      });
      if (data && data.data?.sectorPorId) {
        return data.data.sectorPorId;
      }
      return null;
    } catch (err) {
      console.error("Error obteniendo sector completo:", err);
      return null;
    }
  }, [apiFetch]);

  return (
    <AppContext.Provider value={{ 
      todosLosSectores, 
      cargarSectoresGlobal, 
      dashboardData, 
      cargarDashboardResumen, 
      obtenerSectorCompleto, 
      loadingGlobal, 
      loadingDashboard,
      setTodosLosSectores, 
      token, 
      setToken, 
      apiFetch, 
      forzarReLogin 
    }}> 
      {children}

      {/* PANTALLA DE CARGA CON LOADER ORBITAL 3D Y PORCENTAJE */}
      {mostrarPantallaCarga && (
        <div className="fixed inset-0 z-[99999] bg-[#070b14]/95 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-500 font-sans">
          
          <style>{`
            #page {
              display: flex;
              justify-content: center;
              align-items: center;
              perspective: 1000px;
            }

            #container {
              display: flex;
              justify-content: center;
              align-items: center;
              position: relative;
              width: 240px;
              height: 240px;
            }

            .loader-content {
              position: absolute;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 10;
              text-align: center;
            }

            #ring {
              width: 220px;
              height: 220px;
              border: 1px solid transparent;
              border-radius: 50%;
              position: absolute;
            }

            #ring:nth-child(1) {
              border-bottom: 8px solid rgb(255, 141, 249);
              animation: rotate1 2s linear infinite;
            }

            @keyframes rotate1 {
              from { transform: rotateX(50deg) rotateZ(110deg); }
              to { transform: rotateX(50deg) rotateZ(470deg); }
            }

            #ring:nth-child(2) {
              border-bottom: 8px solid rgb(255,65,106);
              animation: rotate2 2s linear infinite;
            }

            @keyframes rotate2 {
              from { transform: rotateX(20deg) rotateY(50deg) rotateZ(20deg); }
              to { transform: rotateX(20deg) rotateY(50deg) rotateZ(380deg); }
            }

            #ring:nth-child(3) {
              border-bottom: 8px solid rgb(0,255,255);
              animation: rotate3 2s linear infinite;
            }

            @keyframes rotate3 {
              from { transform: rotateX(40deg) rotateY(130deg) rotateZ(450deg); }
              to { transform: rotateX(40deg) rotateY(130deg) rotateZ(90deg); }
            }

            #ring:nth-child(4) {
              border-bottom: 8px solid rgb(252, 183, 55);
              animation: rotate4 2s linear infinite;
            }

            @keyframes rotate4 {
              from { transform: rotateX(70deg) rotateZ(270deg); }
              to { transform: rotateX(70deg) rotateZ(630deg); }
            }
          `}</style>

          <div id="page">
            <div id="container">
              <div id="ring"></div>
              <div id="ring"></div>
              <div id="ring"></div>
              <div id="ring"></div>
              
              <div className="loader-content">
                <span className="text-white font-black text-2xl tracking-wider font-mono">
                  {porcentajeCarga}%
                </span>
                <span className="text-cyan-300 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Sincronizando
                </span>
              </div>
            </div>
          </div>

          <p className="text-slate-300 font-bold text-xs uppercase tracking-widest mt-8 animate-pulse">
            Red de Alumbrado Público
          </p>

        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);