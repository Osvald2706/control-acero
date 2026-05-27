from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password_hash = Column(String(100))
    name = Column(String(100))
    role = Column(String(20), default="admin")
    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")


class Token(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    user = relationship("User", back_populates="tokens")


class SteelType(Base):
    __tablename__ = "steel_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, index=True)


class Movement(Base):
    __tablename__ = "movements"
    id = Column(Integer, primary_key=True, index=True)
    steel_type_id = Column(Integer, ForeignKey("steel_types.id"))
    movement_type = Column(String(20))
    quantity = Column(Integer)
    person_name = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    registered_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    steel_type = relationship("SteelType")
    user = relationship("User", foreign_keys=[registered_by])
