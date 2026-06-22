interface AvatarViewProps {
  avatar: string          // emoji, or a "data:image/..." URL
  size: number
  rounded?: string        // tailwind rounding class
  bg?: string
}

// Renders a user avatar — either a dropped photo (data URL) or an emoji.
export function AvatarView({ avatar, size, rounded = 'rounded-2xl', bg = 'bg-gray-700' }: AvatarViewProps) {
  const isImg = typeof avatar === 'string' && avatar.startsWith('data:')
  return (
    <div
      style={{ width: size, height: size }}
      className={`${rounded} ${bg} flex items-center justify-center overflow-hidden shrink-0`}
    >
      {isImg
        ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{avatar || '🐱'}</span>}
    </div>
  )
}
