"""
Authentication API Router.
Provides login (JWT issuance), logout acknowledgement, and current-user info.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.security import verify_password, create_access_token
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    username: str


class UserMeResponse(BaseModel):
    id: int
    username: str
    role: str
    full_name: str

    class Config:
        from_attributes = True


class LogoutResponse(BaseModel):
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Obtain a JWT access token",
    description=(
        "Accepts username + password. Returns a signed JWT and the user's role. "
        "Do NOT reveal whether a specific username exists — always return the same error."
    )
)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Authenticate a user and return a JWT.
    Deliberate constant-time response: always 401 with the same message for bad credentials.
    """
    # Generic error used for both bad username AND bad password (no enumeration)
    auth_failed = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.query(User).filter(User.username == request.username).first()

    if user is None or not user.password_hash:
        # Still call verify_password with a dummy hash to prevent timing attacks
        verify_password("dummy", "$2b$12$irrelevanthashtopreventtimingattacks00000000000000000000")
        raise auth_failed

    if not user.is_active:
        raise auth_failed

    if not verify_password(request.password, user.password_hash):
        raise auth_failed

    token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role,
            "user_id": user.id,
        }
    )

    logger.info(f"Successful login: username={user.username} role={user.role}")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        full_name=user.full_name or user.username,
        username=user.username,
    )


@router.post(
    "/login/form",
    response_model=TokenResponse,
    summary="OAuth2 form-based login (for /docs Authorize button)",
    include_in_schema=True,
)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """OAuth2 password grant — used by FastAPI /docs swagger UI."""
    from app.routes.auth import login as _login
    from app.routes.auth import LoginRequest as _LR
    return _login(request=_LR(username=form_data.username, password=form_data.password), db=db)


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get current authenticated user info",
)
def get_me(current_user: User = Depends(get_current_user)) -> UserMeResponse:
    """Return the current user's public profile. Validates the JWT is still valid."""
    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        full_name=current_user.full_name or current_user.username,
    )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout (stateless acknowledgement)",
)
def logout(current_user: User = Depends(get_current_user)) -> LogoutResponse:
    """
    Stateless JWT logout. The client must discard its token.
    Server-side token blacklisting is not implemented in this version.
    """
    logger.info(f"Logout: username={current_user.username}")
    return LogoutResponse(message="Logged out successfully.")
