from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Numeric
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class Colonia(Base):
    __tablename__ = "colonias"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    
    sectores = relationship("Sector", back_populates="colonia")

class Sector(Base):
    __tablename__ = "sectores"
    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, nullable=False)
    clasificacion = Column(String(100), nullable=True)
    colonia_id = Column(Integer, ForeignKey("colonias.id"), nullable=True)
    
    # Coordenadas y Consumo
    latitud = Column(Numeric(10, 8), default=0.0)
    longitud = Column(Numeric(11, 8), default=0.0)
    consumo_ideal = Column(Float, default=0.0)
    consumo_aceptable = Column(Float, default=0.0)
    consumo_maximo = Column(Float, default=0.0)

    # Campos técnicos para el medidor
    medidor = Column(String(50), nullable=True)
    cuenta = Column(String(50), nullable=True)
    carga = Column(Numeric(10, 2), default=0.0)
    cpd = Column(Numeric(10, 2), default=0.0)
    tarifa = Column(String(20), default="5A")

    # Relaciones
    colonia = relationship("Colonia", back_populates="sectores")
    luminarias = relationship("Luminaria", back_populates="sector")
    mantenimientos = relationship("Mantenimiento", back_populates="sector")
    recibos_mensuales = relationship("ReciboMensual", back_populates="sector")
    recibos_detallados = relationship("ReciboDetallado", back_populates="sector")

class Luminaria(Base):
    __tablename__ = "luminarias"
    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectores.id"))
    
    # ACTUALIZADO: Aumentamos a 18 dígitos totales y 15 decimales
    latitud = Column(Numeric(18, 15), nullable=False)
    longitud = Column(Numeric(18, 15), nullable=False)
    
    descripcion = Column(Text, nullable=True)
    capacidad = Column(String(50), nullable=True)
    tipo_lampara = Column(String(50), default="LED")
    cantidad_postes = Column(Integer, default=1)
    luminarias_por_poste = Column(Integer, default=1)
    
    sector = relationship("Sector", back_populates="luminarias")

class ReciboMensual(Base):
    __tablename__ = "recibos_mensuales"
    id = Column(Integer, primary_key=True, index=True)
    mes = Column(String(20))
    consumo_kwh = Column(Float)
    importe_recibo = Column(Float) 
    sector_id = Column(Integer, ForeignKey("sectores.id")) 
    anio = Column(Integer, default=2024)
    tipo_servicio = Column(String(50), default="ALUMBRADO")
    es_consolidado = Column(Boolean, default=False)
    
    # Campo corregido (antes faltaba en este modelo)
    notas_observaciones = Column(Text, nullable=True) 

    sector = relationship("Sector", back_populates="recibos_mensuales")

class ReciboDetallado(Base):
    __tablename__ = "recibos_detallados"
    
    id = Column(Integer, primary_key=True, index=True)
    mes = Column(String(10), nullable=False)
    consumo_kwh = Column(Float, nullable=False) 
    
    # --- NUEVAS COLUMNAS AGREGADAS ---
    lectura_anterior = Column(Float, nullable=True)
    lectura_actual = Column(Float, nullable=True)
    # ---------------------------------
    
    importe_recibo = Column(Float, nullable=False) 
    sector_id = Column(Integer, ForeignKey("sectores.id"), nullable=False) 
    anio = Column(Integer, nullable=False)
    tipo_servicio = Column(String(20), nullable=False)
    es_consolidado = Column(Boolean, default=False)
    notas_observaciones = Column(Text, nullable=True) 
    fecha_registro = Column(DateTime, default=datetime.datetime.utcnow)

    sector = relationship("Sector", back_populates="recibos_detallados")

class Mantenimiento(Base):
    __tablename__ = "mantenimientos"
    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectores.id"))
    descripcion = Column(String(500), nullable=False)
    fecha = Column(DateTime, default=datetime.datetime.utcnow)
    
    sector = relationship("Sector", back_populates="mantenimientos")

    class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(50), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    rol = Column(String(50), nullable=False)
    nombre = Column(String(100), nullable=False)
