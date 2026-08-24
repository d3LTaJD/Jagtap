import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_EXTRACTOR_PORT", 8001))
    print(f"[*] Starting Petro Valves Document Extractor on http://127.0.0.1:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
