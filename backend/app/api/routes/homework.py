from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import os, uuid, aiofiles
from app.db.session import get_db
from app.models.user import User, Homework, HomeworkAssignment
from app.schemas.schemas import HomeworkCreate, HomeworkOut
from app.core.security import get_current_user

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/homework", tags=["homework"])


def _require_group(user: User):
    if not user.group_id:
        raise HTTPException(status_code=400, detail="Join a group first")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_group(current_user)
    ext = os.path.splitext(file.filename or "")[1].lower()
    safe_ext = ext if ext in {".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".zip", ".xlsx", ".pptx"} else ".bin"
    filename = f"{uuid.uuid4()}{safe_ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return {"url": f"/uploads/{filename}", "original_name": file.filename}


@router.get("", response_model=list[HomeworkOut])
async def list_homework(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_group(current_user)
    result = await db.execute(
        select(Homework)
        .where(Homework.group_id == current_user.group_id)
        .order_by(Homework.deadline.asc())
    )
    hws = result.scalars().all()

    # member count
    mc = await db.execute(
        select(func.count(User.id)).where(User.group_id == current_user.group_id)
    )
    total = mc.scalar()

    out = []
    for hw in hws:
        cc = await db.execute(
            select(func.count(HomeworkAssignment.id))
            .where(HomeworkAssignment.homework_id == hw.id, HomeworkAssignment.completed == True)
        )
        my_a = await db.execute(
            select(HomeworkAssignment).where(
                HomeworkAssignment.homework_id == hw.id,
                HomeworkAssignment.user_id == current_user.id
            )
        )
        my_assignment = my_a.scalar_one_or_none()
        out.append(HomeworkOut(
            id=hw.id, group_id=hw.group_id, title=hw.title, subject=hw.subject,
            description=hw.description, deadline=hw.deadline, file_url=hw.file_url,
            created_by=hw.created_by, created_at=hw.created_at,
            completion_count=cc.scalar(), total_members=total,
            is_completed_by_me=bool(my_assignment and my_assignment.completed)
        ))
    return out


@router.post("", response_model=HomeworkOut, status_code=201)
async def create_homework(
    data: HomeworkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_group(current_user)
    hw = Homework(
        group_id=current_user.group_id,
        title=data.title, subject=data.subject,
        description=data.description, deadline=data.deadline,
        file_url=data.file_url, created_by=current_user.id,
    )
    db.add(hw)
    await db.flush()
    return HomeworkOut(
        id=hw.id, group_id=hw.group_id, title=hw.title, subject=hw.subject,
        description=hw.description, deadline=hw.deadline, file_url=hw.file_url,
        created_by=hw.created_by, created_at=hw.created_at,
    )


@router.post("/{hw_id}/complete")
async def toggle_complete(
    hw_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Homework).where(Homework.id == hw_id))
    hw = result.scalar_one_or_none()
    if not hw or hw.group_id != current_user.group_id:
        raise HTTPException(404, "Homework not found")

    res = await db.execute(
        select(HomeworkAssignment).where(
            HomeworkAssignment.homework_id == hw_id,
            HomeworkAssignment.user_id == current_user.id
        )
    )
    assignment = res.scalar_one_or_none()
    if not assignment:
        assignment = HomeworkAssignment(
            homework_id=hw_id, user_id=current_user.id, completed=True,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(assignment)
        current_user.points += 10  # gamification
    else:
        assignment.completed = not assignment.completed
        assignment.completed_at = datetime.now(timezone.utc) if assignment.completed else None
        if assignment.completed:
            current_user.points += 10
        else:
            current_user.points = max(0, current_user.points - 10)
    await db.flush()
    return {"completed": assignment.completed, "points": current_user.points}


@router.delete("/{hw_id}", status_code=204)
async def delete_homework(
    hw_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Homework).where(Homework.id == hw_id))
    hw = result.scalar_one_or_none()
    if not hw or hw.group_id != current_user.group_id:
        raise HTTPException(404)
    if current_user.role not in ("head", "admin") and hw.created_by != current_user.id:
        raise HTTPException(403)
    await db.delete(hw)
