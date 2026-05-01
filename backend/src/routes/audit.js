'use strict';
const router     = require('express').Router();
const { exec }   = require('child_process');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { AuditReport } = require('../models');
const logger     = require('../utils/logger');

// ─── PowerShell audit script generator ────────────────────────────────────────
function buildAuditScript(hostname, username, password) {
  // All special characters escaped; script runs inside Invoke-Command block
  return `
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$hostname = '${hostname.replace(/'/g, "''")}'
$username = '${username.replace(/'/g, "''")}'
$secPass  = ConvertTo-SecureString '${password.replace(/'/g, "''")}' -AsPlainText -Force
$cred     = New-Object System.Management.Automation.PSCredential($username, $secPass)

$SUSPICIOUS_KEYWORDS  = @('crack','patch','keygen','activator','loader','bypass','pirat','warez','nulled','unlocker','serial','hack')
$PIRACY_TOOLS         = @('KMSpico','AutoKMS','KMSAuto','AAct','HEU KMS','Windows Loader','Re-Loader','KMSOffline','myDigitalLife','Daz','Ratiborus','PiratePC')
$SUSPICIOUS_SERVICES  = @('KMService','KMSELDI','AutoKMS','SppExtComObjPatcher','gvlk','sppsvc_pirate')
$SUSPICIOUS_PROCESSES = @('KMSpico','AutoKMS','KMSAuto','AAct','kmseldi','KMSELDI64','HEU_KMS')

$scriptBlock = {
  param($kw,$pt,$ss,$sp)
  $ErrorActionPreference = 'SilentlyContinue'
  $ProgressPreference    = 'SilentlyContinue'
  $result = [ordered]@{}

  # ── 1. System Info ──────────────────────────────────────────────────────────
  $cs  = Get-CimInstance Win32_ComputerSystem
  $os  = Get-CimInstance Win32_OperatingSystem
  $result['SystemInfo'] = [ordered]@{
    MachineName       = $env:COMPUTERNAME
    Domain            = $cs.Domain
    Manufacturer      = $cs.Manufacturer
    Model             = $cs.Model
    LoggedInUser      = $cs.UserName
    OSName            = $os.Caption
    OSVersion         = $os.Version
    OSBuildNumber     = $os.BuildNumber
    LastBootTime      = $os.LastBootUpTime.ToString('o')
    TotalMemoryGB     = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
    Architecture      = $os.OSArchitecture
  }

  # ── 2. Installed Software ───────────────────────────────────────────────────
  $regPaths = @(
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )
  $software = @()
  foreach ($rp in $regPaths) {
    $items = Get-ItemProperty $rp -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' }
    foreach ($item in $items) {
      $software += [ordered]@{
        Name          = $item.DisplayName
        Version       = $item.DisplayVersion
        Publisher     = $item.Publisher
        InstallDate   = $item.InstallDate
        InstallLocation = $item.InstallLocation
        UninstallString = $item.UninstallString
      }
    }
  }
  $result['InstalledSoftware'] = $software

  # ── 3. Piracy / Crack Detection ─────────────────────────────────────────────
  $flagged = @()
  foreach ($sw in $software) {
    $reasons = @()
    $risk    = 'Low'

    # Missing or suspicious publisher
    if (-not $sw.Publisher -or $sw.Publisher -match '^\s*$') {
      $reasons += 'Missing publisher'
      $risk = 'Medium'
    }
    if ($sw.Publisher -imatch 'unknown|n/a|none') {
      $reasons += 'Unknown publisher'
      $risk = 'Medium'
    }

    # Suspicious keywords in name or install path
    foreach ($kw in $kw) {
      if ($sw.Name -imatch $kw -or $sw.InstallLocation -imatch $kw -or $sw.UninstallString -imatch $kw) {
        $reasons += "Suspicious keyword: $kw"
        $risk = 'High'
      }
    }

    # Known piracy tools
    foreach ($pt in $pt) {
      if ($sw.Name -imatch [regex]::Escape($pt)) {
        $reasons += "Known piracy tool: $pt"
        $risk = 'Critical'
      }
    }

    if ($reasons.Count -gt 0) {
      $flagged += [ordered]@{
        Name     = $sw.Name
        Publisher= $sw.Publisher
        Version  = $sw.Version
        Risk     = $risk
        Reasons  = $reasons
        InstallLocation = $sw.InstallLocation
      }
    }
  }
  $result['FlaggedSoftware'] = $flagged

  # ── 4. Suspicious Services ──────────────────────────────────────────────────
  $suspiciousSvcs = @()
  $allSvcs = Get-Service | Select-Object Name, DisplayName, Status, StartType
  foreach ($svc in $allSvcs) {
    $hit = $false
    foreach ($s in $ss) {
      if ($svc.Name -imatch [regex]::Escape($s) -or $svc.DisplayName -imatch [regex]::Escape($s)) {
        $hit = $true; break
      }
    }
    if ($hit) {
      $suspiciousSvcs += [ordered]@{
        Name        = $svc.Name
        DisplayName = $svc.DisplayName
        Status      = $svc.Status.ToString()
        StartType   = $svc.StartType.ToString()
        Risk        = 'Critical'
        Reason      = 'Known piracy/activation service'
      }
    }
  }

  # Also flag KMS-related services (port 1688 listeners)
  $kmsListeners = Get-NetTCPConnection -LocalPort 1688 -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, State, OwningProcess
  if ($kmsListeners) {
    $suspiciousSvcs += [ordered]@{
      Name        = 'KMS-Listener'
      DisplayName = 'Illegal KMS server (port 1688 open)'
      Status      = 'Running'
      StartType   = 'Unknown'
      Risk        = 'Critical'
      Reason      = 'KMS port 1688 is open locally — may be running illegal KMS server'
    }
  }
  $result['SuspiciousServices'] = $suspiciousSvcs

  # ── 5. Suspicious Processes ─────────────────────────────────────────────────
  $suspiciousProcs = @()
  $procs = Get-Process | Select-Object Id, Name, Path, CPU, WorkingSet
  foreach ($p in $procs) {
    foreach ($s in $sp) {
      if ($p.Name -imatch [regex]::Escape($s)) {
        $suspiciousProcs += [ordered]@{
          PID    = $p.Id
          Name   = $p.Name
          Path   = $p.Path
          CPU    = $p.CPU
          Risk   = 'Critical'
          Reason = "Known piracy/activation process: $s"
        }
        break
      }
    }
  }
  $result['SuspiciousProcesses'] = $suspiciousProcs

  # ── 6. Recent suspicious EXEs (last 30 days) ────────────────────────────────
  $suspiciousExes = @()
  $scanFolders = @('C:\\Program Files','C:\\Program Files (x86)',
                   "$env:USERPROFILE\\Downloads","$env:USERPROFILE\\Desktop")
  $cutoff = (Get-Date).AddDays(-30)
  foreach ($folder in $scanFolders) {
    if (-not (Test-Path $folder)) { continue }
    $exes = Get-ChildItem -Path $folder -Filter '*.exe' -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -gt $cutoff }
    foreach ($exe in $exes) {
      $nameLow = $exe.Name.ToLower()
      $pathLow = $exe.FullName.ToLower()
      foreach ($kw in $kw) {
        if ($nameLow -imatch $kw -or $pathLow -imatch $kw) {
          $suspiciousExes += [ordered]@{
            Name         = $exe.Name
            FullPath     = $exe.FullName
            SizeKB       = [math]::Round($exe.Length / 1KB, 1)
            LastModified = $exe.LastWriteTime.ToString('o')
            Risk         = 'High'
            Keyword      = $kw
          }
          break
        }
      }
    }
  }
  $result['SuspiciousExes'] = $suspiciousExes

  # ── 7. Startup Items ────────────────────────────────────────────────────────
  $startupItems = @()
  $regStartup = @(
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'
  )
  foreach ($rp in $regStartup) {
    $items = Get-ItemProperty $rp -ErrorAction SilentlyContinue
    if ($items) {
      $props = $items.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' }
      foreach ($prop in $props) {
        $val = $prop.Value
        $flagSt = $false
        $reason = ''
        foreach ($kw in $kw) {
          if ($val -imatch $kw -or $prop.Name -imatch $kw) {
            $flagSt = $true; $reason = "Suspicious keyword: $kw"; break
          }
        }
        foreach ($pt in $pt) {
          if ($val -imatch [regex]::Escape($pt) -or $prop.Name -imatch [regex]::Escape($pt)) {
            $flagSt = $true; $reason = "Known piracy tool: $pt"; break
          }
        }
        $startupItems += [ordered]@{
          Key       = $prop.Name
          Value     = $val
          Source    = $rp
          Suspicious= $flagSt
          Reason    = $reason
          Risk      = if ($flagSt) { 'High' } else { 'Low' }
        }
      }
    }
  }

  # Startup folder
  $startupFolders = @(
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp"
  )
  foreach ($sf in $startupFolders) {
    if (Test-Path $sf) {
      Get-ChildItem $sf -ErrorAction SilentlyContinue | ForEach-Object {
        $flagSf = $false; $reasonSf = ''
        $nameLow = $_.Name.ToLower()
        foreach ($kw in $kw) {
          if ($nameLow -imatch $kw) { $flagSf = $true; $reasonSf = "Suspicious keyword: $kw"; break }
        }
        foreach ($pt in $pt) {
          if ($nameLow -imatch [regex]::Escape($pt.ToLower())) { $flagSf = $true; $reasonSf = "Known piracy tool: $pt"; break }
        }
        $startupItems += [ordered]@{
          Key       = $_.Name
          Value     = $_.FullName
          Source    = 'StartupFolder'
          Suspicious= $flagSf
          Reason    = $reasonSf
          Risk      = if ($flagSf) { 'High' } else { 'Low' }
        }
      }
    }
  }
  $result['StartupItems'] = $startupItems

  # ── 8. Scheduled Tasks Audit ────────────────────────────────────────────────
  $suspiciousTasks = @()
  $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Select-Object TaskName, TaskPath, State, Author
  foreach ($task in $tasks) {
    $flagTask = $false; $reasonTask = ''
    foreach ($kw in $kw) {
      if ($task.TaskName -imatch $kw -or $task.TaskPath -imatch $kw) {
        $flagTask = $true; $reasonTask = "Suspicious keyword: $kw"; break
      }
    }
    foreach ($pt in $pt) {
      if ($task.TaskName -imatch [regex]::Escape($pt)) {
        $flagTask = $true; $reasonTask = "Known piracy tool: $pt"; break
      }
    }
    if ($flagTask) {
      $suspiciousTasks += [ordered]@{
        Name   = $task.TaskName
        Path   = $task.TaskPath
        State  = $task.State.ToString()
        Author = $task.Author
        Risk   = 'High'
        Reason = $reasonTask
      }
    }
  }
  $result['SuspiciousScheduledTasks'] = $suspiciousTasks

  # ── 9. Digital Signature Check (sampled) ────────────────────────────────────
  $unsignedExes = @()
  $sampleFolders = @('C:\\Program Files','C:\\Program Files (x86)')
  foreach ($folder in $sampleFolders) {
    if (-not (Test-Path $folder)) { continue }
    $exes = Get-ChildItem -Path $folder -Filter '*.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 200
    foreach ($exe in $exes) {
      $sig = Get-AuthenticodeSignature -FilePath $exe.FullName -ErrorAction SilentlyContinue
      if ($sig -and $sig.Status -notin @('Valid')) {
        $unsignedExes += [ordered]@{
          Path        = $exe.FullName
          Status      = $sig.Status.ToString()
          SignerCert  = $sig.SignerCertificate?.Subject
          Risk        = if ($sig.Status -eq 'NotSigned') { 'Medium' } else { 'High' }
        }
      }
    }
  }
  $result['UnsignedExecutables'] = $unsignedExes

  # ── 10. Security Status ─────────────────────────────────────────────────────
  $security = [ordered]@{}

  # Windows Defender / Antivirus
  $mpStatus = Get-MpComputerStatus -ErrorAction SilentlyContinue
  if ($mpStatus) {
    $security['WindowsDefender'] = [ordered]@{
      Enabled       = $mpStatus.AntivirusEnabled
      RealTimeProtection = $mpStatus.RealTimeProtectionEnabled
      LastFullScan  = $mpStatus.FullScanEndTime.ToString('o')
      SignatureAge  = $mpStatus.AntivirusSignatureAge
      TamperProtection = $mpStatus.IsTamperProtected
    }
  }

  # Antivirus via WMI
  $avProducts = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue |
    Select-Object displayName, productState
  $security['AntiVirusProducts'] = @($avProducts | ForEach-Object { [ordered]@{ Name = $_.displayName; ProductState = $_.productState } })

  # Firewall
  $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled
  $security['Firewall'] = @($fw | ForEach-Object { [ordered]@{ Profile = $_.Name; Enabled = $_.Enabled } })

  # Windows Update
  $wuSession = New-Object -ComObject Microsoft.Update.Session -ErrorAction SilentlyContinue
  if ($wuSession) {
    $searcher = $wuSession.CreateUpdateSearcher()
    $result2  = $searcher.Search('IsInstalled=0 and Type=Software')
    $security['WindowsUpdate'] = [ordered]@{
      PendingUpdates = $result2.Updates.Count
    }
  } else {
    $security['WindowsUpdate'] = [ordered]@{ PendingUpdates = 'Unknown' }
  }

  $result['SecurityStatus'] = $security

  # ── 11. Network: Suspicious Outbound Connections ────────────────────────────
  $suspiciousConns = @()
  $conns = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
    Where-Object { $_.RemoteAddress -notmatch '^(127\.|::1|0\.)' }
  foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    foreach ($kw in $kw) {
      if ($proc.Name -imatch $kw -or $proc.Path -imatch $kw) {
        $suspiciousConns += [ordered]@{
          PID           = $c.OwningProcess
          ProcessName   = $proc.Name
          ProcessPath   = $proc.Path
          RemoteAddress = $c.RemoteAddress
          RemotePort    = $c.RemotePort
          State         = $c.State
          Risk          = 'High'
          Reason        = "Suspicious process with outbound connection: $kw"
        }
        break
      }
    }
  }
  $result['SuspiciousConnections'] = $suspiciousConns

  # ── Output as JSON ──────────────────────────────────────────────────────────
  $result | ConvertTo-Json -Depth 10 -Compress
}

try {
  $sessionOpts = New-PSSessionOption -SkipCACheck -SkipCNCheck -SkipRevocationCheck
  $session = New-PSSession -ComputerName $hostname -Credential $cred -SessionOption $sessionOpts -ErrorAction Stop
  $jsonResult = Invoke-Command -Session $session -ScriptBlock $scriptBlock -ArgumentList $SUSPICIOUS_KEYWORDS,$PIRACY_TOOLS,$SUSPICIOUS_SERVICES,$SUSPICIOUS_PROCESSES
  Remove-PSSession $session
  Write-Output $jsonResult
} catch {
  Write-Output (ConvertTo-Json @{ error = $_.Exception.Message } -Compress)
}
`.trim();
}

