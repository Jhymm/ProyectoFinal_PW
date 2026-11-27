from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.apis.personas import router as personas_router
from backend.apis.auth import router as auth_router
from backend.apis.incidentes import router as incidentes_router
from backend.db.connection import check_connection
from backend.services.exceptions import (
    PersonaAlreadyExistsError,
    PersonaNotFoundError,
)

app = FastAPI(
    title="Personas API",
    version="0.1.0",
    description="CRUD de personas conectado a Microsoft SQL Server mediante pyodbc.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(personas_router)
app.include_router(auth_router)
app.include_router(incidentes_router)


@app.get("/health/db", tags=["health"], summary="Verificar conexión a SQL Server")
def health_check_db():
    return check_connection()



@app.exception_handler(PersonaNotFoundError)
async def persona_not_found_handler(
    request: Request, exc: PersonaNotFoundError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)},
    )


@app.exception_handler(PersonaAlreadyExistsError)
async def persona_already_exists_handler(
    request: Request, exc: PersonaAlreadyExistsError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": str(exc)},
    )
