import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://134.209.65.153:8085/graphql';

const Login = ({ onLoginSuccess, onRegisterClick, onGoHome }) => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(false);

    try {
      const query = `
        query {
          validarUsuario(usuario: "${usuario}", password: "${password}") {
            success
          }
        }
      `;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const result = await response.json();
      setCargando(false);

      if (result.data?.validarUsuario?.success) {
        onLoginSuccess();
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Error al conectar con el servidor:', err);
      setCargando(false);
      alert('Error de conexión con el servidor');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020202] p-4 font-sans">
      <div className="w-full max-w-md bg-[#121214] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-[#be185d]/30 overflow-hidden">
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
                placeholder="Ej: Alejo"
                className="w-full px-5 py-4 rounded-2xl border-2 border-[#222228] bg-[#1a1a20] text-white placeholder-gray-600 focus:border-[#be185d] focus:ring-4 focus:ring-[#be185d]/20 outline-none transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] font-black text-[#be185d] uppercase tracking-wider">
                  Contraseña de Acceso
                </label>
                <button
                  type="button"
                  onClick={onGoHome}
                  className="text-[10px] font-bold text-gray-500 hover:text-[#be185d] transition-colors uppercase tracking-wider cursor-pointer"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>

              {/* Contenedor relativo para posicionar el ícono del ojo SVG */}
              <div className="relative">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 pr-12 rounded-2xl border-2 border-[#222228] bg-[#1a1a20] text-white placeholder-gray-600 focus:border-[#be185d] focus:ring-4 focus:ring-[#be185d]/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer p-1"
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarPassword ? (
                    // Ícono de Ojo Abierto (Visible)
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    // Ícono de Ojo Tachado (Oculto)
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-red-400 text-xs text-center font-bold">
                Usuario o contraseña incorrectos
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-[#be185d] hover:bg-[#a0144f] text-white font-black py-5 rounded-2xl transition-all shadow-lg shadow-[#be185d]/30 active:scale-[0.98] uppercase tracking-widest text-sm cursor-pointer disabled:opacity-50"
            >
              {cargando ? 'Verificando...' : 'Entrar'}
            </button>
          </form>

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