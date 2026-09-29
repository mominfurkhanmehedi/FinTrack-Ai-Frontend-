import { SettingsScreen } from '../../components/settings';
import { LegalDocument, LegalSection } from '../../components/support';
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from '../../constants/support';
import { useI18n } from '../../i18n';

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of These Terms',
    icon: 'checkmark-circle-outline',
    paragraphs: [
      'By creating an account or using FinTrack AI, you agree to these Terms & Conditions and acknowledge the Privacy Policy. If you do not agree, do not create an account or use the service. You confirm that you have the legal capacity to accept these terms in your location.',
      'These terms apply to the FinTrack AI mobile and web applications and related services. Additional terms may apply to a separate service or feature that we identify before you use it.',
    ],
  },
  {
    id: 'account-usage',
    title: '2. Account Usage',
    icon: 'person-circle-outline',
    paragraphs: [
      'You must provide accurate account information, keep it current, and protect your password and sign-in devices. You are responsible for activity performed through your account unless the activity resulted from unauthorized access that you reported promptly and reasonably cooperated with our investigation.',
      'You may not share, resell, rent, or transfer an account without our written permission. We may require reasonable verification for account or data requests to protect users and prevent abuse.',
    ],
  },
  {
    id: 'financial-information',
    title: '3. Financial Information and Records',
    icon: 'wallet-outline',
    paragraphs: [
      'FinTrack AI is a self-directed tracking and management tool, not a bank, broker, payment service, accounting firm, or government financial authority. Unless a service is expressly identified as connected, you are responsible for entering, reviewing, correcting, and backing up the financial information you provide.',
      'Calculations, projections, balances, reports, and recommendations are based on the information available to the app and may be incomplete or delayed. You should verify important figures against your own records. FinTrack AI does not act as a fiduciary or make decisions on your behalf.',
    ],
  },
  {
    id: 'ai-content',
    title: '4. AI-Generated Content and No Advice',
    icon: 'sparkles-outline',
    paragraphs: [
      'AI-generated responses, insights, forecasts, categories, and recommendations are informational and may be inaccurate, incomplete, outdated, or based on incorrect input. You must review important outputs and should not rely on them as a substitute for professional judgment.',
      'FinTrack AI does not provide financial, investment, tax, accounting, or legal advice, recommendations, or transactions. Nothing in the service creates an adviser, fiduciary, broker-dealer, attorney-client, or similar relationship. Consult appropriately qualified professionals before making decisions.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable Use',
    icon: 'shield-checkmark-outline',
    paragraphs: [
      'You may use FinTrack AI only for lawful personal or internal purposes and in compliance with these terms. You are responsible for your use of the service and for any information you submit.',
    ],
    bullets: [
      'Do not use the service for fraud, unlawful activity, harassment, or infringement of another person’s rights.',
      'Do not attempt to gain unauthorized access, probe the service, disrupt availability, or bypass security controls.',
      'Do not upload malicious code, impersonate another person, or submit knowingly false or misleading information.',
      'Do not scrape, resell, reverse engineer, or misuse AI features except where expressly permitted by law.',
      'Do not use FinTrack AI as the sole basis for financial, investment, tax, accounting, legal, or safety-critical decisions.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    icon: 'color-palette-outline',
    paragraphs: [
      'The FinTrack AI name, interface, software, design, graphics, text, and other materials provided as part of the service are owned by or licensed to the FinTrack AI operators and protected by intellectual property laws. No rights are granted except the limited right to use the service under these terms.',
      'You retain ownership of the information you provide. You grant the FinTrack AI operators and service providers only the permissions needed to host, process, synchronize, display, and export that information so the service can operate. Third-party names and marks belong to their respective owners.',
    ],
  },
  {
    id: 'third-party-services',
    title: '7. Third-Party Services',
    icon: 'business-outline',
    paragraphs: [
      'The service may rely on infrastructure, authentication, storage, AI, and other third-party providers. It may also link to or open services selected by you. We do not control every third-party service and are not responsible for its availability, content, security, or privacy practices.',
      'Your use of a third-party service may be subject to separate terms and privacy notices. Review those terms before connecting or sharing information.',
    ],
  },
  {
    id: 'availability',
    title: '8. Availability and Changes',
    icon: 'cloud-outline',
    paragraphs: [
      'We work to keep FinTrack AI available and accurate but do not guarantee uninterrupted, real-time, or error-free operation. Features may be limited by your device, network, maintenance, synchronization, or changes to backend and third-party services.',
      'We may modify, suspend, or discontinue features after giving notice where appropriate. Local cached information may not reflect a change made elsewhere until the next successful synchronization.',
    ],
  },
  {
    id: 'liability',
    title: '9. Disclaimer and Limitation of Liability',
    icon: 'alert-circle-outline',
    paragraphs: [
      'To the fullest extent permitted by law, FinTrack AI and the service are provided "as is" and "as available" without implied warranties of accuracy, merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that every calculation, projection, or AI-generated output will meet your needs.',
      'To the fullest extent permitted by law, the FinTrack AI operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, income, savings, or data, arising from your use of or inability to use the service. Nothing in these terms excludes rights or liability that cannot lawfully be excluded.',
    ],
  },
  {
    id: 'termination',
    title: '10. Termination',
    icon: 'exit-outline',
    paragraphs: [
      'You may stop using FinTrack AI or delete your account at any time. We may suspend or terminate access for a material breach, security risk, unlawful activity, non-payment of any applicable charge, or where required by law. Where appropriate, we will provide notice and an opportunity to resolve the issue.',
      'On termination, access and synchronization may stop. Data may remain for a limited period for backup, security, dispute, or legal purposes before deletion. Provisions that by their nature should continue, including ownership, disclaimers, liability limits, and dispute-related terms, survive termination.',
    ],
  },
  {
    id: 'changes-to-terms',
    title: '11. Changes to These Terms',
    icon: 'refresh-outline',
    paragraphs: [
      'We may update these Terms as the service, our business, or legal requirements change. We will update the effective date and provide additional notice for material changes when practical. The version presented when you use the service governs that use.',
      'If you do not accept revised terms, you should stop using the service and may delete your account. Continued use after the effective date means you accept the updated terms. A question about these terms can be sent using the contact details below.',
    ],
  },
];

export default function Terms() {
  const { t } = useI18n();

  return (
    <SettingsScreen
      title={t('terms.title')}
      subtitle={`Effective: ${LEGAL_LAST_UPDATED}`}
    >
      <LegalDocument
        intro="These Terms & Conditions govern your access to and use of FinTrack AI. Please read them together with the Privacy Policy. If you do not agree, do not use the service."
        noticeTitle="No professional advice"
        noticeBody="FinTrack AI is a financial tracking and management tool. It does not provide financial, investment, tax, accounting, or legal advice. Seek advice from qualified professionals about your circumstances."
        sections={SECTIONS}
        contactTitle="Questions about these terms"
        contactBody="Contact us if you have a question about your account, these terms, or a service issue. Do not include passwords or one-time codes."
        contactButtonTitle="Contact support"
        contactEmail={SUPPORT_EMAIL}
      />
    </SettingsScreen>
  );
}
