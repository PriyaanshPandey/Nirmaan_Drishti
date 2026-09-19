"""
Seed Script: Create four initial auth users for Nirmaan Drishti prototype.

Usage (from backend/ directory):
    python -m scripts.seed_users

Idempotent: skips users that already exist.
Passwords are bcrypt-hashed — never stored as plaintext.
"""
import sys
import os

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.database import SessionLocal
from app.models.user import User
from app.auth.security import hash_password


SEED_USERS = [
    {
        "username": "admin",
        "password": "12345678",
        "role": "impd_officer",
        "full_name": "System Administrator",
        "name": "System Administrator",
    },
    {
        "username": "vky2002",
        "password": "12345678",
        "role": "impd_officer",
        "full_name": "IMPD Officer A",
        "name": "IMPD Officer A",
    },

    {
        "username": "vky2003",
        "password": "12345678",
        "role": "impd_officer",
        "full_name": "IMPD Officer B",
        "name": "IMPD Officer B",
    },
    {
        "username": "vky2004",
        "password": "12345678",
        "role": "ministry_officer",
        "full_name": "Ministry Officer A",
        "name": "Ministry Officer A",
    },
    {
        "username": "vky2005",
        "password": "12345678",
        "role": "ministry_officer",
        "full_name": "Ministry Officer B",
        "name": "Ministry Officer B",
    },
]


def seed_users():
    db = SessionLocal()
    try:
        created = 0
        skipped = 0
        for u in SEED_USERS:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if existing:
                print(f"  [SKIP] {u['username']} already exists.")
                skipped += 1
                continue

            user = User(
                username=u["username"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                full_name=u["full_name"],
                name=u["name"],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)
            print(f"  [CREATE] {u['username']} ({u['role']})")
            created += 1

        db.commit()
        print(f"\nDone. Created: {created}, Skipped: {skipped}")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding Nirmaan Drishti auth users...")
    seed_users()
