# ============================================================================
# tools/replace.ps1 - PowerShell Wrapper cho Batch Replace CLI
# Cách dùng:
#   .\tools\replace.ps1 -Find "chuỗi_cần_tìm" -Replace "chuỗi_thay_thế"
#   .\tools\replace.ps1 -Find "chuỗi" -Replace "mới" -Write
#   .\tools\replace.ps1 -Rule fix-button-types -Write
# ============================================================================

param (
    [string]$Find,
    [string]$Replace = "",
    [switch]$Regex,
    [string]$Flags = "g",
    [switch]$Write,
    [switch]$DryRun,
    [switch]$Backup,
    [string]$Ext = "js,html,css",
    [string]$Dir = "js,css,tools,.",
    [string]$Rule,
    [switch]$Help
)

$argsList = @()

if ($Help) { $argsList += "--help" }
if ($Find) { $argsList += "-f", $Find }
if ($PSBoundParameters.ContainsKey('Replace')) { $argsList += "-r", $Replace }
if ($Regex) { $argsList += "-e" }
if ($Flags) { $argsList += "--flags", $Flags }
if ($Write) { $argsList += "--write" }
if ($DryRun) { $argsList += "--dry-run" }
if ($Backup) { $argsList += "--backup" }
if ($Ext) { $argsList += "-x", $Ext }
if ($Dir) { $argsList += "-d", $Dir }
if ($Rule) { $argsList += "--rule", $Rule }

node (Join-Path $PSScriptRoot "batch-replace.js") @argsList

