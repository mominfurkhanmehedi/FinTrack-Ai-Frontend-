import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card, Input } from '../../components/ui';

const SUPPORT_EMAIL = 'support@fintrack.ai';

/**
 * Screen: ContactUs
 * Simple contact form that opens the user's mail client (mailto:) with the
 * composed message pre-filled.
 */
export default function ContactUs() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    const body = encodeURIComponent(`\n\n${message}\n`);
    const subj = encodeURIComponent(subject || 'FinTrack AI support request');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Web fallback: no mail client, but keep flow non-fatal.
        setSending(false);
        return;
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsScreen title="Contact Us" subtitle={`Reach us at ${SUPPORT_EMAIL}`}>
      <Card>
        <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="How can we help?" />
        <Input
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Write your message…"
          multiline
          numberOfLines={6}
        />
      </Card>
      <View className="h-4" />
      <Button title="Send message" onPress={send} loading={sending} fullWidth />
    </SettingsScreen>
  );
}