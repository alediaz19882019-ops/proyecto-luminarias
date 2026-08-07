import pandas as pd
from sqlalchemy import create_engine

df = pd.read_csv('luminarias2024.csv')

columnas_validas = [
    'id', 'cantidad_postes', 'latitud', 'longitud', 
    'tipo_lampara', 'sector_id', 'descripcion', 
    'luminarias_por_poste', 'capacidad'
]

df_final = df[[col for col in columnas_validas if col in df.columns]]
print(f"Registros listos para importar: {len(df_final)}")

# Conexión usando la contraseña 'password'
engine = create_engine('mysql+pymysql://root:password@localhost:3309/playa_db')

df_final.to_sql('luminarias', con=engine, if_exists='append', index=False)
print("¡Importación completada con éxito!")
