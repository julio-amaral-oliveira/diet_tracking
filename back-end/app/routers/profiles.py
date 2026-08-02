"""
Profiles Router
=================
Endpoints for managing profiles (multi-person support).

Endpoints:
  GET    /profiles/          - List all profiles
  POST   /profiles/          - Create a profile
  PATCH  /profiles/{id}      - Rename a profile
  DELETE /profiles/{id}      - Delete a profile and all its data
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import MessageResponse, ProfileCreate, ProfileResponse, ProfileUpdate
from app.services.profiles import (
    create_profile,
    delete_profile,
    list_profiles,
    rename_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("/", response_model=list[ProfileResponse])
async def get_profiles(db: AsyncSession = Depends(get_db)):
    """List all profiles."""
    return await list_profiles(db)


@router.post("/", response_model=ProfileResponse, status_code=201)
async def create_new_profile(
    payload: ProfileCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new profile. The user_id is generated server-side."""
    return await create_profile(db, payload.name)


@router.patch("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: int,
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Rename a profile. The user_id stays unchanged."""
    try:
        return await rename_profile(db, profile_id, payload.name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{profile_id}", response_model=MessageResponse)
async def remove_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a profile and all its diet plans and body logs."""
    try:
        profile = await delete_profile(db, profile_id)
        return MessageResponse(
            message="Perfil excluído com sucesso.",
            detail=f"O perfil '{profile.name}' e todos os seus dados foram removidos.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
