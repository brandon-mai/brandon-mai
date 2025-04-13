import React from "react";
import satori from "satori";
import { twi, twj } from "tw-to-css";
import { JSDOM } from "jsdom";
import fs from "fs";
import fetch from "node-fetch";
import { renderToString } from "react-dom/server";


function htmlToJSX(htmlString, mode) {
  const dom = new JSDOM(`<body>${htmlString}</body>`);
  
  function processNode(node) {
    // Handle text nodes
    if (node.nodeType === 3) {
      return node.nodeValue;
    }
    
    // Skip comment nodes
    if (node.nodeType === 8) {
      return null;
    }
    
    // Process element nodes' attributes
    if (node.nodeType === 1) {
      const props = {};
      
      Array.from(node.attributes).forEach(attr => {
        if (attr.name === "class") {
          // Convert Tailwind classes to inline styles
          try {
            props.style = twj(attr.value);
          } catch (error) {
            console.warn(`Failed to convert Tailwind classes: ${attr.value}`, error);
            props.className = attr.value;
          }
        } 
        else if (attr.name === "style") {
          // Parse inline styles
          const styleObj = {};
          attr.value.split(';').forEach(stylePair => {
            if (stylePair.trim()) {
              const [key, value] = stylePair.split(':');
              if (key && value) {
                styleObj[key.trim()] = value.trim();
              }
            }
          });
          props.style = props.style ? { ...props.style, ...styleObj } : styleObj;
        }
        else {
          props[attr.name === "for" ? "htmlFor" : attr.name] = attr.value;
        }
      });
      
      // Process children
      const children = Array.from(node.childNodes)
        .map(processNode)
        .filter(child => child !== null);
      
      // Create React element
      return React.createElement(
        node.nodeName.toLowerCase(),
        Object.keys(props).length > 0 ? props : null,
        children.length > 0 ? children : undefined
      );
    }
    
    return null;
  }
  
  // Process all body children to handle multiple root elements
  const bodyChildren = Array.from(dom.window.document.body.childNodes)
    .map(processNode)
    .filter(child => child !== null);
  
  // If only one root element, return it directly
  if (bodyChildren.length === 1) {
    console.log('Single root element found, returning directly.');
    return bodyChildren[0];
  }
  
  // Otherwise wrap in a fragment
  console.log('Multiple root elements found, wrapping in a fragment.');
  return React.createElement(React.Fragment, null, bodyChildren);
}


function modifyJSX(element, trackData) {
  if (typeof element !== 'object' || element === null) {
    return element;
  }
  
  const newElement = {...element};
  
  if (newElement.props) {
    // cover image
    if (newElement.type === 'img' && newElement.props.id === 'image') {
      newElement.props = {...newElement.props};
      newElement.props.src = trackData.imageUrl || newElement.props.src;
    }

    // listening status
    if (newElement.props.id === 'status-icon') {
      newElement.props = {...newElement.props};
      newElement.props.children = trackData.isPlaying ? '▶️' : '⏸️';
    }
    if (newElement.props.id === 'status-text') {
      newElement.props = {...newElement.props};
      newElement.props.children = trackData.isPlaying ? 'Now playing...' : 'Last played...';
    }
    
    // song name
    if (newElement.props.id === 'name') {
      newElement.props = {...newElement.props};
      newElement.props.children = trackData.title || 'Something went wrong';
    }

    // artist name
    if (newElement.props.id === 'artist') {
      newElement.props = {...newElement.props};
      newElement.props.children = trackData.artist || 'Various artist';
    }

    // album name
    if (newElement.props.id === 'album') {
      newElement.props = {...newElement.props};
      newElement.props.children = trackData.album || 'Various album';
    }
    
    // Recursively process children if they exist
    if (Array.isArray(newElement.props.children)) {
      newElement.props = {...newElement.props};
      newElement.props.children = newElement.props.children.map(
        child => modifyJSX(child, trackData)
      );
    } else if (newElement.props.children && typeof newElement.props.children === 'object') {
      newElement.props = {...newElement.props};
      newElement.props.children = modifyJSX(newElement.props.children, trackData);
    }
  }
  
  return newElement;
}


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
      artist: `by ${track.artist['#text']}`,
      album: `on ${track.album['#text']}`,
      url: track.url,
      isPlaying: track['@attr']?.nowplaying === 'true',
    };
  } catch (error) {
    console.error('Error fetching Last.fm data:', error);
    return null;
  }
}


