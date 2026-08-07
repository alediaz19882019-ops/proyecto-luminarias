import strawberry
from typing import List, Optional
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy import func
import datetime

# Importamos tus modelos y la sesión
from app.database import SessionLocal
from app import models 

# --- 1. DEFINICIÓN DE TIPOS (GRAPHQL TYPES) ---

@strawberry.type
class Recibo:
    id: strawberry.ID
    mes: str
    anio: int
    consumoKwh: float
    lecturaAnterior: Optional[float] = 0.0
    lecturaActual: Optional[float] = 0.0
    importe: float
    tipoServicio: str
    notasObservaciones: Optional[str] = ""

@strawberry.type
class LuminariaType:
    id: strawberry.ID
    latitud: float
    longitud: float
    luminariasPorPoste: int
    cantidadPostes: int
    tipoLampara: Optional[str] = "LED"
    capacidad: Optional[str] = "70"
    descripcion: Optional[str] = ""

@strawberry.type
class SectorType:
    id: strawberry.ID
    clave: str
    clasificacion: Optional[str]
    nombreColonia: str
    latitud: float
    longitud: float
    consumoIdeal: float
    consumoAceptable: float
    consumoMaximo: float
    medidor: Optional[str]
    cuenta: Optional[str]
    carga: Optional[float]
    cpd: Optional[float]
    tarifa: Optional[str]
    recibos: List[Recibo]
    luminarias: List[LuminariaType]

# --- 2. INPUTS PARA MUTACIONES ---

@strawberry.input
class ReciboInput:
    sectorId: int
    mes: str
    anio: int
    lecturaAnterior: float
    lecturaActual: float
    consumoKwh: Optional[float] = 0.0
    importeRecibo: Optional[float] = 0.0
    notasObservaciones: Optional[str] = ""

@strawberry.input
class SectorLimitsInput:
    id: int
    ideal: float
    aceptable: float
    maximo: float

@strawberry.input
class LuminariaInput:
    sectorId: int
    latitud: float
    longitud: float
    tipoLampara: str = "LED"
    descripcion: str = ""
    cantidadPostes: int = 1
    luminariasPorPoste: int = 1
    capacidad: str = "70"

@strawberry.input
class SectorDataInput:
    id: int
    medidor: str
    cuenta: str
    tarifa: str
    cpd: float
    carga: float

# --- 3. CONSULTAS (QUERIES) ---

