import React from 'react';

const Home = ({ onLogoClick }) => {
  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden m-0 p-0">
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

      {/* Contenedor principal interactivo */}
      <div 
        onClick={onLogoClick} 
        className="relative w-full h-full cursor-pointer flex items-center justify-center bg-black"
      >
        <img 
          src="/static/uploads/alejo.jpeg" 
          alt="Imagen de Bienvenida" 
          className="w-[130vw] max-w-none h-auto max-h-[110vh] object-contain block animate-full-photo"
          onError={(e) => {
            console.error("No se encontró la foto en public/static/uploads/alejo.jpeg");
            e.target.style.backgroundColor = '#000000';
          }}
        />
        
        {/* Degradado superior e inferior para contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none opacity-60"></div>

        {/* Botón flotante reubicado y rediseñado profesionalmente */}
        <div className="absolute bottom-6 sm:bottom-8 w-full text-center px-4 z-10 pointer-events-none">
          <div className="inline-block bg-black/75 backdrop-blur-md border border-[#be185d]/40 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-[0_8px_25px_rgba(190,24,93,0.25)] transition-all duration-300 hover:scale-105">
            <p className="text-zinc-200 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em]">
              Toca la pantalla o haz <span className="text-[#be185d] font-bold">clic</span> para entrar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;