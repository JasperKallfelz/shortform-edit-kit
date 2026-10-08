// MapRoute: an outline draws itself, a dot pops on city A, an arc flies to city B (arrow head, dot), then the camera pushes in on B.
// Needs: ../lib/fonts.ts
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

/** A shape to draw: any SVG path `d` plus the size of the box its coordinates live in. */
export type MapOutline = { d: string; width: number; height: number };

// Default shape: a simplified country outline (plain geography, 377 points, from public Natural Earth data, projected with Mercator).
const COUNTRY_OUTLINE = "M308 962L281 944L257 946L254 940L250 939L245 941L237 933L233 932L228 933L222 937L220 942L220 945L224 947L231 946L232 950L222 954L204 952L195 955L182 957L164 956L154 952L151 944L152 932L156 917L157 905L155 898L158 887L165 873L175 830L199 800L199 790L188 786L157 779L151 777L145 769L125 773L119 772L112 773L109 765L101 762L97 763L92 768L88 768L76 748L73 739L66 734L58 732L60 714L69 701L69 690L56 685L51 681L42 669L39 654L44 637L59 627L57 610L54 606L47 604L45 601L44 598L49 592L30 573L34 554L31 548L22 544L19 538L20 536L26 537L41 523L41 521L37 519L36 514L46 490L46 480L38 466L38 461L26 446L26 440L31 436L44 431L54 434L59 438L64 433L71 434L89 427L94 418L87 411L87 405L108 389L111 381L112 366L107 358L96 359L89 356L86 351L85 347L87 341L87 336L89 334L110 334L118 301L123 290L125 249L121 243L114 237L118 213L125 200L132 196L159 194L189 195L201 214L197 224L204 229L207 227L212 209L214 206L224 213L227 218L227 234L230 213L228 197L229 183L237 170L259 176L283 173L292 179L313 207L320 212L328 213L316 207L291 173L284 168L272 167L265 163L260 158L259 153L260 118L255 113L249 111L246 114L239 114L237 106L239 100L254 96L263 91L263 81L257 73L242 46L241 31L259 32L281 39L287 44L294 44L315 38L319 41L325 42L326 44L337 48L347 62L348 75L335 90L357 88L362 99L374 95L403 111L421 103L425 103L429 116L425 129L409 143L413 152L418 154L432 152L456 161L461 158L480 138L487 134L512 131L516 123L526 115L548 91L584 98L593 116L617 135L639 133L646 151L650 173L662 185L681 190L684 213L693 249L693 258L690 272L684 282L676 288L671 295L671 302L680 314L701 332L709 347L704 369L709 380L714 383L716 389L716 401L720 405L714 427L708 437L710 445L719 463L716 473L718 476L732 484L741 510L733 541L721 564L717 565L709 560L710 553L707 552L705 548L703 543L686 537L680 541L684 548L690 553L690 555L676 559L652 572L637 577L625 579L623 580L619 590L616 591L611 589L606 593L601 594L596 603L583 605L577 616L563 613L559 615L546 617L539 623L531 632L525 643L517 630L514 627L510 629L510 633L517 644L519 654L525 660L539 671L543 678L542 684L534 698L542 710L557 737L567 747L575 747L593 768L600 773L605 775L613 790L616 792L625 792L636 802L646 815L644 836L639 842L635 844L620 837L618 839L614 859L611 863L607 867L588 873L574 882L567 887L563 893L563 897L578 919L578 928L574 938L584 941L586 946L583 967L579 967L567 959L565 957L566 952L564 948L557 944L541 948L532 942L519 939L517 950L481 955L455 966L454 969L448 973L441 974L439 973L428 977L423 976L416 968L414 962L404 962L397 959L383 959L380 958L375 980L370 986L364 989L360 990L361 980L351 977L350 970L343 964L326 955L318 961L310 960ZM638 102L640 111L637 116L629 108L620 108L614 120L610 121L597 110L595 104L596 80L600 75L601 67L608 59L615 59L620 71L632 76L633 78L635 81L627 91L629 96ZM677 160L676 164L677 171L664 172L655 170L653 162L654 154L647 146L647 136ZM212 47L210 50L211 30L220 10L224 10L219 20L218 32L238 33L235 36L215 39ZM447 97L434 98L430 92L425 91L428 84L431 82L443 86ZM234 57L231 61L224 60L220 57L221 54L228 51L233 52Z";
export const DEFAULT_OUTLINE: MapOutline = { d: COUNTRY_OUTLINE, width: 760, height: 1000 };

/** A labelled point, in the coordinates of the outline box (0..width, 0..height). */
export type MapPoint = { x: number; y: number; label: string };

/** All times in frames, counted from `at`. */
export type MapRouteTiming = {
  /** Frames the outline takes to draw. */
  outline: number;
  /** City A's dot pops. */
  fromAt: number;
  /** The arc starts / ends flying. */
  routeStart: number;
  routeEnd: number;
  /** The camera push-in on city B starts / ends. */
  zoomStart: number;
  zoomEnd: number;
};

export const DEFAULT_TIMING: MapRouteTiming = { outline: 14, fromAt: 16, routeStart: 28, routeEnd: 50, zoomStart: 62, zoomEnd: 90 };