@strawberry.type
class Query:
    
    @strawberry.field
    def recibosConsolidados(self, anio: int) -> List[Recibo]:
        db = SessionLocal()
        try:
            recibos = db.query(models.ReciboMensual).filter(
                models.ReciboMensual.anio == anio
            ).all()
            
            return [Recibo(
                id=strawberry.ID(f"con_{r.id}"),
                mes=r.mes.strip().capitalize() if r.mes else "S/M",
                anio=r.anio,
                consumoKwh=float(r.consumo_kwh or 0.0),
                lecturaAnterior=float(getattr(r, 'lectura_anterior', 0.0) or 0.0),
                lecturaActual=float(getattr(r, 'lectura_actual', 0.0) or 0.0),
                importe=float(r.importe_recibo or 0.0),
                tipoServicio=r.tipo_servicio or "ALUMBRADO",
                notasObservaciones=r.notas_observaciones or "Consolidado"
            ) for r in recibos]
        finally:
            db.close()

    @strawberry.field
    def todosLosSectores(self) -> List[SectorType]:
        db = SessionLocal()
        try:
            # 🚀 OPTIMIZACIÓN MÁXIMA DE CARGA EN MEMORIA
            # Usamos execution_options(populate_existing=True) para evitar overhead de caché en SQLAlchemy
            sectores = db.query(models.Sector).options(
                joinedload(models.Sector.colonia),
                selectinload(models.Sector.recibos_detallados),
                selectinload(models.Sector.recibos_mensuales),
                selectinload(models.Sector.luminarias)
            ).execution_options(populate_existing=True).all()
            
            meses_orden = {
                "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4, "Mayo": 5, "Junio": 6,
                "Julio": 7, "Agosto": 8, "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12
            }

            resultado = []
            for s in sectores:
                lista_recibos_unificada = []
                for r in s.recibos_detallados:
                    lista_recibos_unificada.append(Recibo(
                        id=strawberry.ID(f"det_{r.id}"),
                        mes=r.mes.strip().capitalize() if r.mes else "S/M",
                        anio=r.anio,
                        consumoKwh=float(r.consumo_kwh or 0.0),
                        lecturaAnterior=float(r.lectura_anterior or 0.0),
                        lecturaActual=float(r.lectura_actual or 0.0),
                        importe=float(r.importe_recibo or 0.0),
                        tipoServicio=r.tipo_servicio or "ALUMBRADO",
                        notasObservaciones=r.notas_observaciones
                    ))
                for r in s.recibos_mensuales:
                    lista_recibos_unificada.append(Recibo(
                        id=strawberry.ID(f"men_{r.id}"),
                        mes=r.mes.strip().capitalize() if r.mes else "S/M",
                        anio=r.anio,
                        consumoKwh=float(r.consumo_kwh or 0.0),
                        lecturaAnterior=float(getattr(r, 'lectura_anterior', 0.0) or 0.0),
                        lecturaActual=float(getattr(r, 'lectura_actual', 0.0) or 0.0),
                        importe=float(r.importe_recibo or 0.0),
                        tipoServicio=r.tipo_servicio or "ALUMBRADO",
                        notasObservaciones=r.notas_observaciones or "Dato Histórico"
                    ))

                lista_recibos_unificada.sort(key=lambda x: (x.anio, meses_orden.get(x.mes, 0)), reverse=True)

                resultado.append(SectorType(
                    id=strawberry.ID(str(s.id)),
                    clave=s.clave,
                    clasificacion=s.clasificacion or "ALUMBRADO",
                    nombreColonia=s.colonia.nombre if s.colonia else "SIN COLONIA",
                    latitud=float(s.latitud or 0.0),
                    longitud=float(s.longitud or 0.0),
                    consumoIdeal=float(s.consumo_ideal or 0.0),
                    consumoAceptable=float(s.consumo_aceptable or 0.0),
                    consumoMaximo=float(s.consumo_maximo or 0.0),
                    medidor=s.medidor,
                    cuenta=s.cuenta,
                    carga=float(s.carga) if s.carga else 0.0,
                    cpd=float(s.cpd) if s.cpd else 0.0,
                    tarifa=s.tarifa or "5A",
                    recibos=lista_recibos_unificada,
                    luminarias=[LuminariaType(
                        id=strawberry.ID(str(l.id)), 
                        latitud=float(l.latitud),
                        longitud=float(l.longitud),
                        luminariasPorPoste=int(l.luminarias_por_poste or 1),
                        cantidadPostes=int(l.cantidad_postes or 1),
                        tipoLampara=l.tipo_lampara,
                        capacidad=str(l.capacidad) if l.capacidad else "70",
                        descripcion=l.descripcion
                    ) for l in s.luminarias]
                ))
            return resultado
        finally:
            db.close()

# --- 4. ACTUALIZACIONES (MUTATIONS) ---

