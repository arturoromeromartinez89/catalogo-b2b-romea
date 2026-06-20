$ErrorActionPreference = "Stop"
$expectedRef = "vafqcvpzksjlrborxoos"
$linkedRef = (Get-Content "supabase/.temp/project-ref" -Raw).Trim()

if ($linkedRef -ne $expectedRef) {
  throw "BLOQUEADO: seed-staging solo puede ejecutarse en $expectedRef; actual: $linkedRef"
}

npx supabase db query --linked --file supabase/staging/seed_demo.sql
if ($LASTEXITCODE -ne 0) { throw "No se pudo cargar el seed de staging." }

Write-Host "PASS: datos ficticios cargados exclusivamente en staging."
