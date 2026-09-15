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

        {/* Botón flotante de llamada a la acción */}
        <div className="absolute bottom-16 w-full text-center px-4 z-10">
          <div className="inline-block bg-black/80 backdrop-blur-md border border-[#be185d]/50 px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(190,24,93,0.3)] animate-bounce">
            <p className="text-white text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
              Toca la pantalla o haz <span className="text-[#be185d]">clic</span> para entrar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;