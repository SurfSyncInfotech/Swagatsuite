# Deploy review + loyalty fixes to production backend (backend.swagatsuite.com)
# Server path from error logs: /root/swagatsuite_backend/
#
# Usage (from repo root, with SSH access to your server):
#   scp -r backend/src/* user@your-server:/root/swagatsuite_backend/src/
#   ssh user@your-server "cd /root/swagatsuite_backend && npm install && pm2 restart all"
#
# Or run this script to create a zip for manual upload:

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root "production-deploy.zip"

if (Test-Path $out) { Remove-Item $out }

$files = @(
  "src\app.js",
  "src\routes\index.js",
  "src\routes\publicRoutes.js",
  "src\routes\adminRoutes.js",
  "src\routes\leadRoutes.js",
  "src\routes\whatsappWebhookRoutes.js",
  "src\controllers\publicLoyaltyController.js",
  "src\controllers\publicMenuController.js",
  "src\controllers\publicReviewController.js",
  "src\controllers\adminOrderController.js",
  "src\controllers\adminLoyaltyController.js",
  "src\controllers\leadController.js",
  "src\controllers\whatsappWebhookController.js",
  "src\models\loyaltyModel.js",
  "src\models\reviewModel.js",
  "src\models\invoiceModel.js",
  "src\models\leadModel.js",
  "src\services\dbInitService.js",
  "src\services\smartpingWhatsAppService.js",
  "src\services\leadWhatsAppFlowService.js",
  "src\services\whatsappAiService.js",
  "src\content\swagatsuiteKnowledge.js",
  "package.json",
  "package-lock.json",
  "server.js"
)

Push-Location $root
try {
  Compress-Archive -Path $files -DestinationPath $out -Force
  Write-Host "Created: $out"
  Write-Host ""
  Write-Host "Upload to server /root/swagatsuite_backend/ then run:"
  Write-Host "  cd /root/swagatsuite_backend && npm install && pm2 restart all"
  Write-Host ""
  Write-Host "Verify after restart:"
  Write-Host "  curl https://backend.swagatsuite.com/api/public/loyalty?restaurant=RST-481868CS5W&phone=9350035773"
  Write-Host "  curl -X POST https://backend.swagatsuite.com/api/leads/1/delete"
}
finally {
  Pop-Location
}
