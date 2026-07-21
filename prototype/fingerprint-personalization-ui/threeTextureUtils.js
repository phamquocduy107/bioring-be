/**
 * Texture loading / transform helpers for Ring Fingerprint Viewer.
 */

import * as THREE from 'three';

function configureDataTexture(tex, { srgb = false, flipY = false } = {}) {
  if (!tex) return null;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = flipY;
  tex.needsUpdate = true;
  return tex;
}

function loadTexture(url, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      resolve(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => resolve(configureDataTexture(tex, opts)),
      undefined,
      (err) => reject(new Error(`Không load được texture: ${url}. Kiểm tra CORS/URL. ${err?.message || ''}`))
    );
  });
}

/**
 * Create transparent overlay from heightmap / binary:
 * dark ridges → visible ink, bright bg → transparent.
 */
export async function createOverlayTextureFromImageUrl(
  url,
  color = [20, 20, 20],
  alpha = 220
) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`Không tải được ảnh overlay: ${url}`));
    i.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const [r, g, b] = color;

  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 128) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = alpha;
    } else {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export function applyTextureTransform(texture, state) {
  if (!texture) return;
  texture.offset.set(state.offsetX ?? 0, state.offsetY ?? 0);
  texture.repeat.set(state.repeatX ?? 1, state.repeatY ?? 1);
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(state.rotation ?? 0);
  texture.flipY = !!state.flipY;
  texture.needsUpdate = true;
}

export function disposeTextures(bundle) {
  if (!bundle) return;
  Object.values(bundle).forEach((tex) => {
    if (tex && typeof tex.dispose === 'function') tex.dispose();
  });
}

/**
 * Resolve file URLs from API response (supports alternate keys).
 */
export function resolveFingerprintFileUrls(files = {}) {
  return {
    svg: files.svg || null,
    heightmap: files.heightmap || files.heightMap || null,
    normalMap: files.normalMap || files.normal || null,
    roughnessMap: files.roughnessMap || files.roughness || null,
    aoMap: files.aoMap || files.ao || null,
    overlayPng: files.overlayPng || files.overlay || null,
    alphaMap: files.alphaMap || files.alpha || null,
  };
}

export async function loadFingerprintTextures(files, { flipY = false } = {}) {
  const urls = resolveFingerprintFileUrls(files);
  const [heightmap, normalMap, roughnessMap, aoMap, alphaMap] = await Promise.all([
    loadTexture(urls.heightmap, { flipY }),
    loadTexture(urls.normalMap, { flipY }),
    loadTexture(urls.roughnessMap, { flipY }),
    loadTexture(urls.aoMap, { flipY }),
    loadTexture(urls.alphaMap, { flipY }),
  ]);

  let overlayMap = null;
  if (urls.overlayPng) {
    overlayMap = await loadTexture(urls.overlayPng, { srgb: true, flipY });
  } else if (urls.heightmap) {
    overlayMap = await createOverlayTextureFromImageUrl(urls.heightmap);
    overlayMap.flipY = flipY;
  } else if (urls.svg) {
    // SVG may fail as texture in some browsers; try then fallback
    try {
      overlayMap = await loadTexture(urls.svg, { srgb: true, flipY });
    } catch {
      overlayMap = null;
    }
  }

  return {
    heightmap,
    normalMap,
    roughnessMap,
    aoMap,
    overlayMap,
    alphaMap,
    urls,
  };
}
