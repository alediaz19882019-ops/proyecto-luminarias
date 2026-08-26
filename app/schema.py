import strawberry
from typing import List, Optional
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy import func
import datetime

# Importamos tus modelos y la sesión
from app.database import SessionLocal
from app import models 

# --- FUNCIÓN AUXILIAR PARA RECALCULAR CONSUMOS, CARGA Y CPD AUTOMÁTICAMENTE ---
def recalcular_consumos_sector(db, sector_id: int):
    sector = db.query(models.Sector).filter(models.Sector.id == sector_id).first()
    if sector:
        potencia_total_watts = 0
        for lum in sector.luminarias:
            try:
                cap = float(lum.capacidad or 0)
            except ValueError:
                cap = 0.0
            
            postes = int(lum.cantidad_postes or 1)
            por_poste = int(lum.luminarias_por_poste or 1)
            potencia_total_watts += (cap * postes * por_poste)

        # 1. Carga en kW
        carga_kw = potencia_total_watts / 1000.0
        sector.carga = carga_kw

        # 2. Consumo Ideal basado en 360 horas mensuales de encendido
        consumo_ideal = carga_kw * 360.0
        sector.consumo_ideal = consumo_ideal

        # 3. Márgenes actualizados: Aceptable = +50% (1.5x), Máximo = +100% (2.0x)
        sector.consumo_aceptable = consumo_ideal * 1.50
        sector.consumo_maximo = consumo_ideal * 2.00

        # 4. CPD (Consumo Promedio Diario) sincronizado con el consumo ideal mensual (base 30 días)
        sector.cpd = consumo_ideal / 30.0

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
class LuminariaUpdateInput:
    id: strawberry.ID
    cantidadPostes: Optional[int] = 1
    luminariasPorPoste: Optional[int] = 1
    tipoLampara: Optional[str] = "LED"
    capacidad: Optional[str] = "70"
    descripcion: Optional[str] = ""

@strawberry.input
class SectorDataInput:
    id: int
    medidor: str
    cuenta: str
    tarifa: str
    cpd: float
    carga: float

@strawberry.input
class SectorInput:
    clave: str
    clasificacion: Optional[str] = "ALUMBRADO PUBLICO"
    nombreColonia: str
    latitud: float
    longitud: float
    consumoIdeal: Optional[float] = 0.0
    consumoAceptable: Optional[float] = 0.0
    consumoMaximo: Optional[float] = 0.0
    medidor: Optional[str] = ""
    cuenta: Optional[str] = ""
    carga: Optional[float] = 0.0
    cpd: Optional[float] = 0.0
    tarifa: Optional[str] = "07"

# --- 3. CONSULTAS (QUERIES) ---

@strawberry.type
class Query:
    # --- VALIDACIÓN DE CREDENCIALES CONTRA MYSQL (TEXTO PLANO) ---
    @strawberry.field
    def validar_usuario(self, usuario: str, password: str) -> bool:
        db = SessionLocal()
        try:
            user_db = db.query(models.Usuario).filter(models.Usuario.usuario == usuario).first()
            if not user_db:
                return False
            return user_db.password == password
        finally:
            db.close()
            
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
    def crearSector(self, input: SectorInput) -> SectorType:
        db = SessionLocal()
        try:
            colonia_obj = db.query(models.Colonia).filter(models.Colonia.nombre == input.nombreColonia).first()
            if not colonia_obj:
                colonia_obj = models.Colonia(nombre=input.nombreColonia)
                db.add(colonia_obj)
                db.flush()

            nuevo_sec = models.Sector(
                clave=input.clave,
                clasificacion=input.clasificacion,
                colonia_id=colonia_obj.id,
                latitud=input.latitud,
                longitud=input.longitud,
                consumo_ideal=input.consumoIdeal,
                consumo_aceptable=input.consumoAceptable,
                consumo_maximo=input.consumoMaximo,
                medidor=input.medidor,
                cuenta=input.cuenta,
                carga=input.carga,
                cpd=input.cpd,
                tarifa=input.tarifa
            )
            db.add(nuevo_sec)
            db.commit()
            db.refresh(nuevo_sec)
            
            return SectorType(
                id=strawberry.ID(str(nuevo_sec.id)),
                clave=nuevo_sec.clave,
                clasificacion=nuevo_sec.clasificacion,
                nombreColonia=colonia_obj.nombre,
                latitud=float(nuevo_sec.latitud or 0.0),
                longitud=float(nuevo_sec.longitud or 0.0),
                consumoIdeal=float(nuevo_sec.consumo_ideal or 0.0),
                consumoAceptable=float(nuevo_sec.consumo_aceptable or 0.0),
                consumoMaximo=float(nuevo_sec.consumo_maximo or 0.0),
                medidor=nuevo_sec.medidor,
                cuenta=nuevo_sec.cuenta,
                carga=float(nuevo_sec.carga or 0.0),
                cpd=float(nuevo_sec.cpd or 0.0),
                tarifa=nuevo_sec.tarifa,
                recibos=[],
                luminarias=[]
            )
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def eliminarSector(self, id: strawberry.ID) -> bool:
        db = SessionLocal()
        try:
            sec_id = str(id).replace("sec-", "")
            sector = db.query(models.Sector).filter(models.Sector.id == sec_id).first()
            if sector:
                db.delete(sector)
                db.commit()
                return True
            return False
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

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
            db.flush()
            
            recalcular_consumos_sector(db, input.sectorId)

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
    def actualizarLuminaria(self, input: LuminariaUpdateInput) -> LuminariaType:
        db = SessionLocal()
        try:
            lum_id = str(input.id).replace("lum-", "")
            luminaria = db.query(models.Luminaria).filter(models.Luminaria.id == lum_id).first()
            
            if not luminaria:
                raise Exception("Luminaria no encontrada en la base de datos")

            luminaria.cantidad_postes = input.cantidadPostes
            luminaria.luminarias_por_poste = input.luminariasPorPoste
            luminaria.tipo_lampara = input.tipoLampara
            luminaria.capacidad = input.capacidad
            luminaria.descripcion = input.descripcion
            db.flush()

            recalcular_consumos_sector(db, luminaria.sector_id)

            db.commit()
            db.refresh(luminaria)
            
            return LuminariaType(
                id=strawberry.ID(str(luminaria.id)),
                latitud=float(luminaria.latitud),
                longitud=float(luminaria.longitud),
                luminariasPorPoste=int(luminaria.luminarias_por_poste or 1),
                cantidadPostes=int(luminaria.cantidad_postes or 1),
                tipoLampara=luminaria.tipo_lampara,
                capacidad=str(luminaria.capacidad or "70"),
                descripcion=luminaria.descripcion
            )
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def eliminarLuminaria(self, id: strawberry.ID) -> bool:
        db = SessionLocal()
        try:
            lum_id = str(id).replace("lum-", "")
            luminaria = db.query(models.Luminaria).filter(models.Luminaria.id == lum_id).first()
            if luminaria:
                sector_id = luminaria.sector_id
                db.delete(luminaria)
                db.flush()
                
                recalcular_consumos_sector(db, sector_id)

                db.commit()
                return True
            return False
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @strawberry.mutation
    def crearLuminariasMasivas(self, input: List[LuminariaInput]) -> List[LuminariaType]:
        db = SessionLocal()
        resultados = []
        sector_afectado_id = None
        try:
            for item in input:
                sector_afectado_id = item.sectorId
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
            
            db.flush()
            if sector_afectado_id:
                recalcular_consumos_sector(db, sector_afectado_id)

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