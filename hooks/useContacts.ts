import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as Contacts from 'expo-contacts';
import { Alert, Platform } from 'react-native';

export interface AppContact {
  id: string;
  name: string;
  phoneNumber: string; // Normalized format (e.g., "447512345678")
  displayNumber: string; // Original format for display (e.g., "+44 751 234 5678")
  isAppUser: boolean;
  profile?: any;
}

// Normalize phone number to E.164 format (digits only, no leading 0)
const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present (we'll add it back consistently)
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/^\+/, '');
  
  // Handle UK numbers specifically (common case)
  // If starts with 0, replace with country code 44
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = '44' + cleaned.substring(1);
  }
  
  // Handle other common country codes if needed
  // Add more rules here if you support other countries
  
  return cleaned;
};

// Format phone for display
const formatPhoneForDisplay = (normalized: string): string => {
  if (normalized.startsWith('44')) {
    // UK format: +44 751 234 5678
    return `+${normalized.slice(0, 2)} ${normalized.slice(2, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
  }
  return `+${normalized}`;
};

export const useContacts = () => {
  const [contacts, setContacts] = useState<AppContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request contacts permission
  const requestPermission = useCallback(async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    setPermissionGranted(status === 'granted');
    return status === 'granted';
  }, []);

  // Sync phone contacts with app users
  const syncContacts = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get phone contacts
      const { data: phoneContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (!phoneContacts || phoneContacts.length === 0) {
        setLoading(false);
        return;
      }

      // Extract and normalize phone numbers, removing duplicates
      const contactMap = new Map<string, { name: string; original: string }>();
      
      phoneContacts.forEach((contact) => {
        if (contact.phoneNumbers) {
          contact.phoneNumbers.forEach((phone) => {
            const original = phone.number || '';
            const normalized = normalizePhoneNumber(original);
            
            if (normalized && normalized.length >= 10) {
              // Keep the first occurrence of each normalized number
              if (!contactMap.has(normalized)) {
                contactMap.set(normalized, {
                  name: contact.name || 'Unknown',
                  original: original
                });
              }
            }
          });
        }
      });

      const phoneNumbers = Array.from(contactMap.keys());

      // Find which contacts are app users
      const { data: appUsers, error } = await supabase
        .from('profiles')
        .select('*')
        .in('phone_number', phoneNumbers);

      if (error) throw error;

      // Save to user_contacts table with normalized numbers
      const contactsToInsert = phoneNumbers.map(phone => ({
        user_id: user.id,
        contact_phone: phone, // Normalized
        contact_name: contactMap.get(phone)?.name,
        contact_user_id: appUsers?.find((u: any) => u.phone_number === phone)?.id || null,
      }));

      // Delete existing contacts first to avoid duplicates
      await supabase
        .from('user_contacts')
        .delete()
        .eq('user_id', user.id);

      // Insert new contacts
      if (contactsToInsert.length > 0) {
        await supabase
          .from('user_contacts')
          .insert(contactsToInsert);
      }

      // Transform to AppContact format
      const transformed: AppContact[] = contactsToInsert.map((c: any) => ({
        id: c.contact_user_id || c.contact_phone,
        name: c.contact_name,
        phoneNumber: c.contact_phone, // Normalized (e.g., "447512345678")
        displayNumber: formatPhoneForDisplay(c.contact_phone), // Pretty format (e.g., "+44 751 234 5678")
        isAppUser: !!c.contact_user_id,
        profile: appUsers?.find((u: any) => u.phone_number === c.contact_phone),
      }));

      // Sort: app users first, then by name
      transformed.sort((a, b) => {
        if (a.isAppUser && !b.isAppUser) return -1;
        if (!a.isAppUser && b.isAppUser) return 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(transformed);
    } catch (error) {
      console.error('Error syncing contacts:', error);
      Alert.alert('Error', 'Failed to sync contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load contacts from database
  const loadContacts = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_contacts')
        .select(`
          *,
          profile:contact_user_id (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const transformed: AppContact[] = (data || []).map((c: any) => ({
        id: c.contact_user_id || c.contact_phone,
        name: c.contact_name,
        phoneNumber: c.contact_phone,
        displayNumber: formatPhoneForDisplay(c.contact_phone),
        isAppUser: !!c.contact_user_id,
        profile: c.profile,
      }));

      // Sort: app users first
      transformed.sort((a, b) => {
        if (a.isAppUser && !b.isAppUser) return -1;
        if (!a.isAppUser && b.isAppUser) return 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(transformed);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Find user by phone number (normalized)
  const findUserByPhone = useCallback(async (phoneNumber: string) => {
    const normalized = normalizePhoneNumber(phoneNumber);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', normalized)
      .single();

    if (error || !data) return null;
    return data;
  }, []);

  return {
    contacts,
    loading,
    permissionGranted,
    requestPermission,
    syncContacts,
    loadContacts,
    findUserByPhone,
    normalizePhoneNumber, // Export this so you can use it elsewhere
  };
};