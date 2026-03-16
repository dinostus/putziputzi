$ErrorActionPreference = 'Stop'

$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

Write-Host "Putzplan-App laeuft auf http://localhost:$port/"
Write-Host "Im Heimnetz die PC-IP mit :$port im Android-Browser oeffnen."
Write-Host "Zum Beenden: Strg+C"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $requestPath = $context.Request.Url.AbsolutePath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($requestPath)) {
            $requestPath = 'index.html'
        }

        $fullPath = Join-Path $root $requestPath
        if (-not (Test-Path $fullPath)) {
            $context.Response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes('Nicht gefunden')
            $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
            $context.Response.Close()
            continue
        }

        $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
        $contentType = switch ($extension) {
            '.html' { 'text/html; charset=utf-8' }
            '.css' { 'text/css; charset=utf-8' }
            '.js' { 'application/javascript; charset=utf-8' }
            '.webmanifest' { 'application/manifest+json; charset=utf-8' }
            '.svg' { 'image/svg+xml' }
            default { 'application/octet-stream' }
        }

        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $context.Response.ContentType = $contentType
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.Close()
    }
}
finally {
    $listener.Stop()
}
