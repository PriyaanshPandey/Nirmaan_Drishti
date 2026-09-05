import sys
import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_APP_DIR = BACKEND_DIR / "app"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

spec = importlib.util.spec_from_file_location("backend_app_main", str(BACKEND_APP_DIR / "main.py"))
backend_main = importlib.util.module_from_spec(spec)
sys.modules["backend_app_main"] = backend_main
spec.loader.exec_module(backend_main)

app = backend_main.app
