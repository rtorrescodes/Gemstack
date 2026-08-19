[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$ErrorActionPreference = "Continue"

Write-Host "[INFO] Gemstack Doctor"

# Git check
try {
    $gitVer = git --version 2>$null
    if ($gitVer -match "git version") { Write-Host "[OK] Git instalado" } else { Write-Host "[ERROR] Git no instalado"; exit 1 }
} catch {
    Write-Host "[ERROR] Git no instalado"
    exit 1
}

if (Test-Path ".git") { Write-Host "[OK] Repositorio Git detectado" } else { Write-Host "[ERROR] No es un repositorio Git"; exit 1 }
if (Test-Path ".agents/rules") { Write-Host "[OK] .agents/rules existe" } else { Write-Host "[ERROR] Falta .agents/rules"; exit 1 }
if (Test-Path ".agents/skills") { Write-Host "[OK] .agents/skills existe" } else { Write-Host "[ERROR] Falta .agents/skills"; exit 1 }
if (Test-Path ".gemstack") { Write-Host "[OK] .gemstack existe" } else { Write-Host "[ERROR] Falta .gemstack"; exit 1 }
if (Test-Path "specs/current") { Write-Host "[OK] specs/current existe" } else { Write-Host "[ERROR] Falta specs/current"; exit 1 }

if (Test-Path "handoff.md") { Write-Host "[OK] handoff.md existe" } else { New-Item -ItemType File -Path "handoff.md" | Out-Null; Write-Host "[OK] handoff.md creado" }
if (Test-Path "handoff_archive.md") { Write-Host "[OK] handoff_archive.md existe" } else { New-Item -ItemType File -Path "handoff_archive.md" | Out-Null; Write-Host "[OK] handoff_archive.md creado" }

# Node
try {
    $nodeVer = node -v 2>$null
    if ($nodeVer -match "v") { Write-Host "[OK] Node detectado" } else { Write-Host "[WARN] Node no detectado (opcional)" }
} catch {
    Write-Host "[WARN] Node no detectado (opcional)"
}

# PowerShell
Write-Host "[OK] PowerShell funcional"

Write-Host "[INFO] Antigravity Browser nativo: Usa /browser en Antigravity, o instala Playwright si ejecutas headless."
Write-Host "[OK] Diagnostico completado."
