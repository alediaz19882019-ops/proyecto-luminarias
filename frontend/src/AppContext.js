import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'https://proy-alumbrado.duckdns.org/graphql';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [dashboardData, setDashboardData] = useState([]); 
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false); 
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

  const cargarSectoresGlobal = useCallback((forzarRecarga = false) => {
    if (!forzarRecarga && todosLosSectores.length > 0) return;
    if (fetchingRef.current && !forzarRecarga) return;

    fetchingRef.current = true;
    setLoadingGlobal(true);

    const query = `{ 
      sectoresMapa { 
        id 
        clave 
        clasificacion 
        latitud 
        longitud 
        consumoMaximo 
        nombreColonia 
        ultimoConsumo 
      } 
    }`;

    apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ query })
    })
      .then(async data => {
        if (data && data.data?.sectoresMapa) {
          setTodosLosSectores(data.data.sectoresMapa);
        }
        fetchingRef.current = false;
        setLoadingGlobal(false);
      })
      .catch(err => {
        fetchingRef.current = false;
        setLoadingGlobal(false);
        console.error("Error cargando sectores del mapa:", err);
      });
  }, [todosLosSectores.length, apiFetch]);

  // CORREGIDO: Se permite la consulta al cambiar de año sin bloqueos por longitud previa
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
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);