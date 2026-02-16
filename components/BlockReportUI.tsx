import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Shield, Ban, Flag, X } from 'lucide-react-native';

interface BlockReportUIProps {
  userName: string;
  onBlock: () => void;
  onReport: (reason: string) => void;
  onClose: () => void;
  theme: any;
  scale: number;
}

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Inappropriate content',
  'Fake account',
  'Other',
];

export const BlockReportUI: React.FC<BlockReportUIProps> = ({
  userName,
  onBlock,
  onReport,
  onClose,
  theme,
  scale,
}) => {
  const s = (size: number) => size * scale;

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? They won't be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: onBlock
        },
      ]
    );
  };

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.container, { backgroundColor: theme.surface, borderRadius: s(20) }]}>
        <View style={[styles.header, { padding: s(20), borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text, fontSize: s(18), fontWeight: '600' }]}>
            User Options
          </Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
            <X size={s(24)} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleBlock}
          style={[styles.option, { padding: s(20) }]}
        >
          <Ban size={s(24)} color={theme.text} style={{ marginRight: s(16) }} />
          <View>
            <Text style={[styles.optionTitle, { color: theme.text, fontSize: s(16), fontWeight: '600' }]}>
              Block {userName}
            </Text>
            <Text style={[styles.optionSubtitle, { color: theme.textMuted, fontSize: s(14), marginTop: s(4) }]}>
              They won't be able to contact you
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border, height: 0.5 }]} />

        <Text style={[styles.sectionTitle, { color: theme.textMuted, fontSize: s(13), paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(8), fontWeight: '600' }]}>
          REPORT
        </Text>

        {REPORT_REASONS.map((reason, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onReport(reason)}
            style={[styles.reasonButton, { paddingHorizontal: s(20), paddingVertical: s(12) }]}
          >
            <Flag size={s(18)} color={theme.textMuted} style={{ marginRight: s(12) }} />
            <Text style={{ color: theme.text, fontSize: s(15) }}>{reason}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTitle: {},
  optionSubtitle: {},
  divider: {},
  sectionTitle: {},
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});