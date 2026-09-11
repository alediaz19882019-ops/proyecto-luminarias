import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const fetchingRef = useRef(false);

  // Función para limpiar credenciales y redirigir al login si expira la sesión
  const forzarReLogin = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken(null);
    window.location.href = '/login';
  }, []);

  // Función centralizada de API Fetch con interceptor de Unauthorized
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

      // Detectar si el servidor rechaza por falta de autenticación
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
      todosLosSectores { 
        id clave clasificacion latitud longitud consumoIdeal consumoAceptable consumoMaximo nombreColonia medidor cuenta carga cpd tarifa 
        recibos { id anio mes consumoKwh importe lecturaAnterior lecturaActual notasObservaciones } 
        luminarias { id latitud longitud luminariasPorPoste cantidadPostes tipoLampara capacidad descripcion } 
      } 
    }`;

    apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ query })
    })
      .then(data => {
        fetchingRef.current = false;
        setLoadingGlobal(false);
        if (data && data.data?.todosLosSectores) {
          const listaMapeada = data.data.todosLosSectores.map(sec => ({
            ...sec,
            luminarias: sec.luminarias?.map(lum => ({ 
              ...lum, 
              estadoAuditoria: lum.estadoAuditoria || 'pendiente',
              observacion: lum.observacion || ''
            })) || []
          }));
          setTodosLosSectores(listaMapeada);
        }
      })
      .catch(err => {
        fetchingRef.current = false;
        setLoadingGlobal(false);
        console.error("Error cargando datos globales:", err);
      });
  }, [todosLosSectores.length, apiFetch]);

  return (
    <AppContext.Provider value={{ todosLosSectores, cargarSectoresGlobal, loadingGlobal, setTodosLosSectores, token, setToken, apiFetch, forzarReLogin }}> 
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);