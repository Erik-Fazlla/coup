/**
 * Sizes of the game table, worked out from the space inside the screen padding.
 * Everything except the event banner has a known height, so the banner is the
 * one region that gives up space and the actions can never be pushed off screen.
 *
 * Landscape: top bar · seats · banner · one bottom row (hand left, actions right).
 * Portrait:  top bar · seats · banner · hand · actions (2 columns), stacked.
 */

export const TOP_BAR_HEIGHT = 44;
export const SEAT_HEIGHT = 56;
export const SEAT_GAP = 6;
export const REGION_GAP = 6;
/** One line of banner text plus its padding. */
export const BANNER_MIN_HEIGHT = 28;
/** Space between action tiles, and between cards. */
export const TILE_GAP = 6;

/** Seat height when the table is too full for the regular one: the same two lines, packed tighter. */
export const SLIM_SEAT_HEIGHT = 48;

const SEAT_MIN_WIDTH = 108;
/** With this many opponents or more (a 7 to 10 player game) seats may be a little narrower, to save a row. */
const CROWDED_FROM = 6;
const CROWDED_SEAT_MIN_WIDTH = 100;
const SEAT_MAX_WIDTH = 220;
/**
 * Above the widest seat, so the short "TAP" tag is the one always used: the long
 * "TAP TO TARGET" takes about 92 of a seat's width and cut names down to a few
 * letters at the very moment the player has to tell opponents apart.
 */
const COMPACT_SEAT_BELOW = 230;
/** Seats narrower than this also get the smaller name size. */
export const SMALL_SEAT_NAME_BELOW = 150;
const BOTTOM_PREFERRED_MIN = 128;
const BOTTOM_MAX = 170;
const BOTTOM_HARD_MIN = 104;
const HAND_MIN_WIDTH = 196;
const HAND_MAX_WIDTH = 260;
/** Below this the hand cards are too short for their ability text. */
const ABILITY_TEXT_FROM = 124;

/** Seven actions and the Back cell, two per row. */
const PORTRAIT_ACTION_ROWS = 4;
const PORTRAIT_TILE_MIN = 44;
const PORTRAIT_TILE_PREFERRED = 52;
const PORTRAIT_TILE_MAX = 64;
/** The hand strip: tall enough for two lines of ability text from 100, name only below that. */
const PORTRAIT_HAND_MIN = 76;
const PORTRAIT_HAND_PREFERRED = 100;
const PORTRAIT_HAND_MAX = 116;

export interface TableLayout {
  /** Stacked layout: the window is at least as tall as it is wide. */
  portrait: boolean;
  seatsPerRow: number;
  seatRows: number;
  seatWidth: number;
  /** Regular, or slim when the regular seats would leave the banner less than one line. */
  seatHeight: number;
  /** Use the short "tap" tag instead of "tap to target". True at every seat width the table produces. */
  compactSeats: boolean;
  /**
   * Height of everything below the banner. Landscape: the one row holding the
   * hand and the action grid. Portrait: hand, gap and action grid together.
   */
  bottomHeight: number;
  /** Height of the hand panel (portrait: its own strip; landscape: the bottom row). */
  handHeight: number;
  /** Height of the action grid, response bar or picker. */
  controlsHeight: number;
  /** Width of the hand panel in landscape. In portrait it spans the table. */
  handWidth: number;
  handAbilityLines: number;
  /** 4 in landscape, 2 in portrait. */
  actionColumns: number;
  /** What is left for the event banner. */
  bannerHeight: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const gridHeight = (tile: number) =>
  PORTRAIT_ACTION_ROWS * tile + (PORTRAIT_ACTION_ROWS - 1) * TILE_GAP;

export function tableLayout(
  width: number,
  height: number,
  opponentCount: number,
): TableLayout {
  const regular = layoutWith(width, height, opponentCount, SEAT_HEIGHT);
  // A full table on a small phone: slimmer seats rather than a banner with no room for its line.
  return regular.bannerHeight >= BANNER_MIN_HEIGHT
    ? regular
    : layoutWith(width, height, opponentCount, SLIM_SEAT_HEIGHT);
}

function layoutWith(
  width: number,
  height: number,
  opponentCount: number,
  seatHeight: number,
): TableLayout {
  const portrait = height >= width;
  const count = Math.max(1, opponentCount);
  const seatMinWidth =
    count >= CROWDED_FROM ? CROWDED_SEAT_MIN_WIDTH : SEAT_MIN_WIDTH;
  const fitInOneRow = Math.max(
    1,
    Math.floor((width + SEAT_GAP) / (seatMinWidth + SEAT_GAP)),
  );
  // As few rows as keep every seat at its minimum width, filled evenly.
  const seatRows = Math.ceil(count / fitInOneRow);
  const seatsPerRow = Math.ceil(count / seatRows);
  const seatWidth = Math.min(
    SEAT_MAX_WIDTH,
    Math.floor((width - SEAT_GAP * (seatsPerRow - 1)) / seatsPerRow),
  );
  const seatsHeight = seatRows * seatHeight + (seatRows - 1) * SEAT_GAP;
  const seats = {
    portrait,
    seatsPerRow,
    seatRows,
    seatWidth,
    seatHeight,
    compactSeats: seatWidth < COMPACT_SEAT_BELOW,
  };

  if (portrait) {
    // Top bar, seats, banner, hand and actions are separated by four gaps.
    const fixed = TOP_BAR_HEIGHT + seatsHeight + 4 * REGION_GAP;
    const available = height - fixed - BANNER_MIN_HEIGHT;
    const wantedControls = clamp(
      Math.round(height * 0.36),
      gridHeight(PORTRAIT_TILE_PREFERRED),
      gridHeight(PORTRAIT_TILE_MAX),
    );
    const wantedHand = clamp(
      Math.round(height * 0.16),
      PORTRAIT_HAND_PREFERRED,
      PORTRAIT_HAND_MAX,
    );
    // Short of room, the hand gives up its ability text first, then the tiles shrink to the smallest tappable size.
    const handHeight = clamp(
      available - wantedControls,
      PORTRAIT_HAND_MIN,
      wantedHand,
    );
    const controlsHeight = clamp(
      available - handHeight,
      gridHeight(PORTRAIT_TILE_MIN),
      wantedControls,
    );
    return {
      ...seats,
      bottomHeight: handHeight + REGION_GAP + controlsHeight,
      handHeight,
      controlsHeight,
      handWidth: width,
      handAbilityLines: handHeight >= PORTRAIT_HAND_PREFERRED ? 2 : 0,
      actionColumns: 2,
      bannerHeight: height - fixed - handHeight - controlsHeight,
    };
  }

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
    ...seats,
    bottomHeight,
    handHeight: bottomHeight,
    controlsHeight: bottomHeight,
    handWidth: clamp(Math.round(width * 0.33), HAND_MIN_WIDTH, HAND_MAX_WIDTH),
    handAbilityLines: bottomHeight >= ABILITY_TEXT_FROM ? 2 : 0,
    actionColumns: 4,
    bannerHeight: height - fixed - bottomHeight,
  };
}
