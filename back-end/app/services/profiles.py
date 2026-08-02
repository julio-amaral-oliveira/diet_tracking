"""
Profile Service
=================
Business logic for managing profiles (multi-person support).

Each profile owns its data through the user_id string:
  - DietPlan.user_id
  - BodyLog.user_id

Deleting a profile removes all its diet plans (with meals, variations and
items, cascaded by the ORM) and all its body logs.
"""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BodyLog, DietPlan, Profile

logger = logging.getLogger(__name__)


def _generate_user_id() -> str:
    """Generate a unique, collision-free user_id for a new profile."""
    return f"profile_{uuid.uuid4().hex[:12]}"


async def list_profiles(db: AsyncSession) -> list[Profile]:
    """Return all profiles ordered by creation (oldest first)."""
    stmt = select(Profile).order_by(Profile.id.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_profile(db: AsyncSession, name: str) -> Profile:
    """Create a profile with a server-generated user_id."""
    profile = Profile(user_id=_generate_user_id(), name=name)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    logger.info(f"Created profile '{profile.name}' (user_id='{profile.user_id}')")
    return profile


async def rename_profile(db: AsyncSession, profile_id: int, name: str) -> Profile:
    """Rename an existing profile. The user_id stays unchanged."""
    profile = await db.get(Profile, profile_id)
    if not profile:
        raise ValueError(f"Profile with ID {profile_id} not found.")

    old_name = profile.name
    profile.name = name
    await db.commit()
    await db.refresh(profile)

    logger.info(f"Renamed profile ID {profile_id} from '{old_name}' to '{name}'")
    return profile


async def delete_profile(db: AsyncSession, profile_id: int) -> Profile:
    """
    Delete a profile and all the data it owns.

    Removes the profile's diet plans (meals, variations and items cascade
    through the ORM relationships) and its body logs. Refuses to delete
    the last remaining profile.
    """
    profile = await db.get(Profile, profile_id)
    if not profile:
        raise ValueError(f"Profile with ID {profile_id} not found.")

    total = await db.scalar(select(func.count(Profile.id)))
    if total <= 1:
        raise ValueError(
            "Cannot delete the last remaining profile. "
            "At least one profile must exist."
        )

    logs_stmt = select(BodyLog).where(BodyLog.user_id == profile.user_id)
    logs = (await db.execute(logs_stmt)).scalars().all()
    for log in logs:
        await db.delete(log)

    plans_stmt = select(DietPlan).where(DietPlan.user_id == profile.user_id)
    plans = (await db.execute(plans_stmt)).scalars().all()
    for plan in plans:
        await db.delete(plan)

    await db.delete(profile)
    await db.commit()

    logger.info(
        f"Deleted profile '{profile.name}' (user_id='{profile.user_id}') "
        f"with {len(logs)} body logs and {len(plans)} diet plans"
    )
    return profile
