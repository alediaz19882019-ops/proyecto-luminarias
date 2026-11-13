from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from urllib.parse import quote_plus

# --- DETECCIÓN AUTOMÁTICA DE ENTORNO ---
# 1. Si existe DATABASE_URL (Docker), la usamos.
# 2. Si no, probamos con el puerto 3309 (Tu Mac conectando al contenedor).
# 3. La contraseña se lee del archivo .env (DB_ROOT_PASSWORD); nunca se escribe aquí para que no se suba a GitHub.

def _leer_env(clave):
    """Busca la clave en las variables del sistema o en el .env de la carpeta del proyecto."""
    if os.getenv(clave):
        return os.getenv(clave)
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            if linea.strip().startswith(clave + "="):
                return linea.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

DEFAULT_LOCAL_URL = "mysql+mysqlconnector://root:" + quote_plus(_leer_env("DB_ROOT_PASSWORD")) + "@127.0.0.1:3309/playa_db"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_LOCAL_URL)

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine, 
    expire_on_commit=False
)

Base = declarative_base()