import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';

interface MemberPillProps {
  name: string;
  color: string;
  isSelected: boolean;
  onPress: () => void;
}

export default function MemberPill({ name, color, isSelected, onPress }: MemberPillProps) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        isSelected && { backgroundColor: color, borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: isSelected ? colors.white : color }]} />
      <Text style={[styles.text, isSelected && styles.selectedText]}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  selectedText: {
    color: colors.white,
  },
});
