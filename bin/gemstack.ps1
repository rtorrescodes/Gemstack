param(
    [string]$Command = "",
    [string]$Arg1 = ""
)

$ErrorActionPreference = "Stop"

switch ($Command) {
    "init" {
        Write-Host "[INIT] Iniciando Gemstack v0.1..."
        New-Item -ItemType Directory -Force -Path ".agents/rules", ".agents/skills", ".gemstack", "specs/current", "specs/templates", "docs", "bin" | Out-Null
        Write-Host "[OK] Estructura creada."
    }
    "list" {
        Write-Host "[LIST] Skills instalados:"
        Get-ChildItem -Path ".agents/skills" -Directory | Select-Object -ExpandProperty Name
    }
    "show" {
        if (-not [string]::IsNullOrWhiteSpace($Arg1)) {
            $path = ".agents/skills\$Arg1\SKILL.md"
            if (Test-Path $path) {
                Get-Content $path
            } else {
                Write-Host "[ERROR] Skill no encontrado: $Arg1"
            }
        } else {
            Write-Host "[ERROR] Debes especificar un skill."
        }
    }
    "doctor" {
        & (Join-Path $PSScriptRoot "gemstack-doctor.ps1")
    }
    "handoff" {
        if (Test-Path "handoff.md") {
            Get-Content "handoff.md"
        } else {
            Write-Host "[ERROR] handoff.md no existe aun."
        }
    }
    "security-audit" {
        Write-Host "[INFO] Para correr un audit real, invoca /cso en tu chat con Antigravity."
    }
    default {
        Write-Host "Uso: .\bin\gemstack.ps1 {init|list|show <skill>|doctor|handoff|security-audit}"
    }
}
