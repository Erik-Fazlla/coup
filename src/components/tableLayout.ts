/**
 * Sizes of the game table, worked out from the space inside the screen padding.
 * Everything except the event banner has a known height, so the banner is the
 * one region that gives up space and the actions can never be pushed off screen.
 */

export const TOP_BAR_HEIGHT = 44;
export const SEAT_HEIGHT = 56;
export const SEAT_GAP = 6;
export const REGION_GAP = 6;
/** One line of banner text plus its padding. */
export const BANNER_MIN_HEIGHT = 28;

const SEAT_MIN_WIDTH = 108;
const SEAT_MAX_WIDTH = 220;
const COMPACT_SEAT_BELOW = 150;
const BOTTOM_PREFERRED_MIN = 128;
const BOTTOM_MAX = 170;
const BOTTOM_HARD_MIN = 104;
const HAND_MIN_WIDTH = 196;
const HAND_MAX_WIDTH = 260;
/** Below this the hand cards are too short for their ability text. */
const ABILITY_TEXT_FROM = 124;

export interface TableLayout {
  seatsPerRow: number;
  seatRows: number;
  seatWidth: number;
  /** Seats are narrow: use the short "tap" tag instead of "tap to target". */
  compactSeats: boolean;
  /** Height of the row holding the hand and the action grid. */
  bottomHeight: number;
  handWidth: number;
  handAbilityLines: number;
  /** What is left for the event banner. */
  bannerHeight: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function tableLayout(
  width: number,
  height: number,
  opponentCount: number,
): TableLayout {
  const count = Math.max(1, opponentCount);
  const fitInOneRow = Math.floor(
    (width + SEAT_GAP) / (SEAT_MIN_WIDTH + SEAT_GAP),
  );
  const seatsPerRow = count <= fitInOneRow ? count : Math.ceil(count / 2);
  const seatRows = Math.ceil(count / seatsPerRow);
  const seatWidth = Math.min(
    SEAT_MAX_WIDTH,
    Math.floor((width - SEAT_GAP * (seatsPerRow - 1)) / seatsPerRow),
  );

  const seatsHeight = seatRows * SEAT_HEIGHT + (seatRows - 1) * SEAT_GAP;
  // Top bar, seats, banner and bottom row are separated by three gaps.
  const fixed = TOP_BAR_HEIGHT + seatsHeight + 3 * REGION_GAP;
  const preferred = clamp(
    Math.round(height * 0.37),
    BOTTOM_PREFERRED_MIN,
    BOTTOM_MAX,
  );
  const bottomHeight = Math.max(
    BOTTOM_HARD_MIN,
    Math.min(preferred, height - fixed - BANNER_MIN_HEIGHT),
  );

  return {
    seatsPerRow,
    seatRows,
    seatWidth,
    compactSeats: seatWidth < COMPACT_SEAT_BELOW,
    bottomHeight,
    handWidth: clamp(Math.round(width * 0.33), HAND_MIN_WIDTH, HAND_MAX_WIDTH),
    handAbilityLines: bottomHeight >= ABILITY_TEXT_FROM ? 2 : 0,
    bannerHeight: height - fixed - bottomHeight,
  };
}
