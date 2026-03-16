$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Escape-Xml {
    param([string]$Value)

    if ($null -eq $Value) {
        return ''
    }

    return [System.Security.SecurityElement]::Escape($Value)
}

function New-ParagraphsXml {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return '<text:p/>'
    }

    $parts = $Text -split "`n"
    $paragraphs = foreach ($part in $parts) {
        "<text:p>$(Escape-Xml $part)</text:p>"
    }

    return ($paragraphs -join '')
}

function New-CellXml {
    param(
        [string]$Text,
        [string]$StyleName = 'ceDefault'
    )

    return "<table:table-cell office:value-type=`"string`" table:style-name=`"$StyleName`">$(New-ParagraphsXml -Text $Text)</table:table-cell>"
}

function New-RowXml {
    param(
        [string[]]$Values,
        [string[]]$Styles
    )

    $cells = for ($i = 0; $i -lt $Values.Count; $i++) {
        $style = if ($Styles -and $i -lt $Styles.Count -and $Styles[$i]) { $Styles[$i] } else { 'ceDefault' }
        New-CellXml -Text $Values[$i] -StyleName $style
    }

    return "<table:table-row>$($cells -join '')</table:table-row>"
}

function Add-ZipEntry {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$EntryName,
        [string]$Content,
        [System.IO.Compression.CompressionLevel]$CompressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    )

    $entry = $Archive.CreateEntry($EntryName, $CompressionLevel)
    $stream = $entry.Open()
    $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
    $writer.Write($Content)
    $writer.Dispose()
}

$culture = [System.Globalization.CultureInfo]'de-DE'
$startDate = [datetime]'2026-03-16'
$weeks = 12
$personA = 'Laura'
$personB = 'Dino'
$outputPath = Join-Path $PSScriptRoot 'Putzplan_Laura_Dino_Fair.ods'
$small_ue = [char]0x00FC
$small_ae = [char]0x00E4
$small_oe = [char]0x00F6
$capital_ue = [char]0x00DC

$scheduleRows = [System.Collections.Generic.List[string]]::new()
$scheduleRows.Add((New-RowXml -Values @('Datum', 'Laura', 'Dino', 'Hinweise') -Styles @('ceHeader', 'ceHeader', 'ceHeader', 'ceHeader')))

$occurrenceBedding = 0
$occurrenceMop = 0

for ($dayOffset = 0; $dayOffset -lt ($weeks * 7); $dayOffset++) {
    $currentDate = $startDate.AddDays($dayOffset)
    $weekIndex = [math]::Floor($dayOffset / 7)
    $dayOfWeek = [int]$currentDate.DayOfWeek
    $dateLabel = $culture.TextInfo.ToTitleCase($currentDate.ToString('dddd d. MMMM', $culture))

    $lauraTasks = [System.Collections.Generic.List[string]]::new()
    $dinoTasks = [System.Collections.Generic.List[string]]::new()
    $sharedTasks = [System.Collections.Generic.List[string]]::new()
    if ($dayOffset % 2 -eq 0) {
        $lauraTasks.Add("aufr${small_ae}umen")
    }
    else {
        $dinoTasks.Add("aufr${small_ae}umen")
    }

    if ($dayOfWeek -eq 1) {
        if ($weekIndex % 2 -eq 0) {
            $lauraTasks.Add('staubsaugen')
            $dinoTasks.Add("M${small_ue}ll rausbringen")
        }
        else {
            $dinoTasks.Add('staubsaugen')
            $lauraTasks.Add("M${small_ue}ll rausbringen")
        }

        if ($weekIndex % 2 -eq 0) {
            if ($occurrenceBedding % 2 -eq 0) {
                $lauraTasks.Add('Bettzeug wechseln')
            }
            else {
                $dinoTasks.Add('Bettzeug wechseln')
            }
            $occurrenceBedding++
        }
    }

    if ($dayOfWeek -eq 2) {
        if ($weekIndex % 2 -eq 0) {
            $dinoTasks.Add("K${small_ue}che putzen")
        }
        else {
            $lauraTasks.Add("K${small_ue}che putzen")
        }
    }

    if ($dayOfWeek -eq 3) {
        if ($weekIndex % 2 -eq 0) {
            $lauraTasks.Add('WC putzen')
            $dinoTasks.Add("M${small_ue}ll rausbringen")
        }
        else {
            $dinoTasks.Add('WC putzen')
            $lauraTasks.Add("M${small_ue}ll rausbringen")
        }
    }

    if ($dayOfWeek -eq 5) {
        if ($weekIndex % 2 -eq 0) {
            $dinoTasks.Add('Bad putzen')
            $lauraTasks.Add("M${small_ue}ll rausbringen")
        }
        else {
            $lauraTasks.Add('Bad putzen')
            $dinoTasks.Add("M${small_ue}ll rausbringen")
        }
    }

    if ($dayOfWeek -eq 6 -and ($weekIndex % 4 -eq 0)) {
        $assignedPerson = if ($occurrenceMop % 2 -eq 0) { $personB } else { $personA }
        if ($assignedPerson -eq $personA) {
            $lauraTasks.Add('staubsaugen + Boden nass')
        }
        else {
            $dinoTasks.Add('staubsaugen + Boden nass')
        }
        $occurrenceMop++
    }

    if ($lauraTasks.Count -eq 0) {
        $lauraTasks.Add(' ')
    }

    if ($dinoTasks.Count -eq 0) {
        $dinoTasks.Add(' ')
    }

    $rowStyle = if ($dayOfWeek -eq 0 -or $dayOfWeek -eq 6) {
        @('ceDateWeekend', 'ceWeekend', 'ceWeekend', 'ceWeekend')
    }
    else {
        @('ceDate', 'ceLaura', 'ceDino', 'ceShared')
    }

    $scheduleRows.Add((
        New-RowXml -Values @(
            $dateLabel,
            ($lauraTasks -join "`n"),
            ($dinoTasks -join "`n"),
            ($sharedTasks -join "`n")
        ) -Styles $rowStyle
    ))
}

$overviewRows = [System.Collections.Generic.List[string]]::new()
$overviewRows.Add((New-RowXml -Values @("Putzplan f${small_ue}r Laura und Dino", '', '', '') -Styles @('ceTitle', 'ceTitle', 'ceTitle', 'ceTitle')))
$overviewRows.Add((New-RowXml -Values @("Zeitraum", "12 Wochen ab Montag 16. M${small_ae}rz 2026", '', '') -Styles @('ceHeader', 'ceDefault', 'ceDefault', 'ceDefault')))
$overviewRows.Add((New-RowXml -Values @('So ist der Plan aufgebaut', 'Jeder Tag hat eine eigene Zeile.', 'Laura und Dino haben getrennte Spalten.', 'Hinweise stehen rechts.') -Styles @('ceHeader', 'ceDefault', 'ceDefault', 'ceDefault')))
$overviewRows.Add((New-RowXml -Values @('Feste Verteilung', 'Montag: staubsaugen', "Dienstag: K${small_ue}che", 'Mittwoch: WC, Freitag: Bad') -Styles @('ceHeader', 'ceLaura', 'ceDino', 'ceShared')))
$overviewRows.Add((New-RowXml -Values @('Weitere Aufgaben', "M${small_ue}ll ist exakt gleich verteilt", "M${small_ue}ll ist exakt gleich verteilt", 'Bettzeug wechselt exakt, Monatsjob ist 2 zu 1') -Styles @('ceHeader', 'ceLaura', 'ceDino', 'ceShared')))
$overviewRows.Add((New-RowXml -Values @('Täglich', "aufr${small_ae}umen im Wechsel", "aufr${small_ae}umen im Wechsel", "Alle regelm${small_ae}${small_oe}igen Aufgaben sind gleich verteilt au${small_oe}er dem Monatsjob") -Styles @('ceHeader', 'ceLaura', 'ceDino', 'ceShared')))
$overviewRows.Add((New-RowXml -Values @('Hinweis', 'Leere Felder bedeuten: heute keine Extra-Aufgabe.', '', '') -Styles @('ceHeader', 'ceDefault', 'ceDefault', 'ceDefault')))

$contentXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
    office:version="1.3">
  <office:automatic-styles>
    <style:style style:name="coDate" style:family="table-column">
      <style:table-column-properties style:column-width="4.4cm"/>
    </style:style>
    <style:style style:name="coPerson" style:family="table-column">
      <style:table-column-properties style:column-width="5.6cm"/>
    </style:style>
    <style:style style:name="coShared" style:family="table-column">
      <style:table-column-properties style:column-width="7.2cm"/>
    </style:style>
    <style:style style:name="ro" style:family="table-row">
      <style:table-row-properties style:row-height="0.8cm" style:use-optimal-row-height="true"/>
    </style:style>
    <style:style style:name="ceDefault" style:family="table-cell">
      <style:table-cell-properties fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
    </style:style>
    <style:style style:name="ceHeader" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#d9ead3" fo:padding="0.08cm" fo:border="0.03pt solid #7f7f7f"/>
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceTitle" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#cfe2f3" fo:padding="0.12cm" fo:border="0.03pt solid #7f7f7f"/>
      <style:text-properties fo:font-weight="bold" fo:font-size="14pt"/>
    </style:style>
    <style:style style:name="ceDate" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#f3f3f3" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceDateWeekend" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#ead1dc" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceLaura" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#fff2cc" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
    </style:style>
    <style:style style:name="ceDino" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#d9ead3" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
    </style:style>
    <style:style style:name="ceShared" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#d0e0e3" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
    </style:style>
    <style:style style:name="ceWeekend" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#fce5cd" fo:padding="0.08cm" fo:border="0.03pt solid #bcbcbc"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:spreadsheet>
      <table:table table:name="${capital_ue}bersicht">
        <table:table-column table:style-name="coDate"/>
        <table:table-column table:style-name="coPerson"/>
        <table:table-column table:style-name="coPerson"/>
        <table:table-column table:style-name="coShared"/>
        $($overviewRows -join "`n        ")
      </table:table>
      <table:table table:name="Tagesplan">
        <table:table-column table:style-name="coDate"/>
        <table:table-column table:style-name="coPerson"/>
        <table:table-column table:style-name="coPerson"/>
        <table:table-column table:style-name="coShared"/>
        $($scheduleRows -join "`n        ")
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    office:version="1.3">
  <office:styles/>
  <office:automatic-styles/>
  <office:master-styles/>
</office:document-styles>
"@

$metaXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
    office:version="1.3">
  <office:meta>
    <meta:generator>Codex</meta:generator>
  </office:meta>
</office:document-meta>
"@

$manifestXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
"@

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

$fileStream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
try {
    $archive = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        Add-ZipEntry -Archive $archive -EntryName 'mimetype' -Content 'application/vnd.oasis.opendocument.spreadsheet' -CompressionLevel ([System.IO.Compression.CompressionLevel]::NoCompression)
        Add-ZipEntry -Archive $archive -EntryName 'content.xml' -Content $contentXml
        Add-ZipEntry -Archive $archive -EntryName 'styles.xml' -Content $stylesXml
        Add-ZipEntry -Archive $archive -EntryName 'meta.xml' -Content $metaXml
        Add-ZipEntry -Archive $archive -EntryName 'META-INF/manifest.xml' -Content $manifestXml
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $fileStream.Dispose()
}

Write-Output "Created $outputPath"
