# Levanta todos los microservicios + API Gateway en terminales separadas
$base = "D:\git proyectos\cotizador backned\backend-microservicios"

function Start-ServiceTerminal($name, $path) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; Write-Host 'Levantando $name...' -ForegroundColor Green; npm run start:dev"
}

Start-ServiceTerminal "API Gateway" "$base\api-gateway"
Start-ServiceTerminal "Auth Service" "$base\services\auth-service"
Start-ServiceTerminal "Quotes Service" "$base\services\quotes-service"
Start-ServiceTerminal "Payments Service" "$base\services\payments-service"
Start-ServiceTerminal "Config Service" "$base\services\config-service"
Start-ServiceTerminal "Catalog Service" "$base\services\catalog-service"
Start-ServiceTerminal "Public Service" "$base\services\public-service"
Start-ServiceTerminal "Tile Calculator Service" "$base\services\tile-calculator-service"

Write-Host "Abriendo 8 terminales... espera unos segundos y prueba http://localhost:3000/health" -ForegroundColor Cyan
