"""
Tests for the Profile Service (multi-profile support)
========================================================
Uses an in-memory SQLite database (aiosqlite) for fast, isolated testing.

Test matrix:
  1. create_profile generates a unique user_id
  2. list_profiles returns all profiles in creation order
  3. rename_profile changes the name but keeps the user_id
  4. rename_profile raises for a missing profile
  5. delete_profile removes the profile and all its data
  6. delete_profile refuses to remove the last remaining profile
"""

import pytest
import pytest_asyncio
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import event

from app.core.database import Base
from app.models import BodyLog, DietPlan, Profile
from app.services.profiles import (
    create_profile,
    delete_profile,
    list_profiles,
    rename_profile,
)


# ── Fixtures ────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def engine():
    """Create an in-memory SQLite async engine for testing."""
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    @event.listens_for(eng.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield eng

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine):
    """Provide a fresh async session for each test."""
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


# ── Helper to seed profile-owned data ───────────────────────────

async def _seed_profile(db: AsyncSession, name: str, user_id: str) -> Profile:
    profile = Profile(user_id=user_id, name=name)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def _seed_owned_data(db: AsyncSession, user_id: str) -> None:
    log = BodyLog(date=date(2026, 1, 1), user_id=user_id, weight_kg=80.0)
    plan = DietPlan(
        user_id=user_id,
        target_calories=3000.0,
        target_protein=200.0,
        target_carbs=400.0,
        target_fat=80.0,
        is_active=True,
    )
    db.add_all([log, plan])
    await db.commit()


# ── Tests ───────────────────────────────────────────────────────

class TestCreateProfile:
    @pytest.mark.asyncio
    async def test_generates_unique_user_id(self, db):
        first = await create_profile(db, "João")
        second = await create_profile(db, "Maria")

        assert first.name == "João"
        assert second.name == "Maria"
        assert first.user_id.startswith("profile_")
        assert first.user_id != second.user_id


class TestListProfiles:
    @pytest.mark.asyncio
    async def test_returns_all_in_creation_order(self, db):
        await create_profile(db, "João")
        await create_profile(db, "Maria")

        profiles = await list_profiles(db)

        assert [p.name for p in profiles] == ["João", "Maria"]


class TestRenameProfile:
    @pytest.mark.asyncio
    async def test_keeps_user_id(self, db):
        profile = await create_profile(db, "João")
        original_user_id = profile.user_id

        renamed = await rename_profile(db, profile.id, "João Silva")

        assert renamed.name == "João Silva"
        assert renamed.user_id == original_user_id

    @pytest.mark.asyncio
    async def test_raises_for_missing_profile(self, db):
        with pytest.raises(ValueError):
            await rename_profile(db, 999, "Não existe")


class TestDeleteProfile:
    @pytest.mark.asyncio
    async def test_removes_profile_and_its_data(self, db, engine):
        profile = await _seed_profile(db, "João", "user_joao")
        await _seed_profile(db, "Maria", "user_maria")
        await _seed_owned_data(db, "user_joao")

        await delete_profile(db, profile.id)

        async with engine.begin() as conn:
            from sqlalchemy import func, select
            remaining_profiles = (await conn.execute(
                select(func.count()).select_from(Profile)
            )).scalar_one()
            remaining_logs = (await conn.execute(
                select(func.count()).select_from(BodyLog)
            )).scalar_one()
            remaining_plans = (await conn.execute(
                select(func.count()).select_from(DietPlan)
            )).scalar_one()

        assert remaining_profiles == 1
        assert remaining_logs == 0
        assert remaining_plans == 0

    @pytest.mark.asyncio
    async def test_refuses_to_delete_last_profile(self, db):
        profile = await _seed_profile(db, "João", "user_joao")

        with pytest.raises(ValueError):
            await delete_profile(db, profile.id)
