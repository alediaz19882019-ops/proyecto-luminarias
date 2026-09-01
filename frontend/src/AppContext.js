import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [todosLosSectores, setTodosLosSectores] = useState([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const fetchingRef = useRef(false);

  const cargarSectoresGlobal = useCallback((forzarRecarga = false) => {
    // Si ya existen datos cargados y no se fuerza, evita repetir el fetch
    if (!forzarRecarga && todosLosSectores.length > 0) return;
    
    // Bloquea peticiones duplicadas simultáneas
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

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
      .then(res => res.json())
      .then(data => {
        fetchingRef.current = false;
        setLoadingGlobal(false);
        if (data.data?.todosLosSectores) {
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
  }, [todosLosSectores.length]);

  return (
    <AppContext.Provider value={{ todosLosSectores, cargarSectoresGlobal, loadingGlobal, setTodosLosSectores }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);