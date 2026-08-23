#!/bin/bash
# Hook PostToolUse (Edit|Write): comprueba Prettier y ESLint sobre el fichero
# recién editado. El CI exige --max-warnings 0, así que cualquier aviso se
# devuelve a Claude (exit 2) para corregirlo antes de seguir.

file=$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input.file_path||'')}catch{}})")

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Solo TypeScript del propio proyecto; nunca generados ni dependencias.
case "$file" in
  "$root"/*.ts | "$root"/*.tsx) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/* | */dist/* | */lib/* | *"/Security Assessment/"*) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "$root" || exit 0

if ! out=$(npx prettier --check "$file" 2>&1); then
  echo "Prettier: '$file' no está formateado. Ejecuta: npx prettier --write \"$file\"" >&2
  exit 2
fi

# ESLint con la configuración del workspace al que pertenece el fichero.
# Se pasa la ruta RELATIVA al workspace: una ruta absoluta cae fuera del
# base path de la config flat y ESLint la ignora con un warning espurio.
case "$file" in
  "$root"/apps/web/*) wd="$root/apps/web" ;;
  "$root"/functions/*) wd="$root/functions" ;;
  *) wd="$root" ;;
esac
cd "$wd" || exit 0
rel="${file#"$wd"/}"

if ! out=$(npx eslint --max-warnings 0 "$rel" 2>&1); then
  echo "ESLint ha fallado en '$file':" >&2
  echo "$out" >&2
  exit 2
fi

exit 0
