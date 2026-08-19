$ErrorActionPreference = "Continue"

Write-Host "🩺 Gemstack Doctor"

# Git check
try {
    $gitVer = git --version 2>$null
    if ($gitVer -match "git version") { Write-Host "✅ Git instalado" } else { Write-Host "❌ Git no instalado"; exit 1 }
} catch {
    Write-Host "❌ Git no instalado"
    exit 1
}

if (Test-Path ".git") { Write-Host "✅ Repositorio Git detectado" } else { Write-Host "❌ No es un repositorio Git"; exit 1 }
if (Test-Path ".agents/rules") { Write-Host "✅ .agents/rules existe" } else { Write-Host "❌ Falta .agents/rules"; exit 1 }
if (Test-Path ".agents/skills") { Write-Host "✅ .agents/skills existe" } else { Write-Host "❌ Falta .agents/skills"; exit 1 }
if (Test-Path ".gemstack") { Write-Host "✅ .gemstack existe" } else { Write-Host "❌ Falta .gemstack"; exit 1 }
if (Test-Path "specs/current") { Write-Host "✅ specs/current existe" } else { Write-Host "❌ Falta specs/current"; exit 1 }

if (Test-Path "handoff.md") { Write-Host "✅ handoff.md existe" } else { New-Item -ItemType File -Path "handoff.md" | Out-Null; Write-Host "✅ handoff.md creado" }
if (Test-Path "handoff_archive.md") { Write-Host "✅ handoff_archive.md existe" } else { New-Item -ItemType File -Path "handoff_archive.md" | Out-Null; Write-Host "✅ handoff_archive.md creado" }

# Node
try {
    $nodeVer = node -v 2>$null
    if ($nodeVer -match "v") { Write-Host "✅ Node detectado" } else { Write-Host "⚠️ Node no detectado (opcional)" }
} catch {
    Write-Host "⚠️ Node no detectado (opcional)"
}

# PowerShell
Write-Host "✅ PowerShell funcional"

Write-Host "💡 Antigravity Browser nativo: Usa /browser en Antigravity, o instala Playwright si ejecutas headless."
Write-Host "✅ Diagnóstico completado."
