import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.db.session import Base, get_db

TEST_DB = "sqlite+aiosqlite:///./test.db"
test_engine = create_async_engine(TEST_DB, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)

async def override_get_db():
    async with TestSession() as s:
        try:
            yield s
            await s.commit()
        except:
            await s.rollback()
            raise

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_register_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/auth/register", json={
            "username": "testuser", "email": "test@test.com",
            "password": "secret123", "full_name": "Test User"
        })
    assert r.status_code == 201
    assert r.json()["username"] == "testuser"

@pytest.mark.asyncio
async def test_register_duplicate():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/auth/register", json={"username": "dup", "email": "dup@test.com", "password": "secret"})
        r = await c.post("/api/auth/register", json={"username": "dup", "email": "dup2@test.com", "password": "secret"})
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/auth/register", json={"username": "login_test", "email": "l@t.com", "password": "pass123"})
        r = await c.post("/api/auth/login", data={"username": "login_test", "password": "pass123"})
    assert r.status_code == 200
    assert "access_token" in r.json()

@pytest.mark.asyncio
async def test_me_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/auth/me")
    assert r.status_code == 401

@pytest.mark.asyncio
async def test_me_authorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/auth/register", json={"username": "me_user", "email": "me@t.com", "password": "pass"})
        login = await c.post("/api/auth/login", data={"username": "me_user", "password": "pass"})
        token = login.json()["access_token"]
        r = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "me_user"
