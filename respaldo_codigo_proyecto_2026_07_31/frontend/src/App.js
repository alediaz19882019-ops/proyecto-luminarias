import React, { useState } from 'react';
import MapaBase from './MapaBase';
import Manager from './Manager';
import Login from './Login';
import Home from './Home';
import Dashboard from './Dashboard';
import 'leaflet/dist/leaflet.css'; 

const COLORS = { 
  primary: '#be185d', 
  accent: '#f99c1b', 
  bg: '#fff1f2' 
};

const App = () => {
  const [tab, setTab] = useState('home'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegisterMsg, setShowRegisterMsg] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);   
    setShowRegisterMsg(false);
    setTab('mapaBase');   // <--- Redirige directo al mapaBase al iniciar sesión
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowRegisterMsg(false);
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
      
      {/* Barra de navegación superior */}
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
            SMART LIGHTING <span style={{color: COLORS.accent}}> Playa </span>
          </h2>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {[
              { id: 'mapaBase', label: 'MAPA DE SECT' },
              { id: 'dashboard', label: 'DASHBOARD' },
              { id: 'manager', label: 'MANAGER' }
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
              title="Cerrar sesión"
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
        overflowY: (tab === 'dashboard' || tab === 'captura' || tab === 'tracker') ? 'auto' : 'hidden' 
      }}>
        {tab === 'home' && (
          <Home onLogoClick={() => { setShowRegisterMsg(false); setTab('login'); }} />
        )}
        
        {tab === 'login' && !showRegisterMsg && (
          <Login 
            onLoginSuccess={handleLoginSuccess} 
            onRegisterClick={() => setShowRegisterMsg(true)} 
          />
        )}

        {/* Mensaje elegante de solicitud de registro */}
        {showRegisterMsg && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%', 
            gap: '20px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              maxWidth: '400px',
              width: '100%',
              borderTop: `4px solid ${COLORS.primary}`
            }}>
              <h3 style={{ color: COLORS.primary, margin: '0 0 10px 0', fontSize: '18px' }}>Solicitud de Registro</h3>
              <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5', margin: '0 0 25px 0' }}>
                Para obtener una cuenta en el sistema, por favor <strong>contacte al administrador</strong> del área de Servicios Públicos.
              </p>
              <button 
                onClick={() => { setShowRegisterMsg(false); setTab('home'); }}
                style={{ 
                  background: COLORS.primary, 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 24px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  fontSize: '12px',
                  width: '100%',
                  transition: '0.2s'
                }}
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        )}
        
        {/* Pestañas protegidas */}
        {isLoggedIn && !showRegisterMsg ? (
          <>
            {tab === 'mapaBase' && <MapaBase />}
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'manager' && <Manager />}
          </>
        ) : (
          !isLoggedIn && tab !== 'home' && tab !== 'login' && !showRegisterMsg && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '15px' }}>
              <p style={{ fontWeight: 'bold', color: COLORS.primary }}>Acceso restringido. Por favor inicia sesión.</p>
              <button 
                onClick={() => setTab('login')}
                style={{ background: COLORS.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Ir al Login
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default App;