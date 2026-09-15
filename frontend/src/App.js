import React, { useState } from 'react';
import { AppProvider } from './AppContext'; // Proveedor Global
import MapaBase from './MapaBase';
import Manager from './Manager';
import Censo from './Censo'; 
import Home from './Home';
import Dashboard from './Dashboard';
import 'leaflet/dist/leaflet.css'; 

const COLORS = { 
  primary: '#be185d', 
  accent: '#f99c1b', 
  bg: '#fff1f2' 
};

const MainApp = () => {
  const [tab, setTab] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTab('home');
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      display: 'flex', 
      flexDirection: 'column', 
      background: COLORS.bg, 
      overflow: 'hidden', 
      fontFamily: 'Inter, sans-serif' 
    }}>
      
      {/* Barra de navegación superior (Solo aparece al entrar al sistema) */}
      {tab !== 'home' && isLoggedIn && (
        <nav style={{ 
          background: COLORS.primary, 
          padding: '12px 30px', 
          color: 'white', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          zIndex: 1010, 
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
        }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, letterSpacing: '1px' }}>
            SMART  <span style={{color: COLORS.accent}}> PLAYA </span>
          </h2>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {[
              { id: 'mapaBase', label: 'MAPA' },
              { id: 'dashboard', label: 'DASHBOARD' },
              { id: 'censo', label: 'CENSO' },
              { id: 'manager', label: 'MANAGER' },
             ].map(t => (
              <span 
                key={t.id} 
                onClick={() => setTab(t.id)} 
                style={{ 
                  cursor: 'pointer', 
                  fontWeight: 800, 
                  fontSize: '10px', 
                  borderBottom: tab === t.id ? '2px solid white' : '2px solid transparent', 
                  paddingBottom: '4px', 
                  transition: '0.3s', 
                  opacity: tab === t.id ? 1 : 0.8 
                }}
              >
                {t.label}
              </span>
            ))}

            {/* Icono de Salir Elegante */}
            <button 
              onClick={handleLogout} 
              title="Cerrar sesión / Volver al inicio"
              style={{ 
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
                transition: '0.2s',
                color: 'white'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </nav>
      )}

      <div style={{ 
        flex: 1, 
        position: 'relative', 
        width: '100%',
        height: '100%',
        overflowY: (tab === 'dashboard' || tab === 'manager' || tab === 'censo') ? 'auto' : 'hidden' 
      }}>
      
        {/* Pantalla Home limpia que al tocarla pasa directo al Mapa y activa la tarjeta de carga de Netflix en el Mapa Base */}
        {tab === 'home' && (
          <Home onLogoClick={() => { 
            setIsLoggedIn(true); 
            setTab('mapaBase'); 
          }} />
        )}
        
        {/* Pestañas protegidas del sistema */}
        {isLoggedIn && tab !== 'home' ? (
          <>
            {tab === 'mapaBase' && <MapaBase />}
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'censo' && <Censo />}
            {tab === 'manager' && <Manager />}
          </>
        ) : null}
      </div>
    </div>
  );
};

// Envolvemos la aplicación principal con el AppProvider
const App = () => {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
};

export default App;