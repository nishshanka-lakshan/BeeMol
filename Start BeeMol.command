#!/bin/zsh
# Double-click this file on macOS to start the local AI backend.
cd -- "${0:A:h}" || exit 1
if [[ -z "$BEEMOL_MODEL_API_KEY" ]]; then
    read -s "BEEMOL_MODEL_API_KEY?Gemini API key (optional for geometry; press Enter to skip): "
    export BEEMOL_MODEL_API_KEY
    echo
fi
if [[ -x .venv/bin/python ]]; then
    .venv/bin/python ai/backend/server.py
else
    python3 ai/backend/server.py
fi
echo
read "?Backend stopped. Press Enter to close."
