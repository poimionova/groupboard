from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.user import User, Schedule, Task, Poll, PollOption, PollVote, Homework, HomeworkAssignment
from app.schemas.schemas import (
    ScheduleCreate, ScheduleOut,
    TaskCreate, TaskUpdate, TaskOut,
    PollCreate, PollOut, PollOptionOut, VoteCreate,
    DashboardStats, HomeworkOut, UserOut
)
from app.core.security import get_current_user
from datetime import datetime, timezone

# ─── Schedule ───
schedule_router = APIRouter(prefix="/schedule", tags=["schedule"])

@schedule_router.get("", response_model=list[ScheduleOut])
async def get_schedule(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400, "Join a group first")
    r = await db.execute(
        select(Schedule).where(Schedule.group_id == current_user.group_id).order_by(Schedule.weekday, Schedule.time_start)
    )
    return r.scalars().all()

@schedule_router.post("", response_model=ScheduleOut, status_code=201)
async def create_schedule(data: ScheduleCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    if current_user.role not in ("head", "admin"):
        raise HTTPException(403)
    item = Schedule(group_id=current_user.group_id, **data.model_dump())
    db.add(item)
    await db.flush()
    return item

@schedule_router.delete("/{item_id}", status_code=204)
async def delete_schedule(item_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Schedule).where(Schedule.id == item_id))
    item = r.scalar_one_or_none()
    if not item or item.group_id != current_user.group_id:
        raise HTTPException(404)
    if current_user.role not in ("head", "admin"):
        raise HTTPException(403)
    await db.delete(item)


# ─── Tasks ───
tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])

TASK_TEMPLATES = [
    "Договориться о зачёте",
    "Отправить список группы",
    "Собрать деньги на подарок",
    "Подать заявление",
    "Договориться о переносе пары",
    "Организовать встречу",
    "Сдать документы",
]

@tasks_router.get("/templates")
async def get_templates():
    return TASK_TEMPLATES

@tasks_router.get("", response_model=list[TaskOut])
async def list_tasks(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    r = await db.execute(
        select(Task).where(Task.group_id == current_user.group_id).order_by(Task.created_at.desc())
    )
    tasks = r.scalars().all()
    out = []
    for t in tasks:
        assignee = None
        if t.assignee_id:
            ar = await db.execute(select(User).where(User.id == t.assignee_id))
            assignee = ar.scalar_one_or_none()
        out.append(TaskOut(
            id=t.id, group_id=t.group_id, title=t.title, description=t.description,
            status=t.status, priority=t.priority, assignee_id=t.assignee_id,
            assignee=assignee, template=t.template, deadline=t.deadline,
            created_by=t.created_by, created_at=t.created_at
        ))
    return out

@tasks_router.post("", response_model=TaskOut, status_code=201)
async def create_task(data: TaskCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    task = Task(group_id=current_user.group_id, created_by=current_user.id, **data.model_dump())
    db.add(task)
    await db.flush()
    return TaskOut(
        id=task.id, group_id=task.group_id, title=task.title, description=task.description,
        status=task.status, priority=task.priority, assignee_id=task.assignee_id,
        template=task.template, deadline=task.deadline, created_by=task.created_by, created_at=task.created_at
    )

@tasks_router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, data: TaskUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Task).where(Task.id == task_id))
    task = r.scalar_one_or_none()
    if not task or task.group_id != current_user.group_id:
        raise HTTPException(404)
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(task, field, val)
    # award points when moved to done
    if data.status == "done" and task.assignee_id:
        ur = await db.execute(select(User).where(User.id == task.assignee_id))
        u = ur.scalar_one_or_none()
        if u:
            u.points += 15
    await db.flush()
    return TaskOut(
        id=task.id, group_id=task.group_id, title=task.title, description=task.description,
        status=task.status, priority=task.priority, assignee_id=task.assignee_id,
        template=task.template, deadline=task.deadline, created_by=task.created_by, created_at=task.created_at
    )

@tasks_router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Task).where(Task.id == task_id))
    task = r.scalar_one_or_none()
    if not task or task.group_id != current_user.group_id:
        raise HTTPException(404)
    await db.delete(task)


# ─── Polls ───
polls_router = APIRouter(prefix="/polls", tags=["polls"])

