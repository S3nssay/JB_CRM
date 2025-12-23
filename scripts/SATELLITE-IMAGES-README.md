# Adding Satellite Images to Area Pages

This guide explains how to add satellite background images to your area pages.

## Option 1: Automatic Download with Mapbox (Recommended)

### Prerequisites
1. Sign up for a free Mapbox account at https://www.mapbox.com/
2. Navigate to https://account.mapbox.com/ and copy your access token
3. The free tier includes 200,000 tile requests per month - more than enough for this use case

### Steps
1. Set your Mapbox access token as an environment variable:
   ```bash
   # Windows (PowerShell)
   $env:MAPBOX_TOKEN="your_token_here"

   # Windows (CMD)
   set MAPBOX_TOKEN=your_token_here

   # Mac/Linux
   export MAPBOX_TOKEN=your_token_here
   ```

2. Run the download script:
   ```bash
   node scripts/download-satellite-images.js
   ```

3. The script will download satellite images for all 11 coverage areas to `client/src/assets/area-backgrounds/`

## Option 2: Manual Download from Google Maps

If you prefer not to use Mapbox, you can manually capture satellite images from Google Maps:

### For each area:

1. **Bayswater (W2)**
   - Open: https://www.google.com/maps/@51.5136,-0.1854,14z
   - Switch to Satellite view
   - Take a screenshot or use Google Maps screenshot tool
   - Save as: `bayswater-w2.jpg`

2. **Maida Vale (W9)**
   - Open: https://www.google.com/maps/@51.5283,-0.1859,14z
   - Save as: `maida-vale-w9.jpg`

3. **North Kensington (W10)**
   - Open: https://www.google.com/maps/@51.5205,-0.2109,14z
   - Save as: `north-kensington-w10.jpg`

4. **Kilburn (NW6)**
   - Open: https://www.google.com/maps/@51.5380,-0.1947,14z
   - Save as: `kilburn-nw6.jpg`

5. **Harlesden (NW10)**
   - Open: https://www.google.com/maps/@51.5373,-0.2599,14z
   - Save as: `harlesden-nw10.jpg`

6. **Ladbroke Grove (W10)**
   - Open: https://www.google.com/maps/@51.5172,-0.2105,14z
   - Save as: `ladbroke-grove-w10.jpg`

7. **Westbourne Park (W10)**
   - Open: https://www.google.com/maps/@51.5210,-0.2010,14z
   - Save as: `westbourne-park-w10.jpg`

8. **Queens Park (NW6)**
   - Open: https://www.google.com/maps/@51.5341,-0.2045,14z
   - Save as: `queens-park-nw6.jpg`

9. **Kensal Green (NW10)**
   - Open: https://www.google.com/maps/@51.5305,-0.2250,14z
   - Save as: `kensal-green-nw10.jpg`

10. **Kensal Rise (NW10)**
    - Open: https://www.google.com/maps/@51.5364,-0.2234,14z
    - Save as: `kensal-rise-nw10.jpg`

11. **Willesden (NW10)**
    - Open: https://www.google.com/maps/@51.5491,-0.2439,14z
    - Save as: `willesden-nw10.jpg`

### Screenshot Instructions:
- Use browser's built-in screenshot tool or press `PrtScn` / `Cmd+Shift+4`
- Recommended dimensions: 1920x1080 pixels
- Save all images to: `client/src/assets/area-backgrounds/`

## Option 3: Use Free Satellite Imagery Services

### OpenAerialMap
1. Visit https://openaerialmap.org/
2. Search for each area using coordinates
3. Download high-resolution imagery
4. Crop to desired dimensions (1920x1080 recommended)

### OnGeo Intelligence
1. Visit https://ongeo-intelligence.com/blog/download-satellite-map-london
2. Use their custom map generator for each area
3. Download the generated satellite images

## Recommended Image Specifications
- **Format:** JPG or WebP (for better compression)
- **Dimensions:** 1920 x 1080 pixels (or higher for retina displays)
- **File size:** Under 500KB each (optimize with tools like TinyPNG or Squoosh)
- **Quality:** 80-85% JPEG quality for good balance

## Verifying Installation

Once you have the images in `client/src/assets/area-backgrounds/`, the area pages will automatically display them as backgrounds. Visit any area page (e.g., `/area/W2`) to see the satellite imagery.

## Troubleshooting

**Images not showing?**
- Check that filenames match exactly (case-sensitive)
- Ensure images are in the correct directory
- Verify the file path in `client/src/pages/AreaPage.tsx` matches your structure
- Clear browser cache and refresh

**Images too dark/light?**
- Adjust the overlay opacity in `AreaPage.tsx` line 314:
  ```tsx
  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>
  ```
- Change the `/60` values (0-100) to make overlay darker or lighter

## License Considerations

- **Mapbox:** Free tier allows commercial use with attribution
- **Google Maps:** Screenshots may have usage restrictions - check Google's terms
- **OpenAerialMap:** Open licensed imagery
- **OnGeo:** Check their specific license terms

For commercial projects, we recommend using Mapbox or OpenAerialMap to ensure proper licensing.
