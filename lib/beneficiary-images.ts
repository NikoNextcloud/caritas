const MAX_SOURCE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 800
const TARGET_SIZE = 80 * 1024
const MAX_STORED_SIZE = 120 * 1024
const MIN_DIMENSION = 360

export interface PreparedBeneficiaryPhoto {
  blob: Blob
  contentType: 'image/webp' | 'image/jpeg'
  extension: 'webp' | 'jpg'
  width: number
  height: number
}

export function validateBeneficiaryPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Изберете файл с изображение')
  if (file.size > MAX_SOURCE_SIZE) throw new Error('Снимката трябва да е до 10 MB')
}

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Снимката не може да бъде прочетена')) }
    image.src = url
  })
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Снимката не може да бъде компресирана')), type, quality)
  })
}

function resizedCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Снимката не може да бъде обработена')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function prepareBeneficiaryPhoto(file: File | Blob): Promise<PreparedBeneficiaryPhoto> {
  if (file instanceof File) validateBeneficiaryPhoto(file)
  const image = await loadImage(file)
  let canvas = resizedCanvas(image, image.naturalWidth, image.naturalHeight, MAX_DIMENSION)
  let contentType: PreparedBeneficiaryPhoto['contentType'] = 'image/webp'
  let extension: PreparedBeneficiaryPhoto['extension'] = 'webp'
  let best: Blob | null = null

  for (;;) {
    for (const quality of [0.76, 0.68, 0.60, 0.52, 0.44, 0.36]) {
      let candidate = await encode(canvas, contentType, quality)
      if (contentType === 'image/webp' && candidate.type !== 'image/webp') {
        contentType = 'image/jpeg'; extension = 'jpg'
        candidate = await encode(canvas, contentType, quality)
      }
      best = candidate
      if (candidate.size <= TARGET_SIZE) {
        return { blob: candidate, contentType, extension, width: canvas.width, height: canvas.height }
      }
    }

    if (Math.max(canvas.width, canvas.height) <= MIN_DIMENSION) break
    canvas = resizedCanvas(canvas, canvas.width, canvas.height, Math.max(MIN_DIMENSION, Math.round(Math.max(canvas.width, canvas.height) * 0.82)))
  }

  if (!best || best.size > MAX_STORED_SIZE) throw new Error('Снимката не може да бъде намалена достатъчно')
  return { blob: best, contentType, extension, width: canvas.width, height: canvas.height }
}

export async function fileFromDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('Старата снимка не може да бъде прочетена')
  return response.blob()
}
