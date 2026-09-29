import { StyleSheet } from 'react-native';

/**
 * Shared `pointerEvents` styles.
 *
 * React Native deprecated the `pointerEvents` *prop* in favour of
 * `style.pointerEvents`, and react-native-web logs
 * "props.pointerEvents is deprecated. Use style.pointerEvents" from
 * `createDOMProps` whenever that prop reaches a host component. Passing the
 * value through `style` instead clears the warning.
 *
 * These MUST be registered with `StyleSheet.create` — never write them as a
 * plain inline object such as `style={{ pointerEvents: 'box-none' }}`.
 *
 * `'box-none'` and `'box-only'` are React-Native-only values that have no CSS
 * equivalent, so react-native-web has to polyfill each one into *two* rules:
 * one for the element itself and a `> *` companion rule for its children.
 * That polyfill only runs in the atomic compiler, i.e. for styles created via
 * `StyleSheet.create`. A plain inline style object is handed straight to React
 * DOM, where `box-none` is an invalid value that the browser simply discards —
 * the overlay would stop being transparent to its own children and its
 * hit-testing would break, with no error to show for it.
 *
 * Usage:
 *   <View style={POINTER_EVENTS.none} />                              // static
 *   <View style={[styles.panel, open ? POINTER_EVENTS.auto : POINTER_EVENTS.none]} />
 */
export const POINTER_EVENTS = StyleSheet.create({
  auto: { pointerEvents: 'auto' },
  none: { pointerEvents: 'none' },
  boxNone: { pointerEvents: 'box-none' },
  boxOnly: { pointerEvents: 'box-only' },
});
