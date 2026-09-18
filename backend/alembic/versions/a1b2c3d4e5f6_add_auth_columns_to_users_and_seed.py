"""add_auth_columns_to_users_and_seed

Revision ID: a1b2c3d4e5f6
Revises: f50e78d20323
Create Date: 2026-09-18 23:32:00.000000

Adds authentication columns to the existing users table:
  - username (unique, indexed)
  - password_hash
  - full_name
  - is_active

Then seeds the four initial prototype users with bcrypt-hashed passwords.
"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f50e78d20323'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add new columns to users table ────────────────────────────────────
    op.add_column('users', sa.Column('username', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('full_name', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))

    # ── 2. Make existing legacy columns nullable (they were NOT NULL in original) ──
    op.alter_column('users', 'name', existing_type=sa.String(length=255), nullable=True)

    # ── 3. Create unique index on username ───────────────────────────────────
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    # ── 4. Seed the four prototype users with bcrypt-hashed passwords ─────────
    # Password "12345678" hashed with bcrypt cost=12 using the bcrypt library directly:
    HASH_12345678 = "$2b$12$4qBKbwDorUUN0jEi5iwEK.h98.DslZg.j5LlDApaasppGpPcFnkru"

    users_table = table(
        'users',
        column('name', sa.String),
        column('username', sa.String),
        column('password_hash', sa.String),
        column('role', sa.String),
        column('full_name', sa.String),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )

    now = datetime.utcnow()

    op.bulk_insert(users_table, [
        {
            'name': 'IMPD Officer A',
            'username': 'vky2002',
            'password_hash': HASH_12345678,
            'role': 'impd_officer',
            'full_name': 'IMPD Officer A',
            'is_active': True,
            'created_at': now,
            'updated_at': now,
        },
        {
            'name': 'IMPD Officer B',
            'username': 'vky2003',
            'password_hash': HASH_12345678,
            'role': 'impd_officer',
            'full_name': 'IMPD Officer B',
            'is_active': True,
            'created_at': now,
            'updated_at': now,
        },
        {
            'name': 'Ministry Officer A',
            'username': 'vky2004',
            'password_hash': HASH_12345678,
            'role': 'ministry_officer',
            'full_name': 'Ministry Officer A',
            'is_active': True,
            'created_at': now,
            'updated_at': now,
        },
        {
            'name': 'Ministry Officer B',
            'username': 'vky2005',
            'password_hash': HASH_12345678,
            'role': 'ministry_officer',
            'full_name': 'Ministry Officer B',
            'is_active': True,
            'created_at': now,
            'updated_at': now,
        },
    ])


def downgrade() -> None:
    # Remove seeded users by username
    op.execute(
        "DELETE FROM users WHERE username IN ('vky2002', 'vky2003', 'vky2004', 'vky2005')"
    )
    op.drop_index('ix_users_username', table_name='users')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'username')
    # Restore name column NOT NULL
    op.alter_column('users', 'name', existing_type=sa.String(length=255), nullable=False)
