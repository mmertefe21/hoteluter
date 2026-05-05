/**
 * Icon — lucide-react wrapper
 *
 * Eski hoteluter.html'deki Icon API'siyle uyumlu (name/size/stroke/strokeWidth).
 * `name` kebab-case (örn. "layout-dashboard"); PascalCase'e çevirip lucide-react
 * namespace'inden ilgili componenti çeker. Bilinmeyen isimde sessiz fallback.
 */
import * as LucideIcons from 'lucide-react';

const toPascalCase = (s) =>
  String(s || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

const Icon = ({
  name,
  size = 18,
  className = '',
  stroke = 'currentColor',
  strokeWidth = 2,
  style,
  ...rest
}) => {
  const Cmp = LucideIcons[toPascalCase(name)];

  if (!Cmp) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block ${className}`}
        style={{
          width: size,
          height: size,
          background: 'currentColor',
          opacity: 0.25,
          borderRadius: 2,
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <Cmp
      size={size}
      color={stroke}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  );
};

export default Icon;
