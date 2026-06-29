$ErrorActionPreference = "Stop"

$expectedVercelProject = "catalogo-b2b-staging-security"
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

$envFile = ".env.staging.local"
npx vercel env pull $envFile --yes --environment=production
if ($LASTEXITCODE -ne 0) { throw "No se pudieron descargar variables de Vercel staging." }

Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
  $key, $value = $_ -split "=", 2
  $value = $value.Trim().Trim('"').Trim("'")
  [Environment]::SetEnvironmentVariable($key.Trim(), $value, "Process")
}

node scripts/check-environment.mjs staging
if ($LASTEXITCODE -ne 0) { throw "Las variables de staging no pasan la verificacion." }

npm run build:staging
if ($LASTEXITCODE -ne 0) { throw "El build de staging fallo." }

npx vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw "El despliegue de staging fallo." }

Write-Host "PASS: staging desplegado sin tocar produccion."
