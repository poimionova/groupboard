import math, random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.user import User, Queue, QueueSlot
from app.schemas.schemas import QueueCreate, QueueOut, QueueSlotOut, SwapRequest
from app.core.security import get_current_user

router = APIRouter(prefix="/queues", tags=["queues"])

LESSON_MINUTES = 90  # default lesson duration for capacity calc


def distribute_students(student_ids: list, dates: list, slot_minutes: int) -> list[dict]:
    """Auto-distribute students across dates based on slot size."""
    per_day = max(1, LESSON_MINUTES // slot_minutes)
    slots = []
    shuffled = student_ids.copy()
    random.shuffle(shuffled)
    idx = 0
    for date in dates:
        for pos in range(per_day):
            if idx >= len(shuffled):
                break
            slots.append({"user_id": shuffled[idx], "slot_date": date, "position": pos + 1})
            idx += 1
        if idx >= len(shuffled):
            break
    return slots, idx


@router.get("", response_model=list[QueueOut])
async def list_queues(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.group_id:
        raise HTTPException(400, "Join a group first")
    result = await db.execute(
        select(Queue).where(Queue.group_id == current_user.group_id).order_by(Queue.created_at.desc())
    )
    queues = result.scalars().all()
    out = []
    for q in queues:
        slots_r = await db.execute(
            select(QueueSlot).where(QueueSlot.queue_id == q.id).order_by(QueueSlot.slot_date, QueueSlot.position)
        )
        slots = slots_r.scalars().all()
        slot_outs = []
        for s in slots:
            u_r = await db.execute(select(User).where(User.id == s.user_id))
            u = u_r.scalar_one_or_none()
            slot_outs.append(QueueSlotOut(
                id=s.id, queue_id=s.queue_id, user_id=s.user_id,
                slot_date=s.slot_date, position=s.position,
                user=u
            ))
        out.append(QueueOut(
            id=q.id, group_id=q.group_id, subject=q.subject,
            slot_minutes=q.slot_minutes, dates=q.dates,
            auto_distributed=q.auto_distributed,
            created_by=q.created_by, created_at=q.created_at, slots=slot_outs
        ))
    return out


@router.post("", response_model=QueueOut, status_code=201)
async def create_queue(
    data: QueueCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.group_id:
        raise HTTPException(400, "Join a group first")
    if current_user.role not in ("head", "admin"):
        raise HTTPException(403, "Only head/admin can create queues")

    queue = Queue(
        group_id=current_user.group_id,
        subject=data.subject,
        slot_minutes=data.slot_minutes,
        dates=data.dates,
        created_by=current_user.id,
    )
    db.add(queue)
    await db.flush()

    if data.auto_distribute:
        members_r = await db.execute(
            select(User).where(User.group_id == current_user.group_id)
        )
        members = members_r.scalars().all()
        member_ids = [m.id for m in members]
        per_day = max(1, LESSON_MINUTES // data.slot_minutes)
        capacity = per_day * len(data.dates)

        if capacity < len(member_ids):
            raise HTTPException(
                400,
                detail={
                    "message": f"Not enough capacity. Need {len(member_ids)} slots, have {capacity}. "
                               f"Add {math.ceil((len(member_ids) - capacity) / per_day)} more date(s).",
                    "needed": len(member_ids),
                    "capacity": capacity,
                }
            )

        slots_data, _ = distribute_students(member_ids, data.dates, data.slot_minutes)
        for sd in slots_data:
            slot = QueueSlot(queue_id=queue.id, **sd)
            db.add(slot)
        queue.auto_distributed = True
        await db.flush()

    return QueueOut(
        id=queue.id, group_id=queue.group_id, subject=queue.subject,
        slot_minutes=queue.slot_minutes, dates=queue.dates,
        auto_distributed=queue.auto_distributed,
        created_by=queue.created_by, created_at=queue.created_at, slots=[]
    )


@router.post("/{queue_id}/join")
async def join_queue(
    queue_id: str,
    slot_date: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q_r = await db.execute(select(Queue).where(Queue.id == queue_id))
    queue = q_r.scalar_one_or_none()
    if not queue or queue.group_id != current_user.group_id:
        raise HTTPException(404)

    # check already in queue
    existing = await db.execute(
        select(QueueSlot).where(QueueSlot.queue_id == queue_id, QueueSlot.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Already in this queue")

    # check capacity
    per_day = max(1, LESSON_MINUTES // queue.slot_minutes)
    count_r = await db.execute(
        select(func.count(QueueSlot.id))
        .where(QueueSlot.queue_id == queue_id, QueueSlot.slot_date == slot_date)
    )
    if count_r.scalar() >= per_day:
        raise HTTPException(409, "Day is full")

    pos_r = await db.execute(
        select(func.max(QueueSlot.position))
        .where(QueueSlot.queue_id == queue_id, QueueSlot.slot_date == slot_date)
    )
    next_pos = (pos_r.scalar() or 0) + 1

    slot = QueueSlot(queue_id=queue_id, user_id=current_user.id, slot_date=slot_date, position=next_pos)
    db.add(slot)
    current_user.points += 5
    await db.flush()
    return {"slot_date": slot_date, "position": next_pos, "points": current_user.points}


@router.post("/{queue_id}/swap")
async def swap_slots(
    queue_id: str,
    data: SwapRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    my_slot_r = await db.execute(
        select(QueueSlot).where(QueueSlot.queue_id == queue_id, QueueSlot.user_id == current_user.id)
    )
    my_slot = my_slot_r.scalar_one_or_none()
    if not my_slot:
        raise HTTPException(400, "You are not in this queue")

    their_slot_r = await db.execute(
        select(QueueSlot).where(QueueSlot.queue_id == queue_id, QueueSlot.user_id == data.target_user_id)
    )
    their_slot = their_slot_r.scalar_one_or_none()
    if not their_slot:
        raise HTTPException(400, "Target user not in this queue")

    # swap dates and positions
    my_slot.slot_date, their_slot.slot_date = their_slot.slot_date, my_slot.slot_date
    my_slot.position, their_slot.position = their_slot.position, my_slot.position
    await db.flush()
    return {"message": "Swapped successfully"}


@router.delete("/{queue_id}", status_code=204)
async def delete_queue(
    queue_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q_r = await db.execute(select(Queue).where(Queue.id == queue_id))
    queue = q_r.scalar_one_or_none()
    if not queue or queue.group_id != current_user.group_id:
        raise HTTPException(404)
    if current_user.role not in ("head", "admin"):
        raise HTTPException(403)
    await db.delete(queue)
