import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { Heart, Zap, Activity, MoveRight, Bell, Sparkles, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { HAPTIC_PATTERNS, HapticPattern } from '../hooks/useHapticReactions';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HapticReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (pattern: HapticPattern) => void;
}

const ICON_MAP = {
  Heart,
  Zap,
  Activity,
  MoveRight,
  Bell,
  Sparkles,
};

export default function HapticReactionPicker({ visible, onClose, onSelect }: HapticReactionPickerProps) {
  const { theme, isDark, scale } = useTheme();
  const s = (size: number) => size * scale;

  const handleSelect = (pattern: HapticPattern) => {
    onSelect(pattern);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
        activeOpacity={1}
      >
        <View
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            maxHeight: SCREEN_HEIGHT * 0.6,
            paddingTop: s(16),
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View
            style={{
              width: s(36),
              height: s(4),
              backgroundColor: theme.border,
              borderRadius: s(2),
              alignSelf: 'center',
              marginBottom: s(20),
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: s(20),
              paddingBottom: s(16),
            }}
          >
            <View>
              <Text
                style={{
                  color: theme.text,
                  fontSize: s(20),
                  fontWeight: '700',
                }}
              >
                Send Vibe
              </Text>
              <Text
                style={{
                  color: theme.textMuted,
                  fontSize: s(13),
                  marginTop: s(2),
                }}
              >
                Send a haptic sensation
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: s(36),
                height: s(36),
                borderRadius: s(18),
                backgroundColor: theme.surfaceHighlight,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={s(20)} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Pattern Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: s(20),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: s(12),
              }}
            >
              {(Object.keys(HAPTIC_PATTERNS) as HapticPattern[]).map((pattern) => {
                const config = HAPTIC_PATTERNS[pattern];
                const IconComponent = ICON_MAP[config.icon as keyof typeof ICON_MAP];

                return (
                  <TouchableOpacity
                    key={pattern}
                    onPress={() => handleSelect(pattern)}
                    style={{
                      width: '47%',
                      backgroundColor: theme.surface,
                      borderRadius: s(16),
                      padding: s(16),
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: s(48),
                        height: s(48),
                        borderRadius: s(24),
                        backgroundColor: `${config.color}20`,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: s(12),
                      }}
                    >
                      <IconComponent size={s(24)} color={config.color} />
                    </View>
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: s(15),
                        fontWeight: '700',
                        marginBottom: s(4),
                      }}
                    >
                      {config.name}
                    </Text>
                    <Text
                      style={{
                        color: theme.textMuted,
                        fontSize: s(12),
                      }}
                    >
                      {config.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
