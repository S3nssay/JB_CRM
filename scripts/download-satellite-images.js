/**
 * Script to download satellite images for each area using Mapbox Static Images API
 *
 * To use this script:
 * 1. Sign up for a free Mapbox account at https://www.mapbox.com/
 * 2. Get your access token from https://account.mapbox.com/
 * 3. Set the MAPBOX_TOKEN environment variable or replace YOUR_MAPBOX_TOKEN below
 * 4. Run: node scripts/download-satellite-images.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Replace with your Mapbox access token
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

// Area coordinates (latitude, longitude, zoom level)
const areas = [
  {
    name: 'Bayswater',
    postcode: 'W2',
    filename: 'bayswater-w2.jpg',
    coordinates: { lat: 51.5136, lon: -0.1854, zoom: 14 }
  },
  {
    name: 'Maida Vale',
    postcode: 'W9',
    filename: 'maida-vale-w9.jpg',
    coordinates: { lat: 51.5283, lon: -0.1859, zoom: 14 }
  },
  {
    name: 'North Kensington',
    postcode: 'W10',
    filename: 'north-kensington-w10.jpg',
    coordinates: { lat: 51.5205, lon: -0.2109, zoom: 14 }
  },
  {
    name: 'Ladbroke Grove',
    postcode: 'W10',
    filename: 'ladbroke-grove-w10.jpg',
    coordinates: { lat: 51.5172, lon: -0.2105, zoom: 14 }
  },
  {
    name: 'Westbourne Park',
    postcode: 'W10',
    filename: 'westbourne-park-w10.jpg',
    coordinates: { lat: 51.5210, lon: -0.2010, zoom: 14 }
  },
  {
    name: 'Kilburn',
    postcode: 'NW6',
    filename: 'kilburn-nw6.jpg',
    coordinates: { lat: 51.5380, lon: -0.1947, zoom: 14 }
  },
  {
    name: 'Queens Park',
    postcode: 'NW6',
    filename: 'queens-park-nw6.jpg',
    coordinates: { lat: 51.5341, lon: -0.2045, zoom: 14 }
  },
  {
    name: 'Harlesden',
    postcode: 'NW10',
    filename: 'harlesden-nw10.jpg',
    coordinates: { lat: 51.5373, lon: -0.2599, zoom: 14 }
  },
  {
    name: 'Kensal Green',
    postcode: 'NW10',
    filename: 'kensal-green-nw10.jpg',
    coordinates: { lat: 51.5305, lon: -0.2250, zoom: 14 }
  },
  {
    name: 'Kensal Rise',
    postcode: 'NW10',
    filename: 'kensal-rise-nw10.jpg',
    coordinates: { lat: 51.5364, lon: -0.2234, zoom: 14 }
  },
  {
    name: 'Willesden',
    postcode: 'NW10',
    filename: 'willesden-nw10.jpg',
    coordinates: { lat: 51.5491, lon: -0.2439, zoom: 14 }
  }
];

// Image dimensions (Mapbox free tier max width is 1280)
const WIDTH = 1280;
const HEIGHT = 720;

// Output directory
const outputDir = path.join(__dirname, '..', 'client', 'src', 'assets', 'area-backgrounds');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function downloadImage(area) {
  return new Promise((resolve, reject) => {
    const { lat, lon, zoom } = area.coordinates;

    // Mapbox Static Images API URL - Format: /static/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}{@2x}
    // bearing and pitch are optional, default to 0
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},${zoom},0,0/${WIDTH}x${HEIGHT}?access_token=${MAPBOX_TOKEN}`;

    const outputPath = path.join(outputDir, area.filename);
    const file = fs.createWriteStream(outputPath);

    console.log(`Downloading satellite image for ${area.name} (${area.postcode})...`);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${area.name}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${area.filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete incomplete file
      reject(err);
    });
  });
}

async function downloadAll() {
  if (MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN') {
    console.error('❌ Error: Please set your Mapbox access token!');
    console.error('\nOptions:');
    console.error('1. Set environment variable: MAPBOX_TOKEN=your_token_here node scripts/download-satellite-images.js');
    console.error('2. Edit this file and replace YOUR_MAPBOX_TOKEN with your actual token');
    console.error('\nGet your free token at: https://account.mapbox.com/');
    process.exit(1);
  }

  console.log(`Starting download of ${areas.length} satellite images...\n`);

  for (const area of areas) {
    try {
      await downloadImage(area);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`✗ Error downloading ${area.name}: ${error.message}`);
    }
  }

  console.log('\n✓ All downloads complete!');
  console.log(`Images saved to: ${outputDir}`);
}

downloadAll();
