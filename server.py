"""Launch the race radio using Node.js 20+ in GitHub Codespaces."""
import os
from pathlib import Path

os.chdir(Path(__file__).resolve().parent)
os.execlp("node", "node", "local.mjs")