async function svgToBase64(source) {
  try {
    let content;
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.statusText}`);
      }
      content = await response.text();
    } else {
      content = fs.readFileSync(source, 'utf8');
    }
    const base64 = Buffer.from(content).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.error('Error converting SVG to Base64:', error);
    return null;
  }
}


async function gifToBase64(source) {
  try {
    let buffer;
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch GIF: ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
    } else {
      buffer = fs.readFileSync(source);
    }
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/gif;base64,${base64}`;
  } catch (error) {
    console.error('Error converting GIF to Base64:', error);
    return null;
  }
}


// GLOBAL OPTIONS
const fontResponse = await fetch(
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&family=Noto+Sans+JP:wght@100..900&display=swap'
);
const fontList = await fontResponse.text();
// parse URLs
const fontUrlMatches = Array.from(fontList.matchAll(/url\(([^)]+)\)/g));
const fontUrls = fontUrlMatches.map(match => match[1].replace(/["']/g, ''));

// parse weights
const fontWeightMatches = Array.from(fontList.matchAll(/font-weight:\s*(\d+)/g));
const fontWeights = fontWeightMatches.map(match => parseInt(match[1]));

// parse font family
const fontFamilyMatches = Array.from(fontList.matchAll(/font-family:\s*([^;]+)/g));
const fontFamilies = fontFamilyMatches.map(match => match[1].replace(/["']/g, '').trim());

// Fetch all font files in parallel
console.log(`Fetching ${fontUrls.length} font variations...`);
const fontBuffers = await Promise.all(
  fontUrls.map(async (url, index) => {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return {
      data: buffer,
      weight: fontWeights[index],
      family: fontFamilies[index],
    };
  })
);

const fontConfigs = fontBuffers.map(font => ({
  name: font.family,
  data: font.data,
  weight: font.weight,
  style: 'normal',
}));

console.log(`Loaded ${fontConfigs.length} font variations`);

const musicIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3b5.svg');
const holoIcon = await svgToBase64('https://upload.wikimedia.org/wikipedia/commons/3/3b/Hololive_triangles_logo.svg');
const teaIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2615.svg');
const outdoorIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f304.svg');
const coolIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f60e.svg');
const nerdIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f913.svg');
const toolIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f6e0.svg');
const laptopIcon = await svgToBase64('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4bb.svg');
const playIcon = await gifToBase64('now-playing.gif');
const pauseIcon = await svgToBase64('last-played.svg');

const satoriOptions = {
  embedFont: true,
  fonts: fontConfigs,
  graphemeImages: {
    '🎵': musicIcon,
    '🩵': holoIcon,
    '🍵': teaIcon,
    '🌄': outdoorIcon,
    '😎': coolIcon,
    '🤓': nerdIcon,
    '🛠️': toolIcon,
    '💻': laptopIcon,
    '▶️': playIcon,
    '⏸️': pauseIcon,
  },
};

const satoriOptionsLarge = {...satoriOptions, width: 850, height: 510};


async function renderImage() {
  const htmlContent = fs.readFileSync('test.html', 'utf8');
  const bodyContent = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const bodyJSX = htmlToJSX(bodyContent);
  const trackData = await fetchLastFmData();
  if (!trackData) {
    console.error('Failed to fetch track data. Exiting...');
    return;
  }
  const modifiedJSX = modifyJSX(bodyJSX, trackData);
  // console.log(renderToString(bodyJSX));

  const svg = await satori(modifiedJSX, satoriOptionsLarge);
  
  fs.writeFileSync('profile.svg', svg);
  console.log('Image generated successfully.');
}

renderImage().catch(console.error);