#!/bin/sh
# Set git to use the project's .githooks directory for hooks
if [ -d ".githooks" ]; then
  git config core.hooksPath .githooks
  echo "Configured git hooks path to .githooks"
else
  echo ".githooks directory not found"
  exit 1
fi