@strawberry.type
class Mutation:
    @strawberry.mutation
    def crearLuminaria(self, input: LuminariaInput) -> LuminariaType:
        db = SessionLocal()
        try:
            nueva_lum = models.Luminaria(
                sector_id=input.sectorId,
                latitud=input.latitud,
                longitud=input.longitud,
                tipo_lampara=input.tipoLampara,
                descripcion=input.descripcion,
                cantidad_postes=input.cantidadPostes,
                luminarias_por_poste=input.luminariasPorPoste,
                capacidad=input.capacidad
            )
            db.add(nueva_lum)
            db.commit()
            db.refresh(nueva_lum)
            
            return LuminariaType(
                id=strawberry.ID(str(nueva_lum.id)),
                latitud=float(nueva_lum.latitud),
                longitud=float(nueva_lum.longitud),
                luminariasPorPoste=int(nueva_lum.luminarias_por_poste),
                cantidadPostes=int(nueva_lum.cantidad_postes),
                tipoLampara=nueva_lum.tipo_lampara,
                capacidad=str(nueva_lum.capacidad),
                descripcion=nueva_lum.descripcion,
            )
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def crearLuminariasMasivas(self, input: List[LuminariaInput]) -> List[LuminariaType]:
        db = SessionLocal()
        resultados = []
        try:
            for item in input:
                nueva_lum = models.Luminaria(
                    sector_id=item.sectorId,
                    latitud=item.latitud,
                    longitud=item.longitud,
                    tipo_lampara=item.tipoLampara,
                    descripcion=item.descripcion,
                    cantidad_postes=item.cantidadPostes,
                    luminarias_por_poste=item.luminariasPorPoste,
                    capacidad=item.capacidad
                )
                db.add(nueva_lum)
                resultados.append(nueva_lum)
            
            db.commit()
            for r in resultados: db.refresh(r)

            return [LuminariaType(
                id=strawberry.ID(str(l.id)),
                latitud=float(l.latitud),
                longitud=float(l.longitud),
                luminariasPorPoste=int(l.luminarias_por_poste),
                cantidadPostes=int(l.cantidad_postes),
                tipoLampara=l.tipo_lampara,
                capacidad=str(l.capacidad),
                descripcion=l.descripcion,
            ) for l in resultados]
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def registrarRecibo(self, input: ReciboInput) -> Recibo:
        db = SessionLocal()
        try:
            recibo = db.query(models.ReciboDetallado).filter(
                models.ReciboDetallado.sector_id == input.sectorId,
                models.ReciboDetallado.mes == input.mes,
                models.ReciboDetallado.anio == input.anio
            ).first()

            if not recibo:
                recibo = models.ReciboDetallado(
                    sector_id=input.sectorId,
                    mes=input.mes,
                    anio=input.anio,
                    tipo_servicio="ALUMBRADO"
                )
                db.add(recibo)

            recibo.lectura_anterior = input.lecturaAnterior
            recibo.lectura_actual = input.lecturaActual
            recibo.notas_observaciones = input.notasObservaciones
            recibo.consumo_kwh = input.consumoKwh
            recibo.importe_recibo = input.importeRecibo

            db.commit()
            db.refresh(recibo)
            
            return Recibo(
                id=strawberry.ID(str(recibo.id)),
                mes=recibo.mes,
                anio=recibo.anio,
                consumoKwh=float(recibo.consumo_kwh or 0.0),
                lecturaAnterior=float(recibo.lectura_anterior or 0.0),
                lecturaActual=float(recibo.lectura_actual or 0.0),
                importe=float(recibo.importe_recibo or 0.0),
                tipoServicio=recibo.tipo_servicio or "ALUMBRADO",
                notasObservaciones=recibo.notas_observaciones
            )
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def eliminarRecibo(self, sectorId: int, mes: str, anio: int) -> bool:
        db = SessionLocal()
        try:
            recibo = db.query(models.ReciboDetallado).filter(
                models.ReciboDetallado.sector_id == sectorId,
                models.ReciboDetallado.mes == mes,
                models.ReciboDetallado.anio == anio
            ).first()

            if recibo:
                db.delete(recibo)
                db.commit()
                return True
            return False
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def batchUpdateLimits(self, inputs: List[SectorLimitsInput]) -> List[str]:
        db = SessionLocal()
        mensajes = []
        try:
            for item in inputs:
                sector = db.query(models.Sector).filter(models.Sector.id == item.id).first()
                if sector:
                    sector.consumo_ideal = item.ideal
                    sector.consumo_aceptable = item.aceptable
                    sector.consumo_maximo = item.maximo
                    mensajes.append(f"Sector {item.id} ({sector.clave}) actualizado.")
            db.commit()
            return mensajes
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def batchUpdateSectorData(self, inputs: List[SectorDataInput]) -> List[str]:
        db = SessionLocal()
        mensajes = []
        try:
            for item in inputs:
                sector = db.query(models.Sector).filter(models.Sector.id == item.id).first()
                if sector:
                    sector.medidor = item.medidor
                    sector.cuenta = item.cuenta
                    sector.tarifa = item.tarifa
                    sector.cpd = item.cpd
                    sector.carga = item.carga
                    mensajes.append(f"Datos de Sector {item.id} actualizados.")
            db.commit()
            return mensajes
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

schema = strawberry.Schema(query=Query, mutation=Mutation)