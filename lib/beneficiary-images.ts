const MAX_SOURCE_SIZE = 10 * 1024 * 1024
const MAX_STORED_SIZE = 450 * 1024
const MAX_DIMENSION = 1200

export function validateBeneficiaryPhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Изберете файл с изображение')
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error('Снимката трябва да е до 10 MB')
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Снимката не може да бъде прочетена'))
    }
    image.src = url
  })
}

export async function prepareBeneficiaryPhoto(file: File) {
  validateBeneficiaryPhoto(file)
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Снимката не може да бъде обработена')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let quality = 0.84
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_STORED_SIZE && quality > 0.35) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  if (dataUrl.length > MAX_STORED_SIZE) {
    throw new Error('Снимката е прекалено голяма за запис')
  }
  return dataUrl
}
