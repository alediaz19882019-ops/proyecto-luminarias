from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from contextlib import asynccontextmanager
from app.schema import schema 
from app.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ MySQL de Docker Conectado (Puerto 3309).")
    except Exception as e:
        print(f"⚠️ Error: {e}")
    yield

app = FastAPI(title="API Luminarias", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(schema) 
app.include_router(graphql_app, prefix="/graphql")