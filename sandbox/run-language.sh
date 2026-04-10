#!/bin/bash
# run-language.sh — Executes code in the correct language runtime.
# Usage: ./run-language.sh <language> <file> [input]

set -e

LANGUAGE="$1"
FILE="$2"
INPUT="$3"

case "$LANGUAGE" in
  python)
    echo "$INPUT" | python3 "$FILE"
    ;;
  javascript)
    echo "$INPUT" | node "$FILE"
    ;;
  typescript)
    echo "$INPUT" | node "$FILE"
    ;;
  java)
    # Extract class name from file
    CLASS_NAME=$(basename "$FILE" .java)
    DIR=$(dirname "$FILE")
    javac "$FILE"
    echo "$INPUT" | java -cp "$DIR" "$CLASS_NAME"
    ;;
  go)
    echo "$INPUT" | go run "$FILE"
    ;;
  cpp)
    OUTFILE="/tmp/solution_$(basename "$FILE" .cpp)"
    g++ -O2 -o "$OUTFILE" "$FILE"
    echo "$INPUT" | "$OUTFILE"
    rm -f "$OUTFILE"
    ;;
  rust)
    OUTFILE="/tmp/solution_$(basename "$FILE" .rs)"
    rustc -o "$OUTFILE" "$FILE" 2>&1
    echo "$INPUT" | "$OUTFILE"
    rm -f "$OUTFILE"
    ;;
  *)
    echo "Unsupported language: $LANGUAGE" >&2
    exit 1
    ;;
esac
