// Sprites. Each returns SVG markup drawn inside a 64x64 local box.
// Palette is inherited from CSS custom properties on the <svg> root.

(function () {
  const hero = () => `
    <g>
      <ellipse cx="32" cy="55" rx="16" ry="4" fill="var(--cyan)" opacity=".12"/>
      <ellipse cx="32" cy="55" rx="16" ry="4" fill="none" stroke="var(--cyan)" stroke-width=".7" opacity=".3"/>
      <!-- halo: double hex + corner motes -->
      <path d="M32 12 L45 19.5 L45 34.5 L32 42 L19 34.5 L19 19.5 Z" fill="none"
            stroke="var(--cyan)" stroke-width=".8" opacity=".28"/>
      <path d="M32 15 L42.5 21 L42.5 33 L32 39 L21.5 33 L21.5 21 Z" fill="none"
            stroke="var(--cyan)" stroke-width=".5" opacity=".18"/>
      <circle cx="45" cy="19.5" r=".8" fill="var(--cyan)" opacity=".5"/>
      <circle cx="19" cy="34.5" r=".8" fill="var(--cyan)" opacity=".5"/>
      <!-- staff: wrapped shaft, diamond headstock, tick ring -->
      <path d="M47.6 22 L44.2 53" stroke="var(--bone)" stroke-width="2.1"/>
      <path d="M47 26 L48.6 26.4 M46.6 30 L48.2 30.4 M46.2 34 L47.8 34.4
               M45.8 38 L47.4 38.4 M45.4 42 L47 42.4" stroke="var(--void)" stroke-width=".7"/>
      <path d="M43 53 L46 53" stroke="var(--cyan)" stroke-width="1.6"/>
      <path d="M43.6 55 L45.4 55" stroke="var(--cyan)" stroke-width=".8" opacity=".6"/>
      <path d="M48 7 L47.4 9.6 M52 10 L50.4 11.8 M54 16.3 L51.8 16.3
               M52 22.6 L50.4 20.8 M43.4 10 L45 11.8 M41.4 16.3 L43.6 16.3" 
            stroke="var(--cyan)" stroke-width=".9" opacity=".7"/>
      <path d="M47.7 12.6 L51.4 16.3 L47.7 20 L44 16.3 Z" fill="var(--void)"
            stroke="var(--cyan)" stroke-width="1.7"/>
      <path d="M47.7 14.4 L49.6 16.3 L47.7 18.2 L45.8 16.3 Z" fill="none"
            stroke="var(--cyan)" stroke-width=".6" opacity=".7"/>
      <circle cx="47.7" cy="16.3" r="1.3" fill="var(--cyan)"/>
      <!-- coat shell -->
      <path d="M32 25 L41 29 L45 50 L42 53 L22 53 L19 50 L23 29 Z"
            fill="var(--shell)" opacity=".38"/>
      <path d="M32 25 L41 29 L45 50 L42 53 L22 53 L19 50 L23 29 Z"
            fill="none" stroke="var(--shell)" stroke-width="1.7"/>
      <!-- hem notches -->
      <path d="M25 53 L26 51.2 L27 53 M37 53 L38 51.2 L39 53" fill="none"
            stroke="var(--shell)" stroke-width=".8" opacity=".8"/>
      <!-- inner panel, gold seam, clasps -->
      <path d="M32 27 L36.5 30 L38.5 53 L25.5 53 L27.5 30 Z" fill="var(--void)" opacity=".85"/>
      <path d="M32 29 L32 53" stroke="var(--gold)" stroke-width="1.1"/>
      <path d="M31 32.5 L33 32.5 L33 34 L31 34 Z M31 38.5 L33 38.5 L33 40 L31 40 Z
               M31 44.5 L33 44.5 L33 46 L31 46 Z M31 50 L33 50 L33 51.5 L31 51.5 Z"
            fill="var(--gold)"/>
      <path d="M29.5 35.8 L34.5 35.8 M29.2 41.8 L34.8 41.8 M28.9 47.8 L35.1 47.8"
            stroke="var(--gold)" stroke-width=".7" opacity=".7"/>
      <!-- circuit seams: branch + nodes -->
      <path d="M23 31 L21.5 49 M41 31 L42.5 49" stroke="var(--cyan)" stroke-width=".9" opacity=".7"/>
      <path d="M22.3 37 L25 37 L25 40 M41.7 37 L39 37 L39 40" fill="none"
            stroke="var(--cyan)" stroke-width=".6" opacity=".6"/>
      <circle cx="25" cy="40.7" r=".7" fill="var(--cyan)" opacity=".8"/>
      <circle cx="39" cy="40.7" r=".7" fill="var(--cyan)" opacity=".8"/>
      <circle cx="21.9" cy="45" r="1" fill="var(--cyan)"/>
      <circle cx="42.1" cy="45" r="1" fill="var(--cyan)"/>
      <!-- pauldrons, etched -->
      <path d="M19.5 29.8 L25.5 28 L25.5 31.8 L20.5 33.3 Z" fill="var(--void)" stroke="var(--shell)" stroke-width="1.1"/>
      <path d="M44.5 29.8 L38.5 28 L38.5 31.8 L43.5 33.3 Z" fill="var(--void)" stroke="var(--shell)" stroke-width="1.1"/>
      <path d="M21 30.2 L24.3 29.2 M43 30.2 L39.7 29.2" stroke="var(--bone)"
            stroke-width=".6" opacity=".55"/>
      <!-- head + double visor -->
      <path d="M27 21.5 L37 21.5 L37 28.6 L32 30 L27 28.6 Z" fill="var(--bone)" opacity=".9"/>
      <path d="M28 25.4 L36 25.4" stroke="var(--cyan)" stroke-width="1.4"/>
      <path d="M28.6 27.4 L35.4 27.4" stroke="var(--cyan)" stroke-width=".6" opacity=".65"/>
      <circle cx="29.4" cy="25.4" r=".5" fill="var(--void)"/>
      <circle cx="34.6" cy="25.4" r=".5" fill="var(--void)"/>
      <!-- hat: stitched cone, glyph band, notched brim -->
      <path d="M32 3 L36 12 L42 23 L22 23 L28 12 Z" fill="var(--void)"
            stroke="var(--cyan)" stroke-width="1.6"/>
      <path d="M29.4 9 L30.8 9.6 M27.2 14.6 L28.8 15.2 M25 20.2 L26.8 20.8
               M34.6 9 L33.2 9.6 M36.8 14.6 L35.2 15.2 M39 20.2 L37.2 20.8"
            stroke="var(--cyan)" stroke-width=".6" opacity=".55"/>
      <path d="M28 12 L36 12" stroke="var(--cyan)" stroke-width=".8" opacity=".55"/>
      <path d="M25.4 17.6 L38.6 17.6" stroke="var(--cyan)" stroke-width=".5" opacity=".35"/>
      <path d="M17 23 L20 21.4 L44 21.4 L47 23 L44 24.6 L20 24.6 Z"
            fill="var(--void)" stroke="var(--cyan)" stroke-width="1.3"/>
      <path d="M22 23 L23.4 23 M26.8 23 L28.2 23 M35.8 23 L37.2 23 M40.6 23 L42 23"
            stroke="var(--cyan)" stroke-width=".7" opacity=".6"/>
      <path d="M32 15.2 L34 17.2 L32 19.2 L30 17.2 Z" fill="var(--gold)"/>
      <path d="M32 13.8 L32 14.6 M32 19.8 L32 20.6" stroke="var(--gold)" stroke-width=".6" opacity=".8"/>
      <circle cx="32" cy="3.6" r="1.1" fill="var(--cyan)"/>
      <path d="M32 5 L32 6.6" stroke="var(--cyan)" stroke-width=".6" opacity=".7"/>
    </g>`;

  // CALX — Sal. The residue that wards. Fixed, cubic, incorruptible.
  const calx = () => `
    <g>
      <ellipse cx="32" cy="54" rx="15" ry="4" fill="var(--bone)" opacity=".12"/>
      <!-- faces -->
      <path d="M32 10 L50 21 L32 32 L14 21 Z" fill="var(--bone)" opacity=".26"/>
      <path d="M14 21 L32 32 L32 54 L14 43 Z" fill="var(--bone)" opacity=".10"/>
      <path d="M50 21 L32 32 L32 54 L50 43 Z" fill="var(--bone)" opacity=".17"/>
      <!-- bevel hairlines inside each edge -->
      <path d="M32 12.2 L48 22 L48 42 L32 51.8 L16 42 L16 22 Z" fill="none"
            stroke="var(--bone)" stroke-width=".5" opacity=".4"/>
      <path d="M32 10 L50 21 L50 43 L32 54 L14 43 L14 21 Z"
            fill="none" stroke="var(--bone)" stroke-width="1.8"/>
      <path d="M32 10 L32 32 M32 32 L50 43 M32 32 L14 43"
            stroke="var(--bone)" stroke-width="1.1" opacity=".7"/>
      <!-- top-face engraving -->
      <path d="M32 14 L44 21 L32 28 L20 21 Z" fill="none" stroke="var(--bone)"
            stroke-width=".6" opacity=".5"/>
      <path d="M26 17.5 L38 24.5 M38 17.5 L26 24.5" stroke="var(--bone)"
            stroke-width=".5" opacity=".35"/>
      <!-- corner bolts -->
      <path d="M31 9 L33 9 L33 11 L31 11 Z M49 20 L51 20 L51 22 L49 22 Z
               M13 20 L15 20 L15 22 L13 22 Z M49 42 L51 42 L51 44 L49 44 Z
               M13 42 L15 42 L15 44 L13 44 Z M31 53 L33 53 L33 55 L31 55 Z"
            fill="var(--bone)"/>
      <!-- equator seal + glyph ticks -->
      <path d="M14 21 L32 32 L50 21" fill="none" stroke="var(--gold)" stroke-width="1.5"/>
      <path d="M14 24 L32 35 L50 24" fill="none" stroke="var(--gold)" stroke-width=".8" opacity=".6"/>
      <path d="M18 24.4 L18 26.8 M22 26.8 L22 29.2 M26 29.2 L26 31.6
               M46 24.4 L46 26.8 M42 26.8 L42 29.2 M38 29.2 L38 31.6"
            stroke="var(--gold)" stroke-width=".8" opacity=".75"/>
      <!-- face seals: nested chamfered squares -->
      <path d="M20 33 L26 36.6 L26 45 L20 41.4 Z" fill="none" stroke="var(--bone)"
            stroke-width=".8" opacity=".55"/>
      <path d="M21.5 35.2 L24.5 37 L24.5 42.4 L21.5 40.6 Z" fill="none" stroke="var(--bone)"
            stroke-width=".5" opacity=".4"/>
      <path d="M44 33 L38 36.6 L38 45 L44 41.4 Z" fill="none" stroke="var(--bone)"
            stroke-width=".8" opacity=".55"/>
      <path d="M42.5 35.2 L39.5 37 L39.5 42.4 L42.5 40.6 Z" fill="none" stroke="var(--bone)"
            stroke-width=".5" opacity=".4"/>
      <path d="M23 38.2 L23 39.4 M41 38.2 L41 39.4" stroke="var(--gold)" stroke-width=".8"/>
      <!-- aperture: chamfered socket, tick ring, nested diamond -->
      <path d="M27 28 L37 28 L38.5 37 L32 40.5 L25.5 37 Z" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1.4"/>
      <path d="M32 27 L32 25.8 M38 29.4 L39.1 28.8 M26 29.4 L24.9 28.8
               M38.9 38 L40 38.6 M25.1 38 L24 38.6 M32 41.6 L32 42.8"
            stroke="var(--gold)" stroke-width=".7" opacity=".7"/>
      <path d="M32 30 L35 33.6 L32 37.2 L29 33.6 Z" fill="none"
            stroke="var(--gold)" stroke-width="1"/>
      <path d="M32 31.6 L33.7 33.6 L32 35.6 L30.3 33.6 Z" fill="none"
            stroke="var(--gold)" stroke-width=".5" opacity=".7"/>
      <circle cx="32" cy="33.6" r="1.2" fill="var(--gold)"/>
      <!-- salt chips + dust -->
      <path d="M10 53 L12.5 50 L15 53 Z M52 53 L54 50.5 L56 53 Z" fill="var(--bone)" opacity=".6"/>
      <path d="M17 52.4 L18.4 51 L19.8 52.4 Z" fill="var(--bone)" opacity=".4"/>
      <circle cx="47" cy="51.6" r=".6" fill="var(--bone)" opacity=".45"/>
    </g>`;

  // CINIS — Svlphvr. The pyramid that burns itself.
  const cinis = () => `
    <g>
      <ellipse cx="32" cy="54" rx="15" ry="4" fill="var(--blood)" opacity=".18"/>
      <!-- embers, drifting -->
      <path d="M23 24 L24.6 24 L24.6 25.6 L23 25.6 Z" fill="var(--gold)" opacity=".8"/>
      <path d="M42 18 L43.4 18 L43.4 19.4 L42 19.4 Z" fill="var(--gold)" opacity=".55"/>
      <path d="M38 10 L39 10 L39 11 L38 11 Z M20 15 L20.9 15 L20.9 15.9 L20 15.9 Z"
            fill="var(--gold)" opacity=".35"/>
      <path d="M27 6.5 L27.7 6.5 L27.7 7.2 L27 7.2 Z" fill="var(--gold)" opacity=".22"/>
      <!-- body + edge rune ticks -->
      <path d="M32 8 L52 52 L12 52 Z" fill="var(--blood)" opacity=".24"/>
      <path d="M32 8 L52 52 L12 52 Z" fill="none" stroke="var(--blood)" stroke-width="1.8"/>
      <path d="M34.8 16.2 L36.3 15.5 M37.6 22.4 L39.1 21.7 M40.4 28.6 L41.9 27.9
               M43.2 34.8 L44.7 34.1 M46 41 L47.5 40.3
               M29.2 16.2 L27.7 15.5 M26.4 22.4 L24.9 21.7 M23.6 28.6 L22.1 27.9
               M20.8 34.8 L19.3 34.1 M18 41 L16.5 40.3"
            stroke="var(--blood)" stroke-width=".8" opacity=".6"/>
      <!-- crack lattice with ember tips -->
      <path d="M32 8 L29 22 L35 25 L30 38 L36 41 L33 52" fill="none"
            stroke="var(--blood)" stroke-width="1" opacity=".75"/>
      <path d="M22 30 L27 33 M42 30 L37 34 M18 42 L24 45 M46 42 L40 46"
            stroke="var(--blood)" stroke-width=".9" opacity=".6"/>
      <path d="M29 22 L26 20.4 M30 38 L27.2 36.8" stroke="var(--blood)" stroke-width=".7" opacity=".5"/>
      <circle cx="26.6" cy="20.2" r=".7" fill="var(--gold)" opacity=".7"/>
      <circle cx="17.6" cy="41.8" r=".7" fill="var(--gold)" opacity=".6"/>
      <circle cx="46.4" cy="41.8" r=".7" fill="var(--gold)" opacity=".6"/>
      <!-- furnace chamber -->
      <path d="M32 20 L43 48 L21 48 Z" fill="var(--void)" opacity=".8"/>
      <path d="M32 20 L43 48 L21 48 Z" fill="none" stroke="var(--gold)" stroke-width="1.3"/>
      <path d="M32 22.6 L41.2 46.4 L22.8 46.4 Z" fill="none" stroke="var(--gold)"
            stroke-width=".5" opacity=".4"/>
      <!-- coal bed -->
      <path d="M25 44.4 L27 44.4 L27 46 L25 46 Z M29.5 45 L31.5 45 L31.5 46.4 L29.5 46.4 Z
               M34 44.2 L36 44.2 L36 45.8 L34 45.8 Z M37.8 45 L39.4 45 L39.4 46.2 L37.8 46.2 Z"
            fill="var(--blood)" opacity=".8"/>
      <!-- flame: outer gold, mid tongue, bone core, sparks -->
      <path d="M32 27 Q37 34 35.5 40 Q38 38.5 38.5 35.5 Q41 42 36 46.5 L28 46.5
               Q23 42 25.5 35.5 Q26 38.5 28.5 40 Q27 34 32 27 Z"
            fill="var(--gold)" opacity=".9"/>
      <path d="M32 31 Q35.4 36.4 34.4 41.8 Q36 40.6 36.4 38.4 Q37.6 43.4 34.4 45.6
               L29.6 45.6 Q26.4 43.4 27.6 38.4 Q28 40.6 29.6 41.8 Q28.6 36.4 32 31 Z"
            fill="var(--gold)"/>
      <path d="M32 34 Q34.6 38.5 33.4 42.5 L30.6 42.5 Q29.4 38.5 32 34 Z" fill="var(--bone)"/>
      <path d="M32 43.6 L32 45.2" stroke="var(--bone)" stroke-width=".8" opacity=".8"/>
      <path d="M30 28.6 L30.6 27.4 M34.4 29.4 L35 28.2" stroke="var(--gold)"
            stroke-width=".6" opacity=".7"/>
      <!-- riveted grate + slag base -->
      <path d="M25 48 L25 52 M28.5 48 L28.5 52 M32 48 L32 52 M35.5 48 L35.5 52 M39 48 L39 52"
            stroke="var(--gold)" stroke-width="1" opacity=".8"/>
      <path d="M21 48 L43 48" stroke="var(--gold)" stroke-width=".7" opacity=".6"/>
      <path d="M10 52 L54 52" stroke="var(--blood)" stroke-width="2.4"/>
      <path d="M13 54.5 L20 54.5 M24 54.5 L33 54.5 M37 54.5 L51 54.5"
            stroke="var(--blood)" stroke-width="1" opacity=".45"/>
      <path d="M15 50.6 L16.6 50.6 M47.4 50.6 L49 50.6" stroke="var(--blood)"
            stroke-width=".8" opacity=".5"/>
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
      <ellipse cx="32" cy="52" rx="22" ry="6.4" fill="var(--cyan)" opacity=".10"/>
      <ellipse cx="32" cy="52" rx="22" ry="6.4" fill="none"
               stroke="var(--cyan)" stroke-width=".8" opacity=".4"/>
      <ellipse cx="32" cy="52" rx="18.5" ry="5.2" fill="none"
               stroke="var(--cyan)" stroke-width=".5" opacity=".22"/>
      <path d="M10 52 L12.5 52 M51.5 52 L54 52 M32 45.6 L32 47.4 M32 56.6 L32 58.4"
            stroke="var(--cyan)" stroke-width=".8" opacity=".45"/>
      <g transform="translate(1.2,33.2) scale(0.40)">${calx()}</g>
      <g transform="translate(37.2,33.6) scale(0.40)">${cinis()}</g>
      <g transform="translate(10.3,4.4) scale(0.62)">${hero()}</g>
    </g>`;

  // TESTA — Qliphoth. Potsherd; keeps what it is given.
  const testa = () => `
    <g>
      <ellipse cx="32" cy="52" rx="14" ry="3.5" fill="var(--shell)" opacity=".16"/>
      <!-- shard body -->
      <path d="M32 11 L46 22 L48 27 L44 44 L41 50 L23 50 L20 44 L16 27 L18 22 Z"
            fill="var(--shell)" opacity=".28"/>
      <path d="M32 11 L46 22 L48 27 L44 44 L41 50 L23 50 L20 44 L16 27 L18 22 Z"
            fill="none" stroke="var(--shell)" stroke-width="1.8"/>
      <!-- edge chips -->
      <path d="M46 22 L44.6 23.6 L46.6 24.4 M18 22 L19.4 23.6 L17.4 24.4
               M44 44 L42.6 43 L43 45.6 M20 44 L21.4 43 L21 45.6" fill="none"
            stroke="var(--shell)" stroke-width=".8" opacity=".7"/>
      <!-- plate fractures, rivets, hatching -->
      <path d="M17.5 26 L46.5 26 M20 40 L44 40" stroke="var(--shell)" stroke-width="1" opacity=".7"/>
      <path d="M20 25 L22 25 L22 27 L20 27 Z M42 25 L44 25 L44 27 L42 27 Z
               M22 39 L24 39 L24 41 L22 41 Z M40 39 L42 39 L42 41 L40 41 Z
               M31 24.6 L33 24.6 L33 26.6 L31 26.6 Z" fill="var(--shell)"/>
      <path d="M19.5 17.8 L23.5 20.8 M23.5 15.4 L27.5 18.4 M40.5 15.4 L36.5 18.4
               M44.5 17.8 L40.5 20.8" stroke="var(--shell)" stroke-width=".6" opacity=".45"/>
      <path d="M19 30.5 L21 30.5 M18.6 33.5 L20.6 33.5 M45 30.5 L43 30.5 M45.4 33.5 L43.4 33.5"
            stroke="var(--shell)" stroke-width=".6" opacity=".5"/>
      <!-- apex crack, branched, lit -->
      <path d="M32 11 L30 19 L34 22 L31 26" fill="none" stroke="var(--blood)"
            stroke-width="1" opacity=".8"/>
      <path d="M30 19 L27.6 20.6 M34 22 L36.2 23.2" stroke="var(--blood)"
            stroke-width=".7" opacity=".6"/>
      <circle cx="27.3" cy="20.8" r=".6" fill="var(--blood)" opacity=".8"/>
      <!-- visor band + segmented glyph eyes -->
      <path d="M21 29 L43 29 L43 36 L21 36 Z" fill="var(--void)" opacity=".85"/>
      <path d="M21 29 L43 29 L43 36 L21 36 Z" fill="none" stroke="var(--blood)" stroke-width="1.2"/>
      <path d="M24.5 31 L26 31 L26 32.2 L24.5 32.2 Z M26.5 31 L28 31 L28 32.2 L26.5 32.2 Z
               M24.5 32.8 L26 32.8 L26 34 L24.5 34 Z M26.5 32.8 L28 32.8 L28 34 L26.5 34 Z"
            fill="var(--blood)"/>
      <path d="M36 31 L37.5 31 L37.5 32.2 L36 32.2 Z M38 31 L39.5 31 L39.5 32.2 L38 32.2 Z
               M36 32.8 L37.5 32.8 L37.5 34 L36 34 Z M38 32.8 L39.5 32.8 L39.5 34 L38 34 Z"
            fill="var(--blood)"/>
      <path d="M32 30 L32 35" stroke="var(--blood)" stroke-width=".8" opacity=".6"/>
      <path d="M22.2 30.2 L23.4 30.2 M40.6 30.2 L41.8 30.2" stroke="var(--blood)"
            stroke-width=".6" opacity=".55"/>
      <!-- keel + vent glow -->
      <path d="M32 36 L32 50 M26 44 L38 44" stroke="var(--shell)" stroke-width=".9" opacity=".6"/>
      <path d="M27.8 44 L27.8 46 M36.2 44 L36.2 46" stroke="var(--shell)" stroke-width=".6" opacity=".5"/>
      <path d="M30 47 L34 47 L34 49 L30 49 Z" fill="var(--blood)" opacity=".7"/>
      <path d="M30.8 47.5 L33.2 47.5 M30.8 48.5 L33.2 48.5" stroke="var(--void)" stroke-width=".5"/>
    </g>`;

  // SILIQVA — Qliphoth. Empty husk; hollow imitation.
  const siliqva = () => `
    <g>
      <ellipse cx="32" cy="52" rx="12" ry="3.5" fill="var(--blood)" opacity=".16"/>
      <!-- barbed thorns -->
      <path d="M32 5 L34 12 L30 12 Z M32 57 L30 51 L34 51 Z" fill="var(--blood)"/>
      <path d="M32 7.4 L33.6 8.4 M32 9 L30.4 10 M32 55 L30.6 54 M32 53.6 L33.4 52.8"
            stroke="var(--blood)" stroke-width=".7" opacity=".8"/>
      <!-- aura arcs -->
      <path d="M18.5 24 Q16.5 31 18.5 38 M45.5 24 Q47.5 31 45.5 38" fill="none"
            stroke="var(--blood)" stroke-width=".6" opacity=".3"/>
      <!-- husk -->
      <path d="M32 10 C46 20 46 42 32 52 C18 42 18 20 32 10 Z"
            fill="var(--void)" stroke="var(--blood)" stroke-width="1.8"/>
      <path d="M32 12.4 C43.6 21.4 43.6 40.6 32 49.6 C20.4 40.6 20.4 21.4 32 12.4 Z"
            fill="none" stroke="var(--blood)" stroke-width=".5" opacity=".35"/>
      <!-- ribs, doubled with joins -->
      <path d="M22.6 21 Q32 25.5 41.4 21 M20.4 30 Q32 35 43.6 30 M22.6 41 Q32 45.5 41.4 41"
            fill="none" stroke="var(--blood)" stroke-width="1" opacity=".65"/>
      <path d="M23.2 22.6 Q32 26.9 40.8 22.6 M21 31.6 Q32 36.4 43 31.6"
            fill="none" stroke="var(--blood)" stroke-width=".5" opacity=".35"/>
      <path d="M26 22.2 L26 23.6 M38 22.2 L38 23.6 M24 31.6 L24 33 M40 31.6 L40 33"
            stroke="var(--blood)" stroke-width=".6" opacity=".55"/>
      <!-- stitched split seam -->
      <path d="M32 12 L31 24 L33.2 33 L31 42 L32 50" fill="none"
            stroke="var(--blood)" stroke-width="1.3" opacity=".9"/>
      <path d="M30.2 17 L32.8 18 M30 21 L32.6 22 M31.4 37 L33.8 38 M30.4 45 L33 46"
            stroke="var(--blood)" stroke-width=".6" opacity=".6"/>
      <path d="M32 15 C39 23 39 39 32 47 C25 39 25 23 32 15 Z"
            fill="var(--blood)" opacity=".14"/>
      <!-- false eye: double ring, lash ticks, slit -->
      <path d="M32 21.5 L38 28.5 L32 35.5 L26 28.5 Z" fill="var(--void)"
            stroke="var(--gold)" stroke-width="1.4"/>
      <path d="M32 23.7 L36.1 28.5 L32 33.3 L27.9 28.5 Z" fill="none"
            stroke="var(--gold)" stroke-width=".6" opacity=".7"/>
      <path d="M32 20.4 L32 19 M38.8 28.5 L40.2 28.5 M25.2 28.5 L23.8 28.5 M32 36.6 L32 38"
            stroke="var(--gold)" stroke-width=".7" opacity=".7"/>
      <path d="M32 25.5 L32 31.5" stroke="var(--gold)" stroke-width="1.6"/>
      <circle cx="32" cy="28.5" r=".8" fill="var(--gold)"/>
      <!-- vein network -->
      <path d="M28 38 L30.5 41 M36 38 L33.5 41 M29 45 L32 47.5 L35 45
               M27 40.6 L28.8 42.6 M37 40.6 L35.2 42.6" fill="none"
            stroke="var(--blood)" stroke-width=".8" opacity=".55"/>
      <circle cx="30.5" cy="41.3" r=".5" fill="var(--blood)" opacity=".7"/>
      <circle cx="33.5" cy="41.3" r=".5" fill="var(--blood)" opacity=".7"/>
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