// ─── POST /api/audit/scan ──────────────────────────────────────────────────────
router.post('/scan', requireAuth, async (req, res) => {
  const { hostname, username, password } = req.body;
  if (!hostname || !username || !password) {
    return res.status(400).json({ error: 'hostname, username and password are required' });
  }

  const scriptContent = buildAuditScript(hostname, username, password);
  const tmpScript = path.join(os.tmpdir(), `nexusit_audit_${uuidv4()}.ps1`);

  try {
    fs.writeFileSync(tmpScript, scriptContent, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: `Failed to write temp script: ${e.message}` });
  }

  const psCmd = `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`;

  logger.info(`Audit scan started for ${hostname} by user ${req.user.id}`);

  exec(psCmd, { timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, async (err, stdout, stderr) => {
    // Always clean up the temp script
    try { fs.unlinkSync(tmpScript); } catch {}

    if (err && !stdout) {
      logger.error(`Audit exec error for ${hostname}: ${err.message}`);
      return res.status(500).json({ error: err.message || 'PowerShell execution failed' });
    }

    let parsed;
    try {
      // PowerShell may emit BOM or extra whitespace
      const clean = stdout.trim().replace(/^\uFEFF/, '');
      parsed = JSON.parse(clean);
    } catch (pe) {
      logger.error(`Audit JSON parse error for ${hostname}: ${pe.message}`, { stdout: stdout.slice(0, 500) });
      return res.status(500).json({ error: 'Failed to parse audit output', raw: stdout.slice(0, 2000) });
    }

    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    // Compute summary stats
    const flaggedCount     = (parsed.FlaggedSoftware   || []).length;
    const criticalCount    = (parsed.FlaggedSoftware   || []).filter(f => f.Risk === 'Critical').length;
    const suspSvcCount     = (parsed.SuspiciousServices || []).length;
    const suspProcCount    = (parsed.SuspiciousProcesses || []).length;
    const suspTaskCount    = (parsed.SuspiciousScheduledTasks || []).length;
    const suspConnCount    = (parsed.SuspiciousConnections || []).length;
    const overallRisk      = criticalCount > 0 ? 'Critical' :
                             (flaggedCount > 5 || suspSvcCount > 0) ? 'High' :
                             flaggedCount > 0 ? 'Medium' : 'Low';

    // Persist report
    let savedReport = null;
    try {
      savedReport = await AuditReport.create({
        hostname,
        scanned_by: req.user.id,
        overall_risk: overallRisk,
        flagged_count: flaggedCount,
        critical_count: criticalCount,
        report_data: parsed,
        summary: {
          totalSoftware:      (parsed.InstalledSoftware || []).length,
          flaggedSoftware:    flaggedCount,
          criticalSoftware:   criticalCount,
          suspiciousServices: suspSvcCount,
          suspiciousProcesses:suspProcCount,
          suspiciousTasks:    suspTaskCount,
          suspiciousConns:    suspConnCount,
        }
      });
    } catch (dbErr) {
      logger.warn(`Audit report DB save failed: ${dbErr.message}`);
    }

    return res.json({
      reportId:    savedReport?.id,
      hostname,
      scannedAt:   new Date().toISOString(),
      scannedBy:   req.user.id,
      overallRisk,
      summary: {
        totalSoftware:      (parsed.InstalledSoftware || []).length,
        flaggedSoftware:    flaggedCount,
        criticalSoftware:   criticalCount,
        suspiciousServices: suspSvcCount,
        suspiciousProcesses:suspProcCount,
        suspiciousTasks:    suspTaskCount,
        suspiciousConns:    suspConnCount,
      },
      data: parsed,
    });
  });
});

// ─── GET /api/audit/reports ────────────────────────────────────────────────────
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const reports = await AuditReport.findAll({
      attributes: { exclude: ['report_data'] },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/audit/reports/:id ───────────────────────────────────────────────
router.get('/reports/:id', requireAuth, async (req, res) => {
  try {
    const report = await AuditReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/audit/reports/:id ────────────────────────────────────────────
router.delete('/reports/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const report = await AuditReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    await report.destroy();
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
