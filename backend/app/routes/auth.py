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
)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Demo login endpoint: validates ipmd001/ipmd123 and goi001/goi123 credentials and issues a signed JWT token.
    """
    clean_username = request.username.strip().lower() if request.username else ""
    clean_password = request.password.strip() if request.password else ""

    allowed_users = {
        "mospi001": ("mospi123", "mospi_officer", "MoSPI Superadmin (Full Access)"),
        "ipmd001": ("ipmd123", "mospi_officer", "MoSPI Superadmin (Full Access)"),
        "agn001": ("agn123", "agency_officer", "Agency Nodal Officer (NHAI Focus)"),
        "min001": ("min123", "ministry_officer", "Ministry Nodal Officer (MoRTH Focus)"),
        "goi001": ("goi123", "ministry_officer", "Ministry Nodal Officer (MoRTH Focus)"),
    }

    if clean_username in allowed_users:
        expected_pass, role, full_name = allowed_users[clean_username]
        if clean_password == expected_pass:
            user_id = 1 if role == "mospi_officer" else (2 if role == "agency_officer" else 3)
            token = create_access_token(
                data={
                    "sub": clean_username,
                    "role": role,
                    "user_id": user_id,
                }
            )
            logger.info(f"Successful login: username={clean_username} role={role}")
            return TokenResponse(
                access_token=token,
                token_type="bearer",
                role=role,
                full_name=full_name,
                username=clean_username,
            )

    logger.warning(f"Auth failed for username={clean_username}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password.",
        headers={"WWW-Authenticate": "Bearer"},
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
