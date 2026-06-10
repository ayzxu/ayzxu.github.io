/* ==========================================================================
   Thumb — a click-to-enlarge 1-bit thumbnail. A real <button> wrapper makes
   the lightbox reachable by keyboard (Tab + Enter/Space), not just mouse.
   ========================================================================== */

type ThumbProps = {
  src: string;
  alt: string;
  onOpen: (src: string, alt: string) => void;
};

export default function Thumb({ src, alt, onOpen }: ThumbProps) {
  return (
    <button
      type="button"
      className="thumb-button"
      aria-label={`Enlarge image: ${alt}`}
      onClick={() => onOpen(src, alt)}
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="thumb bw-img pixelated"
      />
    </button>
  );
}
