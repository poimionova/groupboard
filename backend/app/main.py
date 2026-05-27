from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from app.db.session import engine, Base
from app.api.routes.auth import router as auth_router
from app.api.routes.groups import router as groups_router
from app.api.routes.homework import router as hw_router
from app.api.routes.queues import router as queues_router
from app.api.routes.other import schedule_router, tasks_router, polls_router, stats_router
# import models so metadata is populated
import app.models.user  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="GroupBoard API",
    version="0.1.0",
    description="Kanban-доска для учебной группы",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(groups_router, prefix="/api")
app.include_router(hw_router, prefix="/api")
app.include_router(queues_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(polls_router, prefix="/api")
app.include_router(stats_router, prefix="/api")


from app.core.config import settings
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
async def root():
    return {"message": "GroupBoard API is running 🚀", "docs": "/docs"}