@polls_router.get("", response_model=list[PollOut])
async def list_polls(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    r = await db.execute(
        select(Poll).where(Poll.group_id == current_user.group_id).order_by(Poll.created_at.desc())
    )
    polls = r.scalars().all()
    out = []
    for p in polls:
        opts_r = await db.execute(select(PollOption).where(PollOption.poll_id == p.id))
        options = opts_r.scalars().all()
        votes_count_r = await db.execute(select(func.count(PollVote.id)).where(PollVote.poll_id == p.id))
        total = votes_count_r.scalar()
        my_vote_r = await db.execute(
            select(PollVote).where(PollVote.poll_id == p.id, PollVote.user_id == current_user.id)
        )
        mv = my_vote_r.scalar_one_or_none()

        opt_outs = []
        for opt in options:
            vc = await db.execute(select(func.count(PollVote.id)).where(PollVote.option_id == opt.id))
            opt_outs.append(PollOptionOut(id=opt.id, text=opt.text, votes=vc.scalar()))

        out.append(PollOut(
            id=p.id, group_id=p.group_id, question=p.question,
            is_anonymous=p.is_anonymous, closes_at=p.closes_at,
            created_by=p.created_by, created_at=p.created_at,
            options=opt_outs, total_votes=total,
            my_vote=mv.option_id if mv else None
        ))
    return out

@polls_router.post("", response_model=PollOut, status_code=201)
async def create_poll(data: PollCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    poll = Poll(
        group_id=current_user.group_id, question=data.question,
        is_anonymous=data.is_anonymous, closes_at=data.closes_at,
        created_by=current_user.id
    )
    db.add(poll)
    await db.flush()
    for opt in data.options:
        db.add(PollOption(poll_id=poll.id, text=opt.text))
    await db.flush()
    return PollOut(
        id=poll.id, group_id=poll.group_id, question=poll.question,
        is_anonymous=poll.is_anonymous, closes_at=poll.closes_at,
        created_by=poll.created_by, created_at=poll.created_at,
        options=[PollOptionOut(id="", text=o.text, votes=0) for o in data.options]
    )

@polls_router.post("/{poll_id}/vote")
async def vote(poll_id: str, data: VoteCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pr = await db.execute(select(Poll).where(Poll.id == poll_id))
    poll = pr.scalar_one_or_none()
    if not poll or poll.group_id != current_user.group_id:
        raise HTTPException(404)
    if poll.closes_at and poll.closes_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Poll is closed")
    existing = await db.execute(
        select(PollVote).where(PollVote.poll_id == poll_id, PollVote.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Already voted")
    vote_obj = PollVote(poll_id=poll_id, user_id=current_user.id, option_id=data.option_id)
    db.add(vote_obj)
    current_user.points += 2
    await db.flush()
    return {"message": "Vote recorded", "points": current_user.points}


# ─── Stats / Dashboard ───
stats_router = APIRouter(prefix="/stats", tags=["stats"])

@stats_router.get("/dashboard")
async def dashboard(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user.group_id:
        raise HTTPException(400)
    gid = current_user.group_id

    # member count
    mc = await db.execute(select(func.count(User.id)).where(User.group_id == gid))
    total_members = mc.scalar()

    # hw completion
    hw_r = await db.execute(select(Homework).where(Homework.group_id == gid))
    hws = hw_r.scalars().all()
    total_possible = len(hws) * total_members
    if total_possible > 0:
        done_r = await db.execute(
            select(func.count(HomeworkAssignment.id))
            .join(Homework, HomeworkAssignment.homework_id == Homework.id)
            .where(Homework.group_id == gid, HomeworkAssignment.completed == True)
        )
        hw_rate = round(done_r.scalar() / total_possible * 100, 1)
    else:
        hw_rate = 0.0

    # tasks by status
    for_status = {}
    for st in ("todo", "in_progress", "done"):
        sr = await db.execute(select(func.count(Task.id)).where(Task.group_id == gid, Task.status == st))
        for_status[st] = sr.scalar()

    # top students
    top_r = await db.execute(
        select(User).where(User.group_id == gid).order_by(User.points.desc()).limit(5)
    )
    top = top_r.scalars().all()

    # upcoming deadlines (next 7 days)
    now = datetime.now(timezone.utc)
    upcoming_r = await db.execute(
        select(Homework)
        .where(Homework.group_id == gid, Homework.deadline >= now)
        .order_by(Homework.deadline.asc())
        .limit(5)
    )
    upcoming = upcoming_r.scalars().all()

    return {
        "total_members": total_members,
        "hw_completion_rate": hw_rate,
        "tasks_by_status": for_status,
        "top_students": [
            {"id": u.id, "username": u.username, "full_name": u.full_name, "points": u.points, "avatar_url": u.avatar_url}
            for u in top
        ],
        "upcoming_deadlines": [
            {"id": h.id, "title": h.title, "subject": h.subject, "deadline": h.deadline.isoformat()}
            for h in upcoming
        ],
    }
