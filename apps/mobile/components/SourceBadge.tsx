import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';

interface SourceBadgeProps {
  name: string;
}

const sourceColors: Record<string, string> = {
  Canvas: '#E63F30',
  SportsYou: '#00A651',
  'Google Calendar': '#4285F4',
  Outlook: '#0078D4',
  Manual: colors.textSecondary,
};

export default function SourceBadge({ name }: SourceBadgeProps) {
  const badgeColor = sourceColors[name] ?? colors.textMuted;

  return (
    <View style={[styles.badge, { borderColor: badgeColor }]}>
      <Text style={[styles.text, { color: badgeColor }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
