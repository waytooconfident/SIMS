import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ThumbnailProps {
  path: string | null
  size?: number
}

// Loads a local image through the images:getDataUrl IPC (the renderer is
// sandboxed, so it can't read file:// paths directly).
export function Thumbnail({ path, size = 40 }: ThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (path) {
      window.api.images.getDataUrl(path).then((u) => { if (alive) setUrl(u) })
    } else {
      setUrl(null)
    }
    return () => { alive = false }
  }, [path])

  // Fixed min+max dimensions so the table cell can't squeeze the image when the
  // window narrows (the table scrolls horizontally instead).
  const box = { width: size, height: size, minWidth: size, minHeight: size, maxWidth: size, maxHeight: size }

  if (!url) {
    return (
      <div style={box} className="flex items-center justify-center rounded-md bg-gray-100 text-gray-300 shrink-0">
        <ImageOff size={size * 0.45} />
      </div>
    )
  }
  // object-contain shows the whole image (no cropping); the box stays square so
  // rows stay aligned, with a light backdrop filling the letterbox area.
  return (
    <img
      src={url}
      style={box}
      className="object-contain rounded-md border border-gray-200 bg-gray-50 dark:bg-gray-900 shrink-0"
      alt=""
    />
  )
}
