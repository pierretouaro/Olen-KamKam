import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { User, Phone, Mail, X } from 'lucide-react-native';

interface ContactCardProps {
  contact: {
    name: string;
    phone?: string;
    email?: string;
  };
  onClose: () => void;
  theme: any;
  scale: number;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClose,
  theme,
  scale,
}) => {
  const s = (size: number) => size * scale;

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderRadius: s(20), padding: s(24) }]}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: s(16), right: s(16) }}>
          <X size={s(24)} color={theme.textMuted} />
        </TouchableOpacity>

        <View style={[styles.avatar, { backgroundColor: theme.primary, width: s(80), height: s(80), borderRadius: s(40), marginBottom: s(16) }]}>
          <User size={s(40)} color="#fff" />
        </View>

        <Text style={[styles.name, { color: theme.text, fontSize: s(24), fontWeight: '700', marginBottom: s(8) }]}>
          {contact.name}
        </Text>

        {contact.phone && (
          <View style={[styles.row, { marginTop: s(12) }]}>
            <Phone size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
            <Text style={{ color: theme.textSecondary, fontSize: s(16) }}>{contact.phone}</Text>
          </View>
        )}

        {contact.email && (
          <View style={[styles.row, { marginTop: s(8) }]}>
            <Mail size={s(20)} color={theme.primary} style={{ marginRight: s(12) }} />
            <Text style={{ color: theme.textSecondary, fontSize: s(16) }}>{contact.email}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: theme.primary,
              padding: s(16),
              borderRadius: s(12),
              marginTop: s(24),
              alignItems: 'center',
            }
          ]}
        >
          <Text style={{ color: '#fff', fontSize: s(16), fontWeight: '600' }}>Add to Contacts</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    width: '80%',
    alignItems: 'center',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    width: '100%',
  },
});