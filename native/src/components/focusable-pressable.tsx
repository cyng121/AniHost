import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRef, useState } from "react";

import { colors, focus, motion, radii } from "@/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface FocusablePressableProps extends Omit<PressableProps, "style"> {
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}

export function FocusablePressable({
  children,
  containerStyle,
  style,
  focusedStyle,
  pressedStyle,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: FocusablePressableProps) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const animate = (value: number) => {
    if (reducedMotion) {
      scale.setValue(value);
      return;
    }
    Animated.timing(scale, {
      toValue: value,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        Platform.isTV && focused ? styles.tvElevation : null,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        {...props}
        disabled={disabled}
        onBlur={(event) => {
          setFocused(false);
          animate(1);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          animate(Platform.isTV ? focus.scale : 1);
          onFocus?.(event);
        }}
        onPressIn={(event) => {
          animate(motion.pressedScale);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(Platform.isTV && focused ? focus.scale : 1);
          onPressOut?.(event);
        }}
        style={({ pressed }) => [
          styles.base,
          style,
          focused ? styles.focused : null,
          focused ? focusedStyle : null,
          pressed ? pressedStyle : null,
          disabled ? styles.disabled : null,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
  },
  focused: {
    borderColor: focus.ringColor,
    borderWidth: focus.ringWidth,
  },
  tvElevation: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 14,
  },
  disabled: {
    opacity: 0.42,
  },
});