export type MapRouteProps = {
  outline?: MapOutline;
  from?: MapPoint;
  to?: MapPoint;
  timing?: Partial<MapRouteTiming>;
  /** Frame on which the whole effect starts. */
  at?: number;
  /** Camera scale at the end of the push-in on city B (1 = no push-in). */
  zoomTo?: number;
  /** Where the outline sits, in px of the 1080 x 1920 canvas. It is fitted into this box, centred. */
  box?: { x: number; y: number; w: number; h: number };
  /** Height of the arc above the straight line, in px. */
  arcHeight?: number;
  /** Ink colour of outline, arc, dots and labels. */
  color?: string;
};

const DEFAULT_FROM: MapPoint = { x: 215, y: 470, label: "City A" };
const DEFAULT_TO: MapPoint = { x: 585, y: 262, label: "City B" };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Dot with label. `inv` = 1 / camera zoom, so it keeps its size while the camera pushes in. */
const Dot: React.FC<{ x: number; y: number; at: number; label: string; inv: number; ink: string; fade: number }> = ({ x, y, at, label, inv, ink, fade }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 180, mass: 0.7 } });
  const pulse = interpolate((frame - at) % 40, [0, 40], [0, 1]);
  return (
    <g transform={`translate(${x} ${y}) scale(${inv})`} opacity={fade}>
      <circle r={20 + pulse * 34} fill="none" stroke={ink} strokeWidth={4} opacity={(1 - pulse) * 0.6 * s} />
      <circle r={20 * s} fill={ink} />
      <circle r={8 * s} fill="#fff" />
      <text x={0} y={100} textAnchor="middle" fontSize={78} fill={ink} opacity={s} style={{ ...FONTS.sans, paintOrder: "stroke", stroke: "#fff", strokeWidth: 10 }}>
        {label}
      </text>
    </g>
  );
};

/** Outline + route + push-in. Pass your own `outline` (any SVG path), `from` and `to` for a different place. Transparent background: put it on white. */
export const MapRoute: React.FC<MapRouteProps> = ({ outline = DEFAULT_OUTLINE, from = DEFAULT_FROM, to = DEFAULT_TO, timing, at = 0, zoomTo = 3, box = { x: 90, y: 430, w: 900, h: 1060 }, arcHeight = 150, color = "#000" }) => {
  const frame = useCurrentFrame() - at;
  const { fps, width: W, height: H } = useVideoConfig();
  const T = { ...DEFAULT_TIMING, ...timing };
  // fit the outline box into `box`
  const sc = Math.min(box.w / outline.width, box.h / outline.height);
  const ox = box.x + (box.w - outline.width * sc) / 2;
  const oy = box.y + (box.h - outline.height * sc) / 2;
  const a: [number, number] = [ox + from.x * sc, oy + from.y * sc];
  const b: [number, number] = [ox + to.x * sc, oy + to.y * sc];

  // camera: slow drift, then push in on B (the focus point travels from the frame centre to B)
  const drift = interpolate(frame, [0, T.zoomStart], [1, 1.05], { extrapolateRight: "clamp" });
  const e = interpolate(frame, [T.zoomStart, T.zoomEnd], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const S = drift * Math.pow(zoomTo, e);
  const camX = W / 2 + (b[0] - W / 2) * e;
  const camY = H / 2 + (b[1] - H / 2) * e;
  const inv = 1 / S;

  const draw = interpolate(frame, [0, T.outline], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // arc: quadratic curve bulging upward from A to B
  const cx = (a[0] + b[0]) / 2;
  const cy = Math.min(a[1], b[1]) - arcHeight;
  const arc = `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`;
  const t = interpolate(frame, [T.routeStart, T.routeEnd], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const angle = (Math.atan2(b[1] - cy, b[0] - cx) * 180) / Math.PI;
  const headAt = T.routeEnd - 2;
  const head = frame >= headAt ? spring({ frame: frame - headAt, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } }) : 0;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${W / 2} ${H / 2}) scale(${S}) translate(${-camX} ${-camY})`}>
        <g transform={`translate(${ox} ${oy}) scale(${sc})`}>
          <path d={outline.d} fill="#fff" opacity={draw} />
          {draw > 0 ? (
            <path
              d={outline.d}
              fill="none"
              stroke={color}
              strokeWidth={(6 * inv) / sc}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={draw < 1 ? "1 1" : undefined}
              strokeDashoffset={draw < 1 ? 1 - draw : undefined}
            />
          ) : null}
        </g>
        {t > 0 ? <path d={arc} fill="none" stroke={color} strokeWidth={16 * inv} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - t} /> : null}
        {head > 0 ? <polygon points="0,0 -46,-28 -46,28" fill={color} strokeLinejoin="round" transform={`translate(${b[0]} ${b[1]}) rotate(${angle}) scale(${head * inv})`} /> : null}
        <Dot x={a[0]} y={a[1]} at={T.fromAt} label={from.label} inv={inv} ink={color} fade={1} />
        <Dot x={b[0]} y={b[1]} at={headAt} label={to.label} inv={inv} ink={color} fade={1} />
      </g>
    </svg>
  );
};
