import React from 'react';

function Logo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Lion head - geometric style inspired by MetaMask fox */}

      {/* Main face base */}
      <path
        d="M50 85 L25 70 L20 45 L30 25 L50 15 L70 25 L80 45 L75 70 Z"
        fill="url(#lionGradient)"
        stroke="#f0b90b"
        strokeWidth="2"
      />

      {/* Mane left side */}
      <path
        d="M25 70 L15 60 L12 45 L20 30 L30 25"
        fill="#d4a00a"
        opacity="0.8"
      />

      {/* Mane right side */}
      <path
        d="M75 70 L85 60 L88 45 L80 30 L70 25"
        fill="#d4a00a"
        opacity="0.8"
      />

      {/* Mane top left */}
      <path
        d="M30 25 L25 15 L35 10 L50 15"
        fill="#d4a00a"
        opacity="0.9"
      />

      {/* Mane top right */}
      <path
        d="M70 25 L75 15 L65 10 L50 15"
        fill="#d4a00a"
        opacity="0.9"
      />

      {/* Inner face */}
      <path
        d="M50 75 L32 65 L30 45 L38 30 L50 25 L62 30 L70 45 L68 65 Z"
        fill="url(#faceGradient)"
      />

      {/* Left eye */}
      <ellipse
        cx="40"
        cy="45"
        rx="6"
        ry="8"
        fill="#1e2329"
      />
      <ellipse
        cx="41"
        cy="43"
        rx="2"
        ry="3"
        fill="#ffffff"
      />

      {/* Right eye */}
      <ellipse
        cx="60"
        cy="45"
        rx="6"
        ry="8"
        fill="#1e2329"
      />
      <ellipse
        cx="61"
        cy="43"
        rx="2"
        ry="3"
        fill="#ffffff"
      />

      {/* Nose bridge */}
      <path
        d="M50 48 L48 58 L52 58 Z"
        fill="#d4a00a"
      />

      {/* Nose */}
      <path
        d="M44 58 L50 62 L56 58 L50 60 Z"
        fill="#1e2329"
      />

      {/* Mouth left */}
      <path
        d="M50 62 L42 64 L40 62"
        stroke="#1e2329"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Mouth right */}
      <path
        d="M50 62 L58 64 L60 62"
        stroke="#1e2329"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Whisker marks left */}
      <circle cx="35" cy="55" r="1.5" fill="#d4a00a" />
      <circle cx="33" cy="58" r="1.5" fill="#d4a00a" />
      <circle cx="35" cy="61" r="1.5" fill="#d4a00a" />

      {/* Whisker marks right */}
      <circle cx="65" cy="55" r="1.5" fill="#d4a00a" />
      <circle cx="67" cy="58" r="1.5" fill="#d4a00a" />
      <circle cx="65" cy="61" r="1.5" fill="#d4a00a" />

      {/* Gradients */}
      <defs>
        <linearGradient id="lionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0b90b" />
          <stop offset="100%" stopColor="#d4a00a" />
        </linearGradient>
        <linearGradient id="faceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d060" />
          <stop offset="100%" stopColor="#f0b90b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default Logo;
