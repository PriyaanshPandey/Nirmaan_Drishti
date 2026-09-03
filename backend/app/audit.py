"""
Audit logging helper module.
Records database changes and administrative actions.
"""
from typing import Optional, Any
from sqlalchemy.orm import Session
import json


def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[int] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    ip_address: Optional[str] = None
) -> None:
    """
    Log an audit event to the audit_logs table.
    """
    try:
        from app.models.audit_log import AuditLog
        
        # Format JSON payloads if dict/list
        old_val_json = old_value if isinstance(old_value, (dict, list)) else ({"value": old_value} if old_value is not None else None)
        new_val_json = new_value if isinstance(new_value, (dict, list)) else ({"value": new_value} if new_value is not None else None)

        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            old_value=old_val_json,
            new_value=new_val_json,
            ip_address=ip_address
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        print(f"Failed to record audit log: {e}")
        db.rollback()
