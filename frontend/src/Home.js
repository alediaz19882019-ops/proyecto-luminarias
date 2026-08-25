import React from 'react';

const Home = ({ onLogoClick }) => {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden m-0 p-0" style={{ zIndex: 9999, backgroundColor: '#000000' }}>
      <style>
        {`
          @keyframes heartbeat {
            0% { transform: scale(1); }
            50% { transform: scale(1.04); }
            100% { transform: scale(1); }
          }
          .animate-full-photo {
            animation: heartbeat 10s ease-in-out infinite;
          }
          
          /* Ocultar elementos globales mientras esta pantalla esté activa */
          nav, header, footer, .navbar, .sidebar { 
            display: none !important; 
          }
          body, html { 
            background-color: #000000 !important;
            overflow: hidden !important; 
            margin: 0; 
            padding: 0; 
          }
        `}
      </style>

      {/* Contenedor Interactivo con fondo negro absoluto */}
      <div 
        onClick={onLogoClick} 
        className="relative w-full h-full cursor-pointer flex items-center justify-center bg-black p-0 m-0"
        style={{ backgroundColor: '#000000' }}
      >
        <img 
          src="/static/uploads/alejo.jpeg" 
          alt="Imagen de Bienvenida" 
          className="w-full sm:w-auto h-auto object-contain animate-full-photo"
          style={{ 
            display: 'block',
            maxWidth: 'none',
            width: '130vw', 
            maxHeight: '110vh'
          }}
          onError={(e) => {
            console.error("No se encontró la foto en public/static/uploads/alejo.jpeg");
            e.target.style.backgroundColor = '#000000';
          }}
        />
        
        {/* Capa de degradado eliminada o sutil si deseas fundir los bordes completamente a negro */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none opacity-40"></div>

        {/* Texto sutil en la parte inferior */}
        <div className="absolute bottom-12 w-full text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-[0.5em] font-light animate-pulse">
            </p>
        </div>
      </div>
    </div>
  );
};

export default Home;