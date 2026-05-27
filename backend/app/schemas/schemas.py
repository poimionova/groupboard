from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


# ─── Auth ───
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    role: str
    group_id: Optional[str]
    avatar_url: Optional[str]
    points: int
    created_at: datetime
    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ─── Groups ───
class GroupCreate(BaseModel):
    name: str

class GroupOut(BaseModel):
    id: str
    name: str
    invite_code: str
    created_by: Optional[str]
    created_at: datetime
    member_count: Optional[int] = 0
    model_config = {"from_attributes": True}

class JoinGroup(BaseModel):
    invite_code: str


# ─── Homework ───
class HomeworkCreate(BaseModel):
    title: str
    subject: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None

class HomeworkOut(BaseModel):
    id: str
    group_id: str
    title: str
    subject: Optional[str]
    description: Optional[str]
    deadline: datetime
    file_url: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    completion_count: Optional[int] = 0
    total_members: Optional[int] = 0
    is_completed_by_me: Optional[bool] = False
    model_config = {"from_attributes": True}


# ─── Schedule ───
class ScheduleCreate(BaseModel):
    weekday: int  # 0=Mon..6=Sun
    time_start: str
    time_end: str
    subject: Optional[str] = None
    room: Optional[str] = None
    teacher: Optional[str] = None

class ScheduleOut(BaseModel):
    id: str
    group_id: str
    weekday: int
    time_start: str
    time_end: str
    subject: Optional[str]
    room: Optional[str]
    teacher: Optional[str]
    model_config = {"from_attributes": True}


# ─── Queue ───
class QueueCreate(BaseModel):
    subject: Optional[str] = None
    slot_minutes: int = 15
    dates: List[str]  # ["2025-06-01", ...]
    auto_distribute: bool = False

class QueueSlotOut(BaseModel):
    id: str
    queue_id: str
    user_id: str
    slot_date: str
    position: Optional[int]
    user: Optional[UserOut] = None
    model_config = {"from_attributes": True}

class QueueOut(BaseModel):
    id: str
    group_id: str
    subject: Optional[str]
    slot_minutes: int
    dates: list
    auto_distributed: bool
    created_by: Optional[str]
    created_at: datetime
    slots: List[QueueSlotOut] = []
    model_config = {"from_attributes": True}

class SwapRequest(BaseModel):
    target_user_id: str


# ─── Tasks ───
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    assignee_id: Optional[str] = None
    template: Optional[str] = None
    deadline: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    deadline: Optional[datetime] = None

class TaskOut(BaseModel):
    id: str
    group_id: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    assignee_id: Optional[str]
    assignee: Optional[UserOut] = None
    template: Optional[str]
    deadline: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Polls ───
class PollOptionCreate(BaseModel):
    text: str

class PollCreate(BaseModel):
    question: str
    options: List[PollOptionCreate]
    is_anonymous: bool = False
    closes_at: Optional[datetime] = None

class PollOptionOut(BaseModel):
    id: str
    text: str
    votes: int = 0
    model_config = {"from_attributes": True}

class PollOut(BaseModel):
    id: str
    group_id: str
    question: str
    is_anonymous: bool
    closes_at: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    options: List[PollOptionOut] = []
    total_votes: int = 0
    my_vote: Optional[str] = None
    model_config = {"from_attributes": True}

class VoteCreate(BaseModel):
    option_id: str


# ─── Stats ───
class DashboardStats(BaseModel):
    total_members: int
    hw_completion_rate: float
    tasks_by_status: dict
    top_students: List[UserOut]
    upcoming_deadlines: List[HomeworkOut]
    recent_activity: List[dict]
