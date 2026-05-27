import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.user import User, Group
from app.schemas.schemas import GroupCreate, GroupOut, JoinGroup
from app.core.security import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


def gen_code(n=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))


@router.post("", response_model=GroupOut, status_code=201)
async def create_group(
    data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = gen_code()
    group = Group(name=data.name, invite_code=code, created_by=current_user.id)
    db.add(group)
    await db.flush()
    # assign creator as head
    current_user.group_id = group.id
    current_user.role = "head"
    await db.flush()
    return GroupOut(
        id=group.id, name=group.name, invite_code=group.invite_code,
        created_by=group.created_by, created_at=group.created_at, member_count=1
    )


@router.post("/join", response_model=GroupOut)
async def join_group(
    data: JoinGroup,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.invite_code == data.invite_code))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    current_user.group_id = group.id
    await db.flush()
    count = await db.execute(select(func.count(User.id)).where(User.group_id == group.id))
    return GroupOut(
        id=group.id, name=group.name, invite_code=group.invite_code,
        created_by=group.created_by, created_at=group.created_at,
        member_count=count.scalar()
    )


@router.get("/my", response_model=GroupOut)
async def my_group(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.group_id:
        raise HTTPException(status_code=404, detail="Not in any group")
    result = await db.execute(select(Group).where(Group.id == current_user.group_id))
    group = result.scalar_one()
    count = await db.execute(select(func.count(User.id)).where(User.group_id == group.id))
    return GroupOut(
        id=group.id, name=group.name, invite_code=group.invite_code,
        created_by=group.created_by, created_at=group.created_at,
        member_count=count.scalar()
    )


@router.get("/my/members")
async def group_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.group_id:
        raise HTTPException(status_code=404, detail="Not in any group")
    result = await db.execute(
        select(User).where(User.group_id == current_user.group_id).order_by(User.points.desc())
    )
    members = result.scalars().all()
    return [
        {
            "id": m.id, "username": m.username, "full_name": m.full_name,
            "role": m.role, "points": m.points, "avatar_url": m.avatar_url
        }
        for m in members
    ]
