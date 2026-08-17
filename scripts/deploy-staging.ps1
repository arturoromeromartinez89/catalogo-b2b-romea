$ErrorActionPreference = "Stop"

$expectedVercelProject = "catalogo-b2b-staging-security"
$expectedVercelScope = "arturo-romeros-projects-20546c64"
$expectedSupabaseRef = "vafqcvpzksjlrborxoos"

if (-not (Test-Path ".vercel/project.json")) {
  throw "BLOQUEADO: ejecuta primero 'npx vercel link --yes --project $expectedVercelProject'."
}

$vercelProject = Get-Content ".vercel/project.json" -Raw | ConvertFrom-Json
$supabaseRef = (Get-Content "supabase/.temp/project-ref" -Raw).Trim()

if ($vercelProject.projectName -ne $expectedVercelProject) {
  throw "BLOQUEADO: Vercel apunta a $($vercelProject.projectName), no a staging."
}
if ($supabaseRef -ne $expectedSupabaseRef) {
  throw "BLOQUEADO: Supabase apunta a $supabaseRef, no a staging."
}

npm run build:staging
if ($LASTEXITCODE -ne 0) { throw "El build de staging fallo." }

npx vercel --prod --yes --scope $expectedVercelScope
if ($LASTEXITCODE -ne 0) { throw "El despliegue de staging fallo." }

Write-Host "PASS: staging desplegado sin tocar produccion."
