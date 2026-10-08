param(
  [Parameter(Mandatory = $true)]
  [string]$ReferencePath,
  [Parameter(Mandatory = $true)]
  [string]$LatestPath
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$culture = [System.Globalization.CultureInfo]::InvariantCulture
$acuteA = [char]0x00E1
$acuteI = [char]0x00ED
$acuteO = [char]0x00F3

function Convert-ExactText {
  param($Value)

  if ($null -eq $Value) { return "" }
  if ($Value -is [byte] -or $Value -is [sbyte] -or
      $Value -is [int16] -or $Value -is [uint16] -or
      $Value -is [int32] -or $Value -is [uint32] -or
      $Value -is [int64] -or $Value -is [uint64] -or
      $Value -is [single] -or $Value -is [double] -or
      $Value -is [decimal]) {
    $number = [double]$Value
    if ([Math]::Abs($number - [Math]::Round($number)) -lt 0.000000001) {
      return $number.ToString("0", $culture)
    }
    return $number.ToString("0.###############", $culture)
  }
  return ([string]$Value).Trim()
}

$referenceResolved = (Resolve-Path -LiteralPath $ReferencePath).Path
$latestResolved = (Resolve-Path -LiteralPath $LatestPath).Path
$excel = $null
$referenceBook = $null
$latestBook = $null
$referenceSheet = $null
$latestSheet = $null
$referenceUsed = $null
$latestUsed = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $referenceBook = $excel.Workbooks.Open($referenceResolved, 0, $true)
  $latestBook = $excel.Workbooks.Open($latestResolved, 0, $true)
  $referenceSheet = $referenceBook.Worksheets.Item(1)
  $latestSheet = $latestBook.Worksheets.Item(1)
  $referenceUsed = $referenceSheet.UsedRange
  $latestUsed = $latestSheet.UsedRange
  $referenceValues = $referenceUsed.Value2
  $latestValues = $latestUsed.Value2

  $referenceById = @{}
  for ($row = 1; $row -le [int]$referenceUsed.Rows.Count; $row++) {
    $id = Convert-ExactText $referenceValues[$row, 1]
    if (-not $id) { continue }
    if ($referenceById.ContainsKey($id)) {
      throw "ID repetido en el archivo de referencias: $id"
    }
    $referenceById[$id] = [pscustomobject]@{
      name = ((Convert-ExactText $referenceValues[$row, 2]) -replace '\s+', ' ').Trim()
      reference = Convert-ExactText $referenceValues[$row, 3]
    }
  }

  $raw = [System.Collections.Generic.List[object]]::new()
  for ($row = 2; $row -le [int]$latestUsed.Rows.Count; $row++) {
    $id = Convert-ExactText $latestValues[$row, 1]
    $name = (Convert-ExactText $latestValues[$row, 2]) -replace '\s+', ' '
    $category = (Convert-ExactText $latestValues[$row, 3]) -replace '\s+', ' '
    if (-not $id -and -not $name) { continue }

    $referenceRow = $referenceById[$id]
    $reference = $id
    $sourceNote = ""
    if ($referenceRow -and $referenceRow.name -eq $name.Trim()) {
      $reference = $referenceRow.reference
    }
    elseif ($referenceRow) {
      $sourceNote = "Referencia anterior no copiada porque la descripci${acuteO}n no coincide"
    }
    else {
      $sourceNote = "Producto nuevo sin referencia anterior; se us${acuteO} el ID"
    }

    $raw.Add([pscustomobject]@{
      sourceRow = $row
      id = $id
      name = $name.Trim()
      reference = $reference
      category = $category.Trim()
      unit = (Convert-ExactText $latestValues[$row, 4]).Trim()
      qty = [double]($latestValues[$row, 5])
      cost = [double]($latestValues[$row, 6])
      price = [double]($latestValues[$row, 7])
      sourceNote = $sourceNote
    })
  }

  $ids = @{}
  foreach ($item in $raw) { $ids[$item.id] = $true }

  $rows = [System.Collections.Generic.List[object]]::new()
  $adjustments = [System.Collections.Generic.List[object]]::new()
  foreach ($item in $raw) {
    $cleanReference = $item.reference
    $notes = [System.Collections.Generic.List[string]]::new()
    if ($item.sourceNote) { $notes.Add($item.sourceNote) }

    if ($item.qty -lt 0) {
      $notes.Add("Existencia negativa $($item.qty) convertida a 0")
    }
    if ($cleanReference -and $cleanReference -ne $item.id -and $ids.ContainsKey($cleanReference)) {
      $notes.Add("Referencia $cleanReference retirada porque pertenece al ID $cleanReference")
      $cleanReference = $item.id
    }
    elseif ($cleanReference -match '^\d{15,}$') {
      $notes.Add("Referencia $cleanReference retirada porque Excel no conserva con fiabilidad c${acuteO}digos de m${acuteA}s de 14 d${acuteI}gitos")
      $cleanReference = $item.id
    }

    $note = $notes -join "; "
    $rows.Add([pscustomobject]@{
      sourceRow = $item.sourceRow
      id = $item.id
      name = $item.name
      reference = $cleanReference
      category = $item.category
      unit = $item.unit
      qty = [Math]::Max(0, $item.qty)
      cost = $item.cost
      price = $item.price
      adjustment = $note
    })
    if ($note) {
      $adjustments.Add([pscustomobject]@{
        sourceRow = $item.sourceRow
        id = $item.id
        product = $item.name
        category = $item.category
        adjustment = $note
      })
    }
  }

  [pscustomobject]@{
    referencePath = $referenceResolved
    latestPath = $latestResolved
    sourceSheet = $latestSheet.Name
    rows = $rows
    adjustments = $adjustments
  } | ConvertTo-Json -Depth 6 -Compress
}
finally {
  if ($referenceBook) { $referenceBook.Close($false) }
  if ($latestBook) { $latestBook.Close($false) }
  foreach ($object in @(
    $referenceUsed,
    $latestUsed,
    $referenceSheet,
    $latestSheet,
    $referenceBook,
    $latestBook
  )) {
    if ($object) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($object) }
  }
  if ($excel) {
    $excel.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
