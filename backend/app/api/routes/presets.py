"""
CRUD endpoints for saved interview presets (role/company/location combos
a user can save, select, and reuse on the situational practice page
instead of retyping every time - see learnings-and-decisions.md for why
this replaced the original "retype every attempt" design).

Follows the same list/delete shape as reports.py, but also supports
create and edit - unlike a graded report, a preset is something you'd
reasonably want to tweak after saving rather than only delete and
re-create.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import InterviewPreset
from app.schemas.preset import DeletePresetResponse, PresetIn, PresetSummary

router = APIRouter(prefix="/presets", tags=["presets"])


@router.post("", response_model=PresetSummary)
def create_preset(body: PresetIn, db: Session = Depends(get_db)) -> InterviewPreset:
    preset = InterviewPreset(role=body.role, company=body.company, location=body.location)
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


@router.get("", response_model=list[PresetSummary])
def list_presets(db: Session = Depends(get_db)) -> list[InterviewPreset]:
    """Most recently created first - same convention as list_reports."""
    return list(db.scalars(select(InterviewPreset).order_by(InterviewPreset.created_at.desc())))


@router.get("/{preset_id}", response_model=PresetSummary)
def get_preset(preset_id: int, db: Session = Depends(get_db)) -> InterviewPreset:
    """
    Fetches one preset by id - used by the situational practice page to
    resolve "the id stored in this browser's localStorage" into the
    actual role/company/location to build a question with.
    """
    preset = db.get(InterviewPreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset


@router.put("/{preset_id}", response_model=PresetSummary)
def update_preset(preset_id: int, body: PresetIn, db: Session = Depends(get_db)) -> InterviewPreset:
    preset = db.get(InterviewPreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")

    preset.role = body.role
    preset.company = body.company
    preset.location = body.location
    db.commit()
    db.refresh(preset)
    return preset


@router.delete("/{preset_id}", response_model=DeletePresetResponse)
def delete_preset(preset_id: int, db: Session = Depends(get_db)) -> DeletePresetResponse:
    """
    Deletes by primary key, same convention as delete_report. Whether the
    deleted preset happens to be the browser's currently "active" one is
    a frontend concern (it just falls back to "no preset selected") - this
    endpoint doesn't know or care what's in the requester's localStorage.
    """
    preset = db.get(InterviewPreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")

    db.delete(preset)
    db.commit()
    return DeletePresetResponse(id=preset_id)