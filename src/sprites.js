// Sprites. Each returns SVG markup drawn inside a 64x64 local box.
// Palette is inherited from CSS custom properties on the <svg> root.

(function () {
  const hero = () => `
    <g>
      <ellipse cx="32" cy="55" rx="15" ry="4" fill="var(--cyan)" opacity=".13"/>
      <ellipse cx="32" cy="55" rx="15" ry="4" fill="none" stroke="var(--cyan)"
               stroke-width=".7" opacity=".3"/>
      <!-- staff: segmented shaft, diamond head -->
      <line x1="47" y1="22" x2="44" y2="53" stroke="var(--bone)" stroke-width="2.2" opacity=".8"/>
      <path d="M46.4 28 L48.6 28 M45.8 34 L48 34 M45.2 40 L47.4 40 M44.6 46 L46.8 46"
            stroke="var(--void)" stroke-width="1.1"/>
      <path d="M47.5 11 L52 16 L47.5 21 L43 16 Z" fill="var(--void)"
            stroke="var(--cyan)" stroke-width="1.6"/>
      <rect x="46.1" y="14.6" width="2.8" height="2.8" fill="var(--cyan)"/>
      <!-- coat: high collar, circuit traces -->
      <path d="M22 28 L26 25 L38 25 L42 28 L45 52 L36 52 L36 44 L28 44 L28 52 L19 52 Z"
            fill="var(--shell)" opacity=".42"/>
      <path d="M22 28 L26 25 L38 25 L42 28 L45 52 L36 52 L36 44 L28 44 L28 52 L19 52 Z"
            fill="none" stroke="var(--shell)" stroke-width="1.7"/>
      <path d="M32 27 L32 43" stroke="var(--cyan)" stroke-width="1.1" opacity=".8"/>
      <path d="M29.5 30 L34.5 30 M29.5 34 L34.5 34 M29.5 38 L34.5 38"
            stroke="var(--gold)" stroke-width="1" opacity=".8"/>
      <path d="M25 32 L25 38 L27 40 M39 32 L39 38 L37 40"
            fill="none" stroke="var(--cyan)" stroke-width=".9" opacity=".55"/>
      <circle cx="27" cy="41" r=".9" fill="var(--cyan)" opacity=".8"/>
      <circle cx="37" cy="41" r=".9" fill="var(--cyan)" opacity=".8"/>
      <!-- head: visor -->
      <rect x="27" y="18" width="10" height="8" fill="var(--bone)" opacity=".9"/>
      <rect x="28.5" y="23.6" width="7" height="2.2" fill="var(--cyan)"/>
      <!-- hat: tall cone, brim, gold diamond badge -->
      <path d="M32 2 L42 22 L22 22 Z" fill="var(--void)" stroke="var(--cyan)" stroke-width="1.8"/>
      <path d="M17 22 L47 22" stroke="var(--cyan)" stroke-width="2.2"/>
      <path d="M32 12 L35 16 L32 20 L29 16 Z" fill="none" stroke="var(--gold)" stroke-width="1.3"/>
      <rect x="31" y="15" width="2" height="2" fill="var(--gold)"/>
      <circle cx="32" cy="2.6" r="1.4" fill="var(--cyan)"/>
    </g>`;

  // CALX — Sal. The residue that wards. Fixed, cubic, incorruptible.
  const calx = () => `
    <g>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="var(--bone)" opacity=".12"/>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="none" stroke="var(--bone)"
               stroke-width=".7" opacity=".28"/>
      <path d="M32 9 L51 20 L51 43 L32 54 L13 43 L13 20 Z" fill="var(--bone)" opacity=".14"/>
      <path d="M32 9 L51 20 L51 43 L32 54 L13 43 L13 20 Z"
            fill="none" stroke="var(--bone)" stroke-width="1.9"/>
      <path d="M32 9 L32 31 M32 31 L51 43 M32 31 L13 43"
            stroke="var(--bone)" stroke-width="1.2" opacity=".6"/>
      <!-- gold band across the shoulders of the cube -->
      <path d="M13 20 L32 31 L51 20" fill="none" stroke="var(--gold)" stroke-width="2"/>
      <path d="M13 24 L32 35 L51 24" fill="none" stroke="var(--gold)"
            stroke-width=".9" opacity=".55"/>
      <!-- faint inner lattice on the front faces -->
      <path d="M22 37 L22 46 M42 37 L42 46 M18 32 L27 37 M46 32 L37 37"
            stroke="var(--bone)" stroke-width=".8" opacity=".35"/>
      <!-- front plate: pentagon seal with diamond core -->
      <path d="M32 27 L40 31 L38 41 L26 41 L24 31 Z" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1.5"/>
      <path d="M32 30 L36 34 L32 38 L28 34 Z" fill="none" stroke="var(--gold)" stroke-width="1.2"/>
      <rect x="30.8" y="32.8" width="2.4" height="2.4" fill="var(--gold)"/>
    </g>`;

  // CINIS — Svlphvr. The pyramid that burns itself.
  const cinis = () => `
    <g>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="var(--blood)" opacity=".18"/>
      <ellipse cx="32" cy="54" rx="14" ry="4" fill="none" stroke="var(--blood)"
               stroke-width=".7" opacity=".35"/>
      <path d="M32 7 L53 52 L11 52 Z" fill="var(--blood)" opacity=".22"/>
      <path d="M32 7 L53 52 L11 52 Z" fill="none" stroke="var(--blood)" stroke-width="1.9"/>
      <path d="M32 17 L45 48 L19 48 Z" fill="none" stroke="var(--gold)" stroke-width="1.4"/>
      <!-- flame: outer tongue, inner tongue, bone core -->
      <path d="M32 26 Q39 34 37 41 Q36 45 32 46 Q28 45 27 41 Q25 34 32 26 Z"
            fill="var(--gold)" opacity=".85"/>
      <path d="M32 33 Q35 37 34 41 Q33 43 32 43.5 Q31 43 30 41 Q29 37 32 33 Z"
            fill="var(--bone)" opacity=".9"/>
      <!-- vents under the fire -->
      <path d="M26 50 L26 48 M29 50 L29 48 M32 50 L32 48 M35 50 L35 48 M38 50 L38 48"
            stroke="var(--gold)" stroke-width="1.2"/>
      <path d="M11 52 L53 52" stroke="var(--blood)" stroke-width="2.4"/>
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

  // Stairs with the seal still on them: the way down, struck through.
  const stairsSealed = () => `
    <g>
      <g opacity=".3">
        <path d="M16 44 L26 44 L26 36 L36 36 L36 28 L48 28"
              fill="none" stroke="var(--cyan)" stroke-width="2.4"/>
      </g>
      <path d="M14 22 L50 50 M50 22 L14 50" stroke="var(--blood)"
            stroke-width="2" opacity=".85"/>
      <rect x="12" y="20" width="40" height="32" fill="none"
            stroke="var(--blood)" stroke-width="1" opacity=".45"/>
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
      <ellipse cx="32" cy="52" rx="25" ry="7.5" fill="none" stroke="var(--cyan)"
               stroke-width=".7" opacity=".3" stroke-dasharray="2.5 3.5"/>
      <g transform="translate(1.2,33.2) scale(0.40)">${calx()}</g>
      <g transform="translate(37.2,33.6) scale(0.40)">${cinis()}</g>
      <g transform="translate(10.3,4.4) scale(0.62)">${hero()}</g>
    </g>`;

  // TESTA — Qliphoth. Potsherd; keeps what it is given.
  const testa = () => `
    <g>
      <ellipse cx="32" cy="52" rx="13" ry="3.5" fill="var(--shell)" opacity=".16"/>
      <!-- coffin shell -->
      <path d="M32 8 L46 17 L48 34 L42 52 L22 52 L16 34 L18 17 Z"
            fill="var(--shell)" opacity=".26"/>
      <path d="M32 8 L46 17 L48 34 L42 52 L22 52 L16 34 L18 17 Z"
            fill="none" stroke="var(--shell)" stroke-width="1.9"/>
      <path d="M32 8 L46 17 L48 34 L42 52 L22 52 L16 34 L18 17 Z"
            fill="none" stroke="var(--shell)" stroke-width=".8" opacity=".5"
            transform="translate(32 30) scale(.86) translate(-32 -30)"/>
      <!-- red visor with pip eyes -->
      <rect x="22" y="24" width="20" height="9" fill="var(--void)"
            stroke="var(--blood)" stroke-width="1.6"/>
      <rect x="25" y="26.5" width="2.2" height="2.2" fill="var(--blood)"/>
      <rect x="28.4" y="26.5" width="2.2" height="2.2" fill="var(--blood)"/>
      <rect x="33.4" y="26.5" width="2.2" height="2.2" fill="var(--blood)"/>
      <rect x="36.8" y="26.5" width="2.2" height="2.2" fill="var(--blood)"/>
      <!-- circuit chin -->
      <path d="M26 39 L38 39 M32 39 L32 44 M28 44 L36 44"
            stroke="var(--shell)" stroke-width="1" opacity=".7"/>
      <rect x="30.6" y="46.5" width="2.8" height="1.8" fill="none"
            stroke="var(--shell)" stroke-width=".9" opacity=".7"/>
      <path d="M32 4 L34 6 L32 8 L30 6 Z" fill="var(--shell)" opacity=".8"/>
    </g>`;

  // SILIQVA — Qliphoth. Empty husk; hollow imitation.
  const siliqva = () => `
    <g>
      <ellipse cx="32" cy="52" rx="11" ry="3.5" fill="var(--blood)" opacity=".16"/>
      <!-- husk: doubled vesica -->
      <path d="M32 8 C47 19 47 43 32 54 C17 43 17 19 32 8 Z"
            fill="var(--void)" stroke="var(--blood)" stroke-width="1.9"/>
      <path d="M32 13 C43 22 43 41 32 49 C21 41 21 22 32 13 Z"
            fill="var(--blood)" fill-opacity=".14" stroke="var(--blood)"
            stroke-width=".9" stroke-opacity=".6"/>
      <path d="M32 8 L32 54" stroke="var(--blood)" stroke-width="1" opacity=".5"/>
      <!-- vein tendrils -->
      <path d="M32 18 L27 23 L27 27 M32 44 L37 40 L37 36"
            fill="none" stroke="var(--blood)" stroke-width=".9" opacity=".55"/>
      <circle cx="27" cy="28.4" r=".9" fill="var(--blood)" opacity=".7"/>
      <circle cx="37" cy="34.6" r=".9" fill="var(--blood)" opacity=".7"/>
      <!-- gold diamond core, hollow glyph -->
      <path d="M32 22 L40 31 L32 40 L24 31 Z" fill="var(--gold)" opacity=".28"/>
      <path d="M32 22 L40 31 L32 40 L24 31 Z" fill="none" stroke="var(--gold)" stroke-width="1.5"/>
      <rect x="30.9" y="27" width="2.2" height="8" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1"/>
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
                     stairs, stairsSealed, chest, chestOpen, spikes, argent, flux, databank };
})();
