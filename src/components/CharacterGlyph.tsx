import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../engine/types';
import { characterColors } from '../theme';

interface Props {
  card: Card;
  /** Side of the square the glyph is drawn in. */
  size: number;
  color: string;
  /** Colour of whatever is behind the glyph, for shapes with a hole in them. */
  cutout: string;
}

interface ShapeProps {
  size: number;
  color: string;
  cutout: string;
}

/**
 * An upward triangle, `width` wide and half as tall: the top half of a square
 * turned 45 degrees, with the bottom half clipped away.
 */
function Peak({ width, color }: { width: number; color: string }) {
  const side = width / Math.SQRT2;
  return (
    <View style={[styles.peak, { width, height: width / 2 }]}>
      <View
        style={[
          styles.turned,
          {
            width: side,
            height: side,
            marginTop: (width - side) / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

/** Duke: a crown. Three points on a band. */
function Crown({ size, color }: ShapeProps) {
  const point = size * 0.3;
  return (
    <View style={styles.centered}>
      <View style={styles.row}>
        <Peak width={point} color={color} />
        <Peak width={point} color={color} />
        <Peak width={point} color={color} />
      </View>
      <View
        style={{
          width: point * 3,
          height: size * 0.28,
          backgroundColor: color,
          borderBottomLeftRadius: size * 0.08,
          borderBottomRightRadius: size * 0.08,
        }}
      />
    </View>
  );
}

/** Assassin: a dagger. Point, blade, guard, grip, tilted. */
function Dagger({ size, color }: ShapeProps) {
  const blade = size * 0.2;
  return (
    <View style={[styles.centered, styles.turned]}>
      <Peak width={blade} color={color} />
      <View
        style={{ width: blade, height: size * 0.42, backgroundColor: color }}
      />
      <View
        style={{
          width: size * 0.5,
          height: size * 0.1,
          borderRadius: size * 0.05,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.12,
          height: size * 0.2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Captain: two rank chevrons. */
function Chevrons({ size, color }: ShapeProps) {
  const side = size * 0.44;
  const stroke = size * 0.14;
  const chevron = {
    width: side,
    height: side,
    borderLeftWidth: stroke,
    borderBottomWidth: stroke,
    borderColor: color,
  };
  return (
    // The visible "V" is the lower half of each turned square, so lift the pair to centre it.
    <View
      style={[styles.centered, { transform: [{ translateY: -side * 0.22 }] }]}
    >
      <View style={[styles.turnedBack, chevron]} />
      <View style={[styles.turnedBack, chevron, { marginTop: -side * 0.5 }]} />
    </View>
  );
}

/** Ambassador: two arrows passing each other. */
function Arrows({ size, color }: ShapeProps) {
  const stroke = size * 0.13;
  const head = size * 0.3;
  const lane = { width: size * 0.86, height: head * 1.3 };
  const shaft = {
    height: stroke,
    borderRadius: stroke / 2,
    backgroundColor: color,
  };
  const tip = {
    width: head,
    height: head,
    top: head * 0.15,
    borderColor: color,
  };
  return (
    <View style={styles.centered}>
      <View style={[styles.lane, lane]}>
        <View style={shaft} />
        <View
          style={[
            styles.tip,
            tip,
            {
              right: head * 0.21,
              borderTopWidth: stroke,
              borderRightWidth: stroke,
            },
          ]}
        />
      </View>
      <View style={[styles.lane, lane]}>
        <View style={shaft} />
        <View
          style={[
            styles.tip,
            tip,
            {
              left: head * 0.21,
              borderBottomWidth: stroke,
              borderLeftWidth: stroke,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Contessa: a cut diamond. */
function Gem({ size, color, cutout }: ShapeProps) {
  const outer = size * 0.62;
  const inner = size * 0.26;
  return (
    <View
      style={[
        styles.gem,
        { width: outer, height: outer, backgroundColor: color },
      ]}
    >
      <View style={{ width: inner, height: inner, backgroundColor: cutout }} />
    </View>
  );
}

const SHAPES: Record<Card, (props: ShapeProps) => React.JSX.Element> = {
  Duke: Crown,
  Assassin: Dagger,
  Captain: Chevrons,
  Ambassador: Arrows,
  Contessa: Gem,
};

/** A character's emblem, drawn from plain views. Decorative: the name next to it carries the meaning. */
export function CharacterGlyph({ card, size, color, cutout }: Props) {
  const Shape = SHAPES[card];
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Shape size={size} color={color} cutout={cutout} />
    </View>
  );
}

/** The emblem on a disc of the character's colour. Decorative. */
export function CharacterBadge({ card, size }: { card: Card; size: number }) {
  const palette = characterColors[card];
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.fill,
        },
      ]}
    >
      <CharacterGlyph
        card={card}
        size={size * 0.6}
        color={palette.accent}
        cutout={palette.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  peak: { overflow: 'hidden', alignItems: 'center' },
  turned: { transform: [{ rotate: '45deg' }] },
  turnedBack: { transform: [{ rotate: '-45deg' }] },
  lane: { justifyContent: 'center' },
  tip: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  gem: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
});
