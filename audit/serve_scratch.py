import sys; sys.path.insert(0, "."); import database; from pathlib import Path
database.DB_PATH = Path("../audit/raw/browser2.db")
import uvicorn, main; uvicorn.run(main.app, port=8000, log_level="warning")
