"""
FastAPI dependency factories for authentication and role-based authorization.

Usage:
    # Require any authenticated user:
    @router.get("/endpoint")
    def endpoint(current_user: User = Depends(get_current_user)):
        ...

    # Require a specific role:
    @router.post("/impd-only")
    def impd_only(current_user: User = Depends(require_role("impd_officer"))):
        ...

    # Multiple allowed roles:
    @router.get("/staff-only")
    def staff(current_user: User = Depends(require_role("impd_officer", "ministry_officer"))):
        ...
"""
import logging
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.security import decode_token

logger = logging.getLogger(__name__)

# OAuth2 bearer token scheme — tokenUrl points at our login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency: decode JWT and return the corresponding User from the DB.
    Raises HTTP 401 if the token is missing, invalid, or expired.
    Raises HTTP 401 if the user no longer exists or is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError as exc:
        logger.debug(f"JWT decode error: {exc}")
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_role(*roles: str) -> Callable:
    """
    Factory that returns a FastAPI dependency enforcing one of the given roles.

    Example:
        Depends(require_role("impd_officer"))
        Depends(require_role("impd_officer", "ministry_officer"))
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(roles)}.",
            )
        return current_user

    return role_checker


# Convenience pre-built dependencies
require_impd_officer = require_role("impd_officer")
require_any_officer = require_role("impd_officer", "ministry_officer")
