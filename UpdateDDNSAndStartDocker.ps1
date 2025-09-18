Set-PSDebug -Trace 0

Get-Content secrets/duckdns_parameters.txt | Foreach-Object{
   $var = $_.Split('=')
   New-Variable -Name $var[0] -Value $var[1]
}

Write-Output "DuckDNS domains: $($ddns_domains)"
Write-Output "DuckDNS token: $($ddns_token)"
./Update-DuckDNS/Update-DuckDNS.ps1 -Domains $ddns_domains -Token $ddns_token

Write-Output "Docker compose up"
# docker compose -f docker-compose.yml up --build
docker-compose up --build -d