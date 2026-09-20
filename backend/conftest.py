"""Make the backend's flat modules (models, orchestrator, prompts, ...) importable
from tests/ regardless of how pytest is invoked."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
