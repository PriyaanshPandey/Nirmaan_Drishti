import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_APP_DIR = BACKEND_DIR / "app"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if str(BACKEND_APP_DIR) not in __path__:
    __path__.insert(0, str(BACKEND_APP_DIR))
