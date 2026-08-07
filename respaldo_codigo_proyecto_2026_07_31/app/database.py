from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# --- DETECCIÓN AUTOMÁTICA DE ENTORNO ---
# 1. Si existe DATABASE_URL (Docker), la usamos.
# 2. Si no, probamos con el puerto 3309 (Tu Mac conectando al contenedor).
# 3. Ajusta 'root' y 'tu_password' según tus credenciales reales.

DEFAULT_LOCAL_URL = "mysql+mysqlconnector://root:tu_password@127.0.0.1:3309/playa_db"

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