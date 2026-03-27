import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, QrCode, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PropertyQRCodeProps {
  propertyId: number;
  propertyTitle: string;
  postcode?: string;
  isRental?: boolean; // true = rental, false = sale
  isResidential?: boolean; // true = residential, false = commercial
  size?: number;
  showActions?: boolean;
  variant?: 'inline' | 'card' | 'button';
  baseUrl?: string; // Optional custom base URL for production
}

// Production website URL - configure this for your deployed site
const PRODUCTION_URL = 'https://johnbarclay.co.uk';

// Get the base URL for the property
// Uses production URL if set, otherwise current window origin
function getPropertyUrl(propertyId: number, customBaseUrl?: string): string {
  // Priority: custom URL > environment variable > current origin > fallback
  const baseUrl = customBaseUrl
    || (typeof window !== 'undefined' ? window.location.origin : PRODUCTION_URL);
  return `${baseUrl}/property/${propertyId}`;
}

// John Barclay brand colors
const BRAND_PURPLE = '#791E75';
const BRAND_GOLD = '#F8B324';

export function PropertyQRCode({
  propertyId,
  propertyTitle,
  postcode,
  isRental,
  isResidential = true,
  size = 128,
  showActions = true,
  variant = 'inline',
  baseUrl
}: PropertyQRCodeProps) {
  // Helper to get listing type label
  const getListingTypeLabel = () => {
    if (isResidential === false) return 'COMMERCIAL';
    return isRental ? 'TO RENT' : 'FOR SALE';
  };

  const getListingTypeClass = () => {
    if (isResidential === false) return 'commercial';
    return isRental ? 'rental' : 'sale';
  };
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const propertyUrl = getPropertyUrl(propertyId, baseUrl);

  // Don't render if no valid property ID
  if (!propertyId || propertyId <= 0) {
    return null;
  }

  // Download QR code as PNG
  const handleDownload = (downloadSize: number = 512) => {
    // Create a temporary canvas to generate high-res QR code
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const padding = 40;
    const textHeight = 80;
    tempCanvas.width = downloadSize + padding * 2;
    tempCanvas.height = downloadSize + padding * 2 + textHeight;

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw border
    ctx.strokeStyle = BRAND_PURPLE;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, tempCanvas.width - 20, tempCanvas.height - 20);

    // Create QR code on separate canvas
    const qrCanvas = document.createElement('canvas');
    const qrSize = downloadSize;

    // Use qrcode.react's internal rendering by finding the existing canvas
    const existingCanvas = canvasRef.current?.querySelector('canvas');
    if (existingCanvas) {
      ctx.drawImage(existingCanvas, padding, padding, qrSize, qrSize);
    }

    // Add text below QR code
    ctx.fillStyle = BRAND_PURPLE;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN TO VIEW PROPERTY', tempCanvas.width / 2, downloadSize + padding + 35);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(postcode || '', tempCanvas.width / 2, downloadSize + padding + 60);

    // Download
    const link = document.createElement('a');
    link.download = `property-qr-${propertyId}-${postcode?.replace(/\s/g, '') || 'unknown'}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();

    toast({
      title: 'QR Code Downloaded',
      description: 'The QR code image has been saved to your downloads.'
    });
  };

  // Download high-resolution version for printing
  const handleDownloadPrint = () => {
    handleDownload(1024); // Higher resolution for print
  };

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(propertyUrl);
    setCopied(true);
    toast({
      title: 'Link Copied',
      description: 'Property URL has been copied to clipboard.'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Print QR code
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${propertyTitle}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px;
            }
            .qr-container {
              display: inline-block;
              border: 4px solid ${BRAND_PURPLE};
              padding: 30px;
              border-radius: 12px;
            }
            .title {
              color: ${BRAND_PURPLE};
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .postcode {
              color: #666;
              font-size: 18px;
              margin-bottom: 20px;
            }
            .qr-code {
              margin: 20px 0;
            }
            .scan-text {
              color: ${BRAND_PURPLE};
              font-size: 16px;
              font-weight: bold;
              margin-top: 20px;
            }
            .type-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
            }
            .sale { background: ${BRAND_PURPLE}; color: white; }
            .rental { background: ${BRAND_GOLD}; color: black; }
            .commercial { background: #7C3AED; color: white; }
            .url {
              color: #999;
              font-size: 12px;
              margin-top: 15px;
              word-break: break-all;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="title">John Barclay</div>
            <div class="postcode">${postcode || ''}</div>
            <div class="qr-code">
              <img src="${generateQRDataUrl()}" alt="QR Code" width="256" height="256" />
            </div>
            <div class="scan-text">SCAN TO VIEW PROPERTY</div>
            ${isRental !== undefined ? `<div class="type-badge ${getListingTypeClass()}">${getListingTypeLabel()}</div>` : ''}
            <div class="url">${propertyUrl}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate QR code as data URL for printing
  const generateQRDataUrl = (): string => {
    const canvas = canvasRef.current?.querySelector('canvas');
    return canvas?.toDataURL('image/png') || '';
  };

  // Render inline QR code (for property cards)
  if (variant === 'inline') {
    return (
      <div ref={canvasRef} className="flex flex-col items-center">
        <QRCodeCanvas
          value={propertyUrl}
          size={size}
          level="M"
          bgColor="#FFFFFF"
          fgColor={BRAND_PURPLE}
          includeMargin={false}
        />
        {showActions && (
          <div className="flex gap-1 mt-2">
            <Button variant="ghost" size="sm" onClick={() => handleDownload(256)}>
              <Download className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopyUrl}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Render as button that opens dialog
  if (variant === 'button') {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-1" />
            QR Code
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Property QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to view the property listing
            </DialogDescription>
          </DialogHeader>

          <div ref={canvasRef} className="flex flex-col items-center py-6">
            <div className="p-6 border-4 border-[#791E75] rounded-xl bg-white">
              <QRCodeCanvas
                value={propertyUrl}
                size={200}
                level="H"
                bgColor="#FFFFFF"
                fgColor={BRAND_PURPLE}
                includeMargin={true}
              />
            </div>

            <p className="text-sm text-gray-600 mt-4 text-center">
              {propertyTitle}
            </p>
            {postcode && (
              <Badge variant="outline" className="mt-2">{postcode}</Badge>
            )}
            {isRental !== undefined && (
              <Badge
                className={`mt-2 ${
                  isResidential === false ? 'bg-purple-600' :
                  isRental ? 'bg-[#F8B324] text-black' :
                  'bg-[#791E75]'
                }`}
              >
                {getListingTypeLabel()}
              </Badge>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleDownload(256)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleDownloadPrint}>
              <Download className="h-4 w-4 mr-2" />
              Print Quality
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleCopyUrl}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render as card (for dedicated QR code view)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-[#791E75]" />
          Property QR Code
        </CardTitle>
        <CardDescription>
          Use this QR code on property boards and marketing materials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={canvasRef} className="flex flex-col items-center">
          <div className="p-8 border-4 border-[#791E75] rounded-xl bg-white">
            <QRCodeCanvas
              value={propertyUrl}
              size={size}
              level="H"
              bgColor="#FFFFFF"
              fgColor={BRAND_PURPLE}
              includeMargin={true}
            />
          </div>

          <div className="text-center mt-4">
            <p className="font-semibold text-gray-900">{propertyTitle}</p>
            {postcode && (
              <p className="text-sm text-gray-500">{postcode}</p>
            )}
            {isRental !== undefined && (
              <Badge
                className={`mt-2 ${
                  isResidential === false ? 'bg-purple-600' :
                  isRental ? 'bg-[#F8B324] text-black' :
                  'bg-[#791E75]'
                }`}
              >
                {getListingTypeLabel()}
              </Badge>
            )}
          </div>

          <div className="flex gap-2 mt-6 flex-wrap justify-center">
            <Button onClick={() => handleDownload(256)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleDownloadPrint}>
              <Download className="h-4 w-4 mr-2" />
              Print Quality (1024px)
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={propertyUrl}
              readOnly
              className="text-xs bg-gray-50 px-3 py-2 rounded border flex-1 min-w-0"
            />
            <Button variant="ghost" size="sm" onClick={handleCopyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={propertyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini QR code for property cards
export function PropertyQRMini({ propertyId, size = 60 }: { propertyId: number; size?: number }) {
  const propertyUrl = getPropertyUrl(propertyId);

  return (
    <div className="bg-white p-1 rounded">
      <QRCodeSVG
        value={propertyUrl}
        size={size}
        level="L"
        bgColor="#FFFFFF"
        fgColor={BRAND_PURPLE}
      />
    </div>
  );
}

export default PropertyQRCode;
