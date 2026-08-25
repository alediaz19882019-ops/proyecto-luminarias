import React from 'react';

const Home = ({ onLogoClick }) => {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#020202] overflow-hidden m-0 p-0" style={{ zIndex: 9999 }}>
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
          body { 
            overflow: hidden !important; 
            margin: 0; 
            padding: 0; 
          }
        `}
      </style>

      {/* Contenedor Interactivo */}
      <div 
        onClick={onLogoClick} 
        className="relative w-full h-full cursor-pointer flex items-center justify-center bg-black p-4"
      >
        <img 
  src="/static/uploads/alejo.jpeg" 
  alt="Imagen de Bienvenida" 
  /* w-[98%] hace que en el celular se vea enorme. sm:w-full deja intacta la PC */
  className="w-[98%] sm:w-full h-auto object-contain animate-full-photo"
  style={{ 
    display: 'block',
    maxHeight: '92vh' // Permite que crezca más verticalmente en el teléfono
  }}
  onError={(e) => {
    console.error("No se encontró la foto en public/static/uploads/alejo.jpeg");
    e.target.style.backgroundColor = '#020202';
  }}
/>
        />
        
        {/* Capa de degradado inferior para dar elegancia */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>

        {/* Texto sutil en la parte inferior */}
        <div className="absolute bottom-12 w-full text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-[0.5em] font-light animate-pulse">
                Click para ingresar
            </p>
        </div>
      </div>
    </div>
  );
};

export default Home;