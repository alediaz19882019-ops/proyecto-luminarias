import React, { useState } from 'react';

const Login = ({ onLoginSuccess, onRegisterClick, onGoHome }) => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginSuccess(); // Entramos directo al mapa de sectores
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020202] p-4 font-sans">
      {/* Contenedor principal en tono oscuro / carbón con un borde sutil */}
      <div className="w-full max-w-md bg-[#121214] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-[#be185d]/30 overflow-hidden">
        
        {/* Barra superior de acento */}
        <div className="h-2 bg-[#be185d] w-full" />

        <div className="p-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
              SMART <span className="text-[#be185d]">PLAYA</span>
            </h1>
            <p className="text-gray-400 mt-2 text-xs font-bold uppercase tracking-widest text-center">
              Gobierno de Playa del Carmen Qroo
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-[#be185d] uppercase tracking-wider ml-1">
                Usuario Autorizado
              </label>
              <input 
                type="text" 
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ej: alejo"
                className="w-full px-5 py-4 rounded-2xl border-2 border-[#222228] bg-[#1a1a20] text-white placeholder-gray-600 focus:border-[#be185d] focus:ring-4 focus:ring-[#be185d]/20 outline-none transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] font-black text-[#be185d] uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                {/* Botón ¿Olvidaste tu clave? redirige a home */}
                <button 
                  type="button"
                  onClick={onGoHome}
                  className="text-[10px] font-bold text-gray-500 hover:text-[#be185d] transition-colors uppercase tracking-wider cursor-pointer"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 rounded-2xl border-2 border-[#222228] bg-[#1a1a20] text-white placeholder-gray-600 focus:border-[#be185d] focus:ring-4 focus:ring-[#be185d]/20 outline-none transition-all"
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#be185d] hover:bg-[#a0144f] text-white font-black py-5 rounded-2xl transition-all shadow-lg shadow-[#be185d]/30 active:scale-[0.98] uppercase tracking-widest text-sm cursor-pointer"
            >
              Entrar 
            </button>
          </form>

          {/* Sección de Contactar Administrador redirige a home */}
          <div className="mt-8 pt-6 border-t border-[#222228] text-center">
            <p className="text-xs text-gray-400 mb-3 font-semibold">¿No tienes acceso todavía?</p>
            <button 
              onClick={onGoHome}
              className="w-full border-2 border-[#be185d] text-[#be185d] hover:bg-[#be185d] hover:text-white font-black py-3 rounded-xl transition-all text-[11px] uppercase tracking-widest cursor-pointer"
            >
              Contactar al administrador
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[3px]">
              Alumbrado 
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;