$ErrorActionPreference = 'Stop'

$port = 8080
$root = $PSScriptRoot
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()

function Get-ContentType {
    param([string]$Path)

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($extension) {
        '.html' { return 'text/html; charset=utf-8' }
        '.css' { return 'text/css; charset=utf-8' }
        '.js' { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.webmanifest' { return 'application/manifest+json; charset=utf-8' }
        '.svg' { return 'image/svg+xml' }
        '.png' { return 'image/png' }
        '.jpg' { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif' { return 'image/gif' }
        '.mp3' { return 'audio/mpeg' }
        '.m4a' { return 'audio/mp4' }
        default { return 'application/octet-stream' }
    }
}

function Write-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType
    )

    $header = @(
        "HTTP/1.1 $StatusCode $StatusText",
        "Content-Type: $ContentType",
        "Content-Length: $($Body.Length)",
        "Connection: close",
        ""
        ""
    ) -join "`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    $Stream.Write($Body, 0, $Body.Length)
    $Stream.Flush()
}

Write-Host "Putzplan-App laeuft auf http://localhost:$port/"
Write-Host "Im Heimnetz die PC-IP mit :$port im Browser oeffnen."
Write-Host "Zum Beenden: Strg+C"

try {
    while ($true) {
        $client = $null
        $stream = $null
        $reader = $null
        try {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) {
                    break
                }
            }

            $parts = $requestLine.Split(' ')
            if ($parts.Length -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Ungueltige Anfrage')
                Write-HttpResponse -Stream $stream -StatusCode 400 -StatusText 'Bad Request' -Body $body -ContentType 'text/plain; charset=utf-8'
                continue
            }

            $rawPath = $parts[1]
            $relativePath = [System.Uri]::UnescapeDataString(($rawPath.Split('?')[0]).TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = 'index.html'
            }

            $fullPath = Join-Path $root $relativePath
            $resolvedRoot = [System.IO.Path]::GetFullPath($root)
            $resolvedPath = [System.IO.Path]::GetFullPath($fullPath)

            if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $resolvedPath -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Nicht gefunden')
                Write-HttpResponse -Stream $stream -StatusCode 404 -StatusText 'Not Found' -Body $body -ContentType 'text/plain; charset=utf-8'
                continue
            }

            $bytes = [System.IO.File]::ReadAllBytes($resolvedPath)
            $contentType = Get-ContentType -Path $resolvedPath
            Write-HttpResponse -Stream $stream -StatusCode 200 -StatusText 'OK' -Body $bytes -ContentType $contentType
        }
        catch {
            Write-Host "Anfrage konnte nicht verarbeitet werden: $($_.Exception.Message)"
        }
        finally {
            if ($reader) { $reader.Dispose() }
            if ($stream) { $stream.Dispose() }
            if ($client) { $client.Dispose() }
        }
    }
}
finally {
    $listener.Stop()
}
