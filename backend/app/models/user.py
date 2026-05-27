import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String, Text, Boolean, Integer, SmallInteger,
    DateTime, Date, Time, ForeignKey, Enum as SAEnum,
    UniqueConstraint, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base

def now_utc():
    return datetime.now(timezone.utc)

def new_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        SAEnum("admin", "head", "member", name="user_role"), default="member"
    )
    group_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(100))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped[Optional["Group"]] = relationship("Group", back_populates="members", foreign_keys=[group_id])
    hw_assignments: Mapped[List["HomeworkAssignment"]] = relationship("HomeworkAssignment", back_populates="user")
    queue_slots: Mapped[List["QueueSlot"]] = relationship("QueueSlot", back_populates="user")
    poll_votes: Mapped[List["PollVote"]] = relationship("PollVote", back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    members: Mapped[List["User"]] = relationship("User", back_populates="group", foreign_keys=[User.group_id])
    homework: Mapped[List["Homework"]] = relationship("Homework", back_populates="group")
    schedule: Mapped[List["Schedule"]] = relationship("Schedule", back_populates="group")
    queues: Mapped[List["Queue"]] = relationship("Queue", back_populates="group")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="group")
    polls: Mapped[List["Poll"]] = relationship("Poll", back_populates="group")


class Homework(Base):
    __tablename__ = "homework"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped["Group"] = relationship("Group", back_populates="homework")
    assignments: Mapped[List["HomeworkAssignment"]] = relationship("HomeworkAssignment", back_populates="homework", cascade="all, delete-orphan")


class HomeworkAssignment(Base):
    __tablename__ = "homework_assignments"
    __table_args__ = (UniqueConstraint("homework_id", "user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    homework_id: Mapped[str] = mapped_column(String(36), ForeignKey("homework.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    homework: Mapped["Homework"] = relationship("Homework", back_populates="assignments")
    user: Mapped["User"] = relationship("User", back_populates="hw_assignments")


class Schedule(Base):
    __tablename__ = "schedule"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Mon..6=Sun
    time_start: Mapped[str] = mapped_column(String(5), nullable=False)  # "09:00"
    time_end: Mapped[str] = mapped_column(String(5), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(100))
    room: Mapped[Optional[str]] = mapped_column(String(50))
    teacher: Mapped[Optional[str]] = mapped_column(String(100))

    group: Mapped["Group"] = relationship("Group", back_populates="schedule")


class Queue(Base):
    __tablename__ = "queues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(100))
    slot_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=15)
    dates: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # ["2025-06-01", ...]
    auto_distributed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped["Group"] = relationship("Group", back_populates="queues")
    slots: Mapped[List["QueueSlot"]] = relationship("QueueSlot", back_populates="queue", cascade="all, delete-orphan")


class QueueSlot(Base):
    __tablename__ = "queue_slots"
    __table_args__ = (UniqueConstraint("queue_id", "user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    queue_id: Mapped[str] = mapped_column(String(36), ForeignKey("queues.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    slot_date: Mapped[str] = mapped_column(String(10), nullable=False)  # "2025-06-01"
    position: Mapped[Optional[int]] = mapped_column(SmallInteger)

    queue: Mapped["Queue"] = relationship("Queue", back_populates="slots")
    user: Mapped["User"] = relationship("User", back_populates="queue_slots")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        SAEnum("todo", "in_progress", "done", name="task_status"), default="todo"
    )
    priority: Mapped[str] = mapped_column(
        SAEnum("low", "medium", "high", name="task_priority"), default="medium"
    )
    assignee_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    template: Mapped[Optional[str]] = mapped_column(String(100))
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped["Group"] = relationship("Group", back_populates="tasks")
    assignee: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assignee_id])


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    closes_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped["Group"] = relationship("Group", back_populates="polls")
    options: Mapped[List["PollOption"]] = relationship("PollOption", back_populates="poll", cascade="all, delete-orphan")
    votes: Mapped[List["PollVote"]] = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")


class PollOption(Base):
    __tablename__ = "poll_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    poll_id: Mapped[str] = mapped_column(String(36), ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(String(255), nullable=False)

    poll: Mapped["Poll"] = relationship("Poll", back_populates="options")
    votes: Mapped[List["PollVote"]] = relationship("PollVote", back_populates="option")


class PollVote(Base):
    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("poll_id", "user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    poll_id: Mapped[str] = mapped_column(String(36), ForeignKey("polls.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    option_id: Mapped[str] = mapped_column(String(36), ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False)
    voted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    poll: Mapped["Poll"] = relationship("Poll", back_populates="votes")
    user: Mapped["User"] = relationship("User", back_populates="poll_votes")
    option: Mapped["PollOption"] = relationship("PollOption", back_populates="votes")
