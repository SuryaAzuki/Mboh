import React from 'react';
import {
  COUNTRY_NAMES,
  getRiderFaceStyle,
  type NationalityCode,
  type TeamLivery,
} from '../game/types';

interface NationalFlagProps {
  code: NationalityCode;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const NationalFlag: React.FC<NationalFlagProps> = ({
  code,
  size = 'sm',
  className = '',
}) => {
  const dim =
    size === 'xs' ? 'w-4 h-3' : size === 'md' ? 'w-7 h-5' : 'w-5 h-3.5';
  const title = COUNTRY_NAMES[code] ?? code;

  const renderArtwork = () => {
    switch (code) {
      case 'IT':
        return (
          <>
            <rect width="8" height="16" fill="#16a34a" />
            <rect x="8" width="8" height="16" fill="#f8fafc" />
            <rect x="16" width="8" height="16" fill="#dc2626" />
          </>
        );
      case 'FR':
        return (
          <>
            <rect width="8" height="16" fill="#1d4ed8" />
            <rect x="8" width="8" height="16" fill="#f8fafc" />
            <rect x="16" width="8" height="16" fill="#dc2626" />
          </>
        );
      case 'BE':
        return (
          <>
            <rect width="8" height="16" fill="#111827" />
            <rect x="8" width="8" height="16" fill="#facc15" />
            <rect x="16" width="8" height="16" fill="#dc2626" />
          </>
        );
      case 'ES':
        return (
          <>
            <rect width="24" height="4" fill="#dc2626" />
            <rect y="4" width="24" height="8" fill="#facc15" />
            <rect y="12" width="24" height="4" fill="#dc2626" />
            <rect x="5.5" y="5.5" width="3" height="5" rx="0.8" fill="#b91c1c" />
          </>
        );
      case 'NL':
        return (
          <>
            <rect width="24" height="5.33" fill="#dc2626" />
            <rect y="5.33" width="24" height="5.34" fill="#f8fafc" />
            <rect y="10.67" width="24" height="5.33" fill="#1d4ed8" />
          </>
        );
      case 'CO':
        return (
          <>
            <rect width="24" height="8" fill="#facc15" />
            <rect y="8" width="24" height="4" fill="#1d4ed8" />
            <rect y="12" width="24" height="4" fill="#dc2626" />
          </>
        );
      case 'ID':
        return (
          <>
            <rect width="24" height="8" fill="#dc2626" />
            <rect y="8" width="24" height="8" fill="#f8fafc" />
          </>
        );
      case 'JP':
        return (
          <>
            <rect width="24" height="16" fill="#f8fafc" />
            <circle cx="12" cy="8" r="4.5" fill="#dc2626" />
          </>
        );
      case 'PT':
        return (
          <>
            <rect width="9" height="16" fill="#15803d" />
            <rect x="9" width="15" height="16" fill="#dc2626" />
            <circle cx="9" cy="8" r="3.4" fill="#facc15" />
            <circle cx="9" cy="8" r="2.1" fill="#dc2626" />
          </>
        );
      case 'TH':
        return (
          <>
            <rect width="24" height="2.6" fill="#dc2626" />
            <rect y="2.6" width="24" height="2.6" fill="#f8fafc" />
            <rect y="5.2" width="24" height="5.6" fill="#1e3a8a" />
            <rect y="10.8" width="24" height="2.6" fill="#f8fafc" />
            <rect y="13.4" width="24" height="2.6" fill="#dc2626" />
          </>
        );
      case 'CZ':
        return (
          <>
            <rect width="24" height="8" fill="#f8fafc" />
            <rect y="8" width="24" height="8" fill="#dc2626" />
            <polygon points="0,0 11,8 0,16" fill="#1d4ed8" />
          </>
        );
      case 'TR':
        return (
          <>
            <rect width="24" height="16" fill="#dc2626" />
            <circle cx="10.2" cy="8" r="4.2" fill="#f8fafc" />
            <circle cx="11.5" cy="8" r="3.3" fill="#dc2626" />
            <circle cx="14.5" cy="8" r="1.3" fill="#f8fafc" />
          </>
        );
      case 'ZA':
        return (
          <>
            <rect width="24" height="5.5" fill="#dc2626" />
            <rect y="5.5" width="24" height="5" fill="#f8fafc" />
            <rect y="10.5" width="24" height="5.5" fill="#1d4ed8" />
            <polygon points="0,0 12,8 0,16" fill="#111827" />
            <polygon points="0,2.5 9.5,8 0,13.5" fill="#facc15" />
            <polygon points="0,0 2.5,0 12,6.4 24,6.4 24,9.6 12,9.6 2.5,16 0,16 9,8" fill="#16a34a" />
          </>
        );
      case 'BR':
        return (
          <>
            <rect width="24" height="16" fill="#16a34a" />
            <polygon points="12,2 21,8 12,14 3,8" fill="#facc15" />
            <circle cx="12" cy="8" r="3.4" fill="#1d4ed8" />
            <path d="M9 8.2 Q12 6.8 15 8.2" stroke="#f8fafc" strokeWidth="1" fill="none" />
          </>
        );
      case 'US':
        return (
          <>
            <rect width="24" height="16" fill="#f8fafc" />
            <rect y="0" width="24" height="2.4" fill="#dc2626" />
            <rect y="4.6" width="24" height="2.4" fill="#dc2626" />
            <rect y="9.2" width="24" height="2.4" fill="#dc2626" />
            <rect y="13.6" width="24" height="2.4" fill="#dc2626" />
            <rect width="10.5" height="9.2" fill="#1e3a8a" />
            <circle cx="3.2" cy="3" r="0.8" fill="#f8fafc" />
            <circle cx="7.2" cy="3" r="0.8" fill="#f8fafc" />
            <circle cx="5.2" cy="6" r="0.8" fill="#f8fafc" />
          </>
        );
      case 'AU':
        return (
          <>
            <rect width="24" height="16" fill="#1e3a8a" />
            <rect width="11" height="8" fill="#1e40af" />
            <rect x="4.6" width="1.8" height="8" fill="#f8fafc" />
            <rect y="3.1" width="11" height="1.8" fill="#f8fafc" />
            <rect x="5" width="1" height="8" fill="#dc2626" />
            <rect y="3.5" width="11" height="1" fill="#dc2626" />
            <circle cx="17.5" cy="5" r="1.1" fill="#f8fafc" />
            <circle cx="19.5" cy="9" r="1" fill="#f8fafc" />
            <circle cx="16.5" cy="11.5" r="1.2" fill="#f8fafc" />
            <circle cx="5.5" cy="12" r="1.5" fill="#f8fafc" />
          </>
        );
      case 'GB':
      default:
        return (
          <>
            <rect width="24" height="16" fill="#1e3a8a" />
            <line x1="0" y1="0" x2="24" y2="16" stroke="#f8fafc" strokeWidth="3.2" />
            <line x1="24" y1="0" x2="0" y2="16" stroke="#f8fafc" strokeWidth="3.2" />
            <line x1="0" y1="0" x2="24" y2="16" stroke="#dc2626" strokeWidth="1.4" />
            <line x1="24" y1="0" x2="0" y2="16" stroke="#dc2626" strokeWidth="1.4" />
            <rect x="9.8" width="4.4" height="16" fill="#f8fafc" />
            <rect y="5.8" width="24" height="4.4" fill="#f8fafc" />
            <rect x="10.8" width="2.4" height="16" fill="#dc2626" />
            <rect y="6.8" width="24" height="2.4" fill="#dc2626" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 24 16"
      role="img"
      aria-label={`${title} flag`}
      className={`${dim} rounded-[2px] border border-white/25 shrink-0 shadow-xs ${className}`}
    >
      <title>{title}</title>
      {renderArtwork()}
    </svg>
  );
};

interface RiderMiniFaceProps {
  livery: TeamLivery;
  size?: 'xs' | 'sm' | 'md';
  showFlag?: boolean;
}

export const RiderMiniFace: React.FC<RiderMiniFaceProps> = ({
  livery,
  size = 'sm',
  showFlag = false,
}) => {
  const face = getRiderFaceStyle(livery);
  const pxClass =
    size === 'xs'
      ? 'w-6 h-6'
      : size === 'md'
      ? 'w-10 h-10'
      : 'w-8 h-8';

  const browTilt = face.browStyle === 2 ? -1 : face.browStyle === 1 ? 0.6 : 0;

  return (
    <div className="relative inline-flex items-center shrink-0">
      <svg
        viewBox="0 0 36 36"
        aria-label={`${livery.riderName} portrait`}
        className={`${pxClass} rounded-lg border border-white/25 shadow-sm shrink-0`}
        style={{ backgroundColor: livery.secondaryHex }}
      >
        {/* Colored Racing Leathers Collar / Shoulders */}
        <path
          d="M4 36 C5 27, 11 25, 18 25 C25 25, 31 27, 32 36 Z"
          fill={livery.primaryHex}
        />
        <path
          d="M11 26 L18 32 L25 26"
          fill="none"
          stroke={livery.accentHex}
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Neck */}
        <rect x="14.5" y="21" width="7" height="6" rx="2.5" fill={face.skinHex} />

        {/* Ears */}
        <circle cx="10" cy="16.5" r="2.1" fill={face.skinHex} />
        <circle cx="26" cy="16.5" r="2.1" fill={face.skinHex} />

        {/* Head */}
        <rect x="10.2" y="7.5" width="15.6" height="17" rx="7.6" fill={face.skinHex} />

        {/* Hair / Helmet cap crest */}
        <path
          d="M10 14 C10 7.2, 13.5 5.2, 18 5.2 C22.5 5.2, 26 7.4, 26 14 C24.2 10.6, 21.5 9.6, 18 9.6 C14.5 9.6, 11.8 10.6, 10 14 Z"
          fill={face.hairHex}
        />

        {/* Brows & Eyes */}
        <line
          x1="13"
          y1={14 + browTilt}
          x2="16.2"
          y2="13.8"
          stroke={face.hairHex}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="19.8"
          y1="13.8"
          x2="23"
          y2={14 + browTilt}
          stroke={face.hairHex}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="14.6" cy="15.8" r="1.15" fill="#0f172a" />
        <circle cx="21.4" cy="15.8" r="1.15" fill="#0f172a" />

        {/* Subtle Beard Shadow if configured */}
        {face.beard && (
          <path
            d="M11.6 18.6 C12.4 23.2, 14.8 24.4, 18 24.4 C21.2 24.4, 23.6 23.2, 24.4 18.6 C22.8 20.6, 20.6 21.3, 18 21.3 C15.4 21.3, 13.2 20.6, 11.6 18.6 Z"
            fill={face.hairHex}
            fillOpacity="0.65"
          />
        )}

        {/* Confident Racer Smile / Nose */}
        <path
          d="M16 20.4 Q18 21.7 20 20.4"
          fill="none"
          stroke="#7c2d12"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>

      {showFlag && (
        <span className="absolute -bottom-1 -right-1">
          <NationalFlag code={livery.nationality} size="xs" />
        </span>
      )}
    </div>
  );
};
