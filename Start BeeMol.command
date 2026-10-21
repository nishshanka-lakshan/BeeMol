#!/bin/zsh
# Double-click this file on macOS to start the local AI backend.
cd -- "${0:A:h}" || exit 1
if [[ -z "$BEEMOL_MODEL_API_KEY" ]]; then
    read -s "BEEMOL_MODEL_API_KEY?Gemini API key (hidden, not saved): "
    export BEEMOL_MODEL_API_KEY
    echo
fi
python3 ai/backend/server.py
echo
read "?Backend stopped. Press Enter to close."
