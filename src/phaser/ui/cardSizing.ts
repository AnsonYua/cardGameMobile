type TextureSource = {
  width?: number;
  height?: number;
};

type TextureLike = {
  getSourceImage: () => TextureSource | null | undefined;
};

type TextureManagerLike = {
  exists: (key: string) => boolean;
  get: (key: string) => TextureLike | null | undefined;
};

type TextureSceneLike = {
  textures: TextureManagerLike;
};

export type CardDisplaySize = {
  width: number;
  height: number;
};

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toTargetSize = (width: number, height: number) => ({
  width: Math.max(1, Math.round(width)),
  height: Math.max(1, Math.round(height)),
});

export function getTextureSourceSize(scene: TextureSceneLike, textureKey?: string): CardDisplaySize | null {
  if (!textureKey) return null;
  if (!scene?.textures?.exists(textureKey)) return null;
  const texture = scene.textures.get(textureKey);
  if (!texture) return null;
  const source = texture.getSourceImage();
  const width = toPositiveNumber(source?.width);
  const height = toPositiveNumber(source?.height);
  if (!width || !height) return null;
  return { width, height };
}

export function computeContainSize(sourceW: number, sourceH: number, targetW: number, targetH: number): CardDisplaySize {
  const sourceWidth = toPositiveNumber(sourceW);
  const sourceHeight = toPositiveNumber(sourceH);
  const target = toTargetSize(targetW, targetH);
  if (!sourceWidth || !sourceHeight) return target;
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function computeDisplaySizeFromTexture(
  scene: TextureSceneLike,
  textureKey: string | undefined,
  targetW: number,
  targetH: number,
  fallbackAspect?: number,
): CardDisplaySize {
  const target = toTargetSize(targetW, targetH);
  const sourceSize = getTextureSourceSize(scene, textureKey);
  if (sourceSize) {
    return computeContainSize(sourceSize.width, sourceSize.height, target.width, target.height);
  }
  const aspect = toPositiveNumber(fallbackAspect);
  if (!aspect) return target;
  const width = Math.min(target.width, target.height * aspect);
  const height = width / aspect;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}
