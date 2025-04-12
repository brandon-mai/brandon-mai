import fs from 'fs';
import fetch from 'node-fetch';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Fetches current/latest track data from Last.fm
 * @returns {Promise<Object>} Track data
 */
async function fetchLastFmData() {
  try {
    const response = await fetch(
      `https://lastfm-last-played.biancarosa.com.br/brandonmai/latest-song`
    );
    const data = await response.json();
    const track = data.track;
    
    return {
      imageUrl: track.image[3]['#text'],
      title: track.name,
      artist: track.artist['#text'],
      album: track.album['#text'],
      url: track.url,
      isPlaying: track['@attr']?.nowplaying === 'true',
    };
  } catch (error) {
    console.error('Error fetching Last.fm data:', error);
    return null;
  }
}

/**
 * Converts external SVG or image to base64
 * @param {string} source - URL or file path
 * @param {string} type - 'svg' or 'gif'
 * @returns {Promise<string>} Base64 encoded data URL
 */
async function imageToBase64(source, type = 'svg') {
  try {
    let content;
    let mimeType = type === 'svg' ? 'image/svg+xml' : `image/${type}`;
    
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      if (type === 'svg') {
        content = await response.text();
        const base64 = Buffer.from(content).toString('base64');
        return `data:${mimeType};base64,${base64}`;
      } else {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${mimeType};base64,${base64}`;
      }
    } else {
      const buffer = fs.readFileSync(source);
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:${mimeType};base64,${base64}`;
    }
  } catch (error) {
    console.error(`Error converting ${type.toUpperCase()} to Base64:`, error);
    return null;
  }
}

/**
 * Updates the SVG with track information
 * @param {Object} trackData - Music track data
 * @returns {Promise<void>}
 */
async function updateMusicBanner(trackData) {
  // Load SVG file
  const svgPath = './banner.svg';
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Parse SVG as XML
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  // Get status icons
  const playIcon = await imageToBase64('public/now-playing.gif', 'gif');
  const pauseIcon = await imageToBase64('public/last-played.svg');
  
  // Update elements
  
  // 1. Album cover
  const coverImage = svgDoc.getElementById('image');
  if (coverImage) {
    let imageUrl = trackData.imageUrl;
    if (!imageUrl || imageUrl === '' || imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
      imageUrl = "public/album-placeholder.webp";
    }
    const coverImageURI = await imageToBase64(imageUrl, 'webp');
    const placeholderURI = 'data:image/webp;base64,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';
    coverImage.setAttribute('src', coverImageURI || placeholderURI);
  }
  
  // 2. Status icon
  const statusIcon = svgDoc.getElementById('status-icon');
  if (statusIcon) {
    statusIcon.setAttribute('src', trackData.isPlaying ? playIcon : pauseIcon);
  }
  
  // 3. Status text
  const statusText = svgDoc.getElementById('status-text');
  if (statusText) {
    statusText.textContent = trackData.isPlaying ? 'Now playing...' : 'Last played...';
  }
  
  // 4. Song name
  const nameElement = svgDoc.getElementById('name');
  if (nameElement) {
    nameElement.textContent = trackData.title || 'Something went wrong';
  }
  
  // 5. Artist name
  const artistElement = svgDoc.getElementById('artist');
  if (artistElement) {
    artistElement.textContent = `by ${trackData.artist || 'Various artist'}`;
  }
  
  // 6. Album name
  const albumElement = svgDoc.getElementById('album');
  if (albumElement) {
    albumElement.textContent = `on ${trackData.album || 'Various album'}`;
  }
  
  // Convert modified DOM back to string
  const serializer = new XMLSerializer();
  const updatedSvgContent = serializer.serializeToString(svgDoc);
  
  // Save the modified SVG
  fs.writeFileSync('banner.svg', updatedSvgContent);
  console.log('Music banner updated successfully.');
}

/**
 * Main function
 */
async function main() {
  try {
    const trackData = await fetchLastFmData();
    if (!trackData) {
      console.error('Failed to fetch track data. Exiting...');
      return;
    }
    
    await updateMusicBanner(trackData);
  } catch (error) {
    console.error('Error updating music banner:', error);
  }
}

// Execute the script
main().catch(console.error);