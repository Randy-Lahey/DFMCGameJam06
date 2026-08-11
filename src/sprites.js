// Sprites. Each returns SVG markup drawn inside a 64x64 local box.
// Palette is inherited from CSS custom properties on the <svg> root.

(function () {
  const hero = () => `
    <g>
      <ellipse cx="32" cy="55" rx="15" ry="4" fill="var(--cyan)" opacity=".13"/>
      <!-- staff -->
      <line x1="47" y1="20" x2="43" y2="53" stroke="var(--bone)" stroke-width="2" opacity=".7"/>
      <circle cx="47.5" cy="17" r="4" fill="none" stroke="var(--cyan)" stroke-width="2"/>
      <circle cx="47.5" cy="17" r="1.6" fill="var(--cyan)"/>
      <!-- robe -->
      <path d="M32 26 L44 53 L20 53 Z" fill="var(--shell)" opacity=".5"/>
      <path d="M32 26 L44 53 L20 53 Z" fill="none" stroke="var(--shell)" stroke-width="1.6"/>
      <path d="M32 30 L32 53" stroke="var(--cyan)" stroke-width="1" opacity=".55"/>
      <!-- head -->
      <rect x="27" y="19" width="10" height="9" fill="var(--bone)" opacity=".85"/>
      <!-- hat -->
      <path d="M32 4 L43 24 L21 24 Z" fill="var(--void)" stroke="var(--cyan)" stroke-width="1.8"/>
      <path d="M18 24 L46 24" stroke="var(--cyan)" stroke-width="2"/>
      <circle cx="32" cy="18" r="1.8" fill="var(--gold)"/>
    </g>`;

  // CALX — Sal. The residue that wards. Fixed, cubic, incorruptible.
  const calx = () => `
    <g>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="var(--bone)" opacity=".12"/>
      <path d="M32 10 L50 21 L50 43 L32 54 L14 43 L14 21 Z"
            fill="var(--bone)" opacity=".18"/>
      <path d="M32 10 L50 21 L50 43 L32 54 L14 43 L14 21 Z"
            fill="none" stroke="var(--bone)" stroke-width="1.8"/>
      <path d="M32 10 L32 32 M32 32 L50 43 M32 32 L14 43"
            stroke="var(--bone)" stroke-width="1.2" opacity=".65"/>
      <path d="M14 21 L32 32 L50 21" fill="none" stroke="var(--gold)" stroke-width="1.4"/>
      <rect x="27" y="27" width="10" height="10" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1.4"/>
      <circle cx="32" cy="32" r="2" fill="var(--gold)"/>
    </g>`;

  // CINIS — Svlphvr. The pyramid that burns itself.
  const cinis = () => `
    <g>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="var(--blood)" opacity=".18"/>
      <path d="M32 8 L52 52 L12 52 Z" fill="var(--blood)" opacity=".26"/>
      <path d="M32 8 L52 52 L12 52 Z" fill="none" stroke="var(--blood)" stroke-width="1.8"/>
      <path d="M32 22 L42 52 L22 52 Z" fill="var(--gold)" opacity=".3"/>
      <path d="M32 22 L42 52 L22 52 Z" fill="none" stroke="var(--gold)" stroke-width="1.3"/>
      <path d="M25 46 Q32 33 39 46 Q32 41 25 46 Z" fill="var(--gold)"/>
      <circle cx="32" cy="43" r="1.6" fill="var(--bone)"/>
      <path d="M12 52 L52 52" stroke="var(--blood)" stroke-width="2.4"/>
    </g>`;

  // Props
  const stairs = () => `
    <g opacity=".95">
      <path d="M16 44 L26 44 L26 36 L36 36 L36 28 L48 28"
            fill="none" stroke="var(--cyan)" stroke-width="2.4"/>
      <path d="M16 50 L30 50 L30 42 L42 42 L42 34 L52 34"
            fill="none" stroke="var(--cyan)" stroke-width="1.2" opacity=".45"/>
    </g>`;

  const chest = () => `
    <g>
      <path d="M14 30 L50 30 L50 50 L14 50 Z" fill="var(--void)"
            stroke="var(--gold)" stroke-width="2"/>
      <path d="M14 30 L20 22 L44 22 L50 30" fill="var(--gold)" opacity=".22"
            stroke="var(--gold)" stroke-width="1.6"/>
      <path d="M14 38 L50 38" stroke="var(--gold)" stroke-width="1.4"/>
      <rect x="29" y="35" width="6" height="8" fill="var(--gold)"/>
    </g>`;

  const chestOpen = () => `
    <g opacity=".55">
      <path d="M14 34 L50 34 L50 50 L14 50 Z" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1.6"/>
      <path d="M12 32 L18 20 L42 16 L48 26" fill="none"
            stroke="var(--gold)" stroke-width="1.5"/>
      <path d="M14 34 L50 34" stroke="var(--gold)" stroke-width="1.1"/>
      <path d="M22 42 L42 42" stroke="var(--gold)" stroke-width=".9" opacity=".5"/>
    </g>`;

  const spikes = () => `
    <g>
      <path d="M14 50 L20 32 L26 50 L32 32 L38 50 L44 32 L50 50 Z"
            fill="var(--blood)" opacity=".35"/>
      <path d="M14 50 L20 32 L26 50 L32 32 L38 50 L44 32 L50 50"
            fill="none" stroke="var(--blood)" stroke-width="1.8"/>
      <path d="M12 50 L52 50" stroke="var(--blood)" stroke-width="2"/>
    </g>`;

  // The CIRCLE — all three members composed into a single tile token.
  // Hero leads centre-high, daemons flank low. Drawn daemons-first so the
  // operator reads as the front rank.
  const party = () => `
    <g>
      <ellipse cx="32" cy="52" rx="21" ry="6" fill="var(--cyan)" opacity=".10"/>
      <ellipse cx="32" cy="52" rx="21" ry="6" fill="none"
               stroke="var(--cyan)" stroke-width=".8" opacity=".35"/>
      <g transform="translate(1.2,33.2) scale(0.40)">${calx()}</g>
      <g transform="translate(37.2,33.6) scale(0.40)">${cinis()}</g>
      <g transform="translate(10.3,4.4) scale(0.62)">${hero()}</g>
    </g>`;

  // TESTA — Qliphoth. Potsherd; keeps what it is given.
  const testa = () => `
    <g>
      <ellipse cx="32" cy="52" rx="13" ry="3.5" fill="var(--shell)" opacity=".16"/>
      <path d="M32 12 L48 26 L43 50 L21 50 L16 26 Z" fill="var(--shell)" opacity=".24"/>
      <path d="M32 12 L48 26 L43 50 L21 50 L16 26 Z"
            fill="none" stroke="var(--shell)" stroke-width="1.8"/>
      <path d="M32 12 L28 34 L38 38 L32 50" fill="none"
            stroke="var(--shell)" stroke-width="1.1" opacity=".8"/>
      <path d="M24 30 L40 30" stroke="var(--blood)" stroke-width="1.6"/>
      <circle cx="26" cy="30" r="1.6" fill="var(--blood)"/>
      <circle cx="38" cy="30" r="1.6" fill="var(--blood)"/>
    </g>`;

  // SILIQVA — Qliphoth. Empty husk; hollow imitation.
  const siliqva = () => `
    <g>
      <ellipse cx="32" cy="52" rx="11" ry="3.5" fill="var(--blood)" opacity=".16"/>
      <path d="M32 10 C46 20 46 42 32 52 C18 42 18 20 32 10 Z"
            fill="var(--void)" stroke="var(--blood)" stroke-width="1.8"/>
      <path d="M32 16 C41 24 41 40 32 47 C23 40 23 24 32 16 Z"
            fill="var(--blood)" opacity=".18"/>
      <path d="M32 10 L32 52" stroke="var(--blood)" stroke-width="1" opacity=".55"/>
      <circle cx="32" cy="29" r="4.5" fill="var(--void)" stroke="var(--gold)" stroke-width="1.3"/>
      <circle cx="32" cy="29" r="1.4" fill="var(--gold)"/>
    </g>`;

  // ---- drops. Drawn smaller than actors so they never read as a threat ----

  const argent = () => `
    <g>
      <ellipse cx="32" cy="46" rx="10" ry="3" fill="var(--gold)" opacity=".16"/>
      <path d="M32 20 L44 27 L44 41 L32 48 L20 41 L20 27 Z"
            fill="var(--gold)" opacity=".28" stroke="var(--gold)" stroke-width="1.5"/>
      <path d="M20 27 L32 34 L44 27 M32 34 L32 48" fill="none"
            stroke="var(--gold)" stroke-width="1.1" opacity=".8"/>
      <circle cx="32" cy="30" r="2" fill="var(--gold)"/>
    </g>`;

  const flux = () => `
    <g>
      <ellipse cx="32" cy="46" rx="10" ry="3" fill="var(--shell)" opacity=".16"/>
      <rect x="23" y="21" width="18" height="25" fill="var(--void)"
            stroke="var(--shell)" stroke-width="1.6"/>
      <rect x="27" y="26" width="10" height="15" fill="var(--shell)" opacity=".45"/>
      <path d="M32 26 L29 33 L34 33 L31 41" fill="none"
            stroke="var(--bone)" stroke-width="1.3"/>
      <path d="M27 21 L27 17 M37 21 L37 17" stroke="var(--shell)" stroke-width="1.6"/>
    </g>`;

  const databank = () => `
    <g>
      <ellipse cx="32" cy="46" rx="11" ry="3" fill="var(--cyan)" opacity=".16"/>
      <rect x="20" y="24" width="24" height="21" fill="var(--void)"
            stroke="var(--cyan)" stroke-width="1.6"/>
      <path d="M20 31 L44 31 M20 38 L44 38" stroke="var(--cyan)" stroke-width=".9" opacity=".65"/>
      <circle cx="24.5" cy="27.5" r="1.3" fill="var(--cyan)"/>
      <circle cx="24.5" cy="34.5" r="1.3" fill="var(--cyan)"/>
      <circle cx="24.5" cy="41.5" r="1.3" fill="var(--cyan)"/>
      <path d="M17 26 L17 43 M47 26 L47 43" stroke="var(--cyan)" stroke-width="1.2" opacity=".5"/>
    </g>`;

  window.SPRITES = { hero, calx, cinis, party, testa, siliqva,
                     stairs, chest, chestOpen, spikes, argent, flux, databank };
})();
