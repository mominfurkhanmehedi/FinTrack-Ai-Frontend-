import { SettingsScreen } from '../../components/settings';
import { LegalDocument, LegalSection } from '../../components/support';
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from '../../constants/support';
import { useI18n } from '../../i18n';

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    icon: 'layers-outline',
    paragraphs: [
      'We collect information you provide when you create an account, use FinTrack AI, or contact support. We aim to collect only information that is relevant to providing and improving the service.',
    ],
    bullets: [
      'Account information: name, email address, authentication identifiers, profile picture, and account settings.',
      'Financial activity: income and expense transactions, amounts, categories, dates, budgets, savings goals, and related preferences.',
      'App data: language, currency, theme, notification preferences, and technical or diagnostic information generated when you use the service.',
      'Support information: the subject and content of messages you send to our support team.',
    ],
  },
  {
    id: 'financial-information',
    title: '2. Financial and Transaction Information',
    icon: 'wallet-outline',
    paragraphs: [
      'FinTrack AI is designed for self-directed financial tracking. Unless you choose to connect a service made available by the app, you are responsible for entering and maintaining the financial records you want the app to use.',
      'Your transaction history, categories, budgets, goals, and related records are used to calculate balances, trends, forecasts, reports, safe-to-spend estimates, and other features you request. FinTrack AI is not a bank and does not verify the accuracy of entries against a financial institution.',
    ],
  },
  {
    id: 'how-information-is-used',
    title: '3. How We Use Information',
    icon: 'analytics-outline',
    paragraphs: [
      'We use information to authenticate accounts, synchronize your data, operate requested features, save preferences, respond to support requests, protect the service, and improve reliability and usability.',
    ],
    bullets: [
      'Provide account access, cloud synchronization, data export, and account management.',
      'Calculate and display financial summaries, budgets, goals, predictions, and reports.',
      'Generate requested AI-assisted responses and analysis using relevant financial context.',
      'Detect abuse, investigate security incidents, and maintain service performance.',
    ],
  },
  {
    id: 'ai-processing',
    title: '4. AI Processing',
    icon: 'sparkles-outline',
    paragraphs: [
      'Some features use local calculations based on the information in your FinTrack AI account. If an external AI provider is configured for a feature you use, the app may send your question and a limited set of relevant transaction or goal context to that provider to generate a response.',
      'AI providers process submitted information under their own terms and policies. If no external provider is configured or a provider is unavailable, the app uses local, rules-based analysis where available. AI-generated content may be incomplete or inaccurate and should be reviewed against your own records.',
    ],
  },
  {
    id: 'storage-and-sync',
    title: '5. Storage and Synchronization',
    icon: 'cloud-outline',
    paragraphs: [
      'We cache app data on your device so the application can respond quickly and remain available between sessions. When you sign in, transaction and goal records are synchronized with your FinTrack AI account so they can be restored on your devices.',
      'A selected profile picture and some preferences are stored in local app storage. Uninstalling the app or clearing its local data may remove information held only on that device, so export anything you want to keep.',
    ],
  },
  {
    id: 'third-party-services',
    title: '6. Third-Party Services',
    icon: 'business-outline',
    paragraphs: [
      'We may rely on third-party providers for infrastructure, authentication, database storage, network delivery, and optional AI processing. Features may also use services selected or opened by you, such as your device operating system, email application, or another linked service.',
      'Those providers may process information to perform their services and may have their own privacy terms. We do not sell your personal information or use your financial records for advertising. We do not authorize third parties to use your information for their own independent purposes.',
    ],
  },
  {
    id: 'security',
    title: '7. Security',
    icon: 'shield-checkmark-outline',
    paragraphs: [
      'We use reasonable administrative, technical, and organizational measures designed to protect information, including access controls, encrypted connections where supported, data minimization, and secure service configuration. No internet or storage system is completely secure, so no method can guarantee absolute protection.',
      'You are responsible for keeping your account credentials confidential and for promptly reporting unauthorized access. Contact support if you believe your account or information has been compromised.',
    ],
  },
  {
    id: 'retention',
    title: '8. Data Retention',
    icon: 'time-outline',
    paragraphs: [
      'We retain account and synchronized information for as long as your account remains active, as needed to provide the service, and as required to resolve disputes or meet legal obligations. Some information may remain in encrypted or limited backup files for a limited period before deletion.',
      'Local information remains on your device until you delete it, clear app data, sign out where applicable, or uninstall the app. Support records are retained only as long as reasonably needed to manage the request, prevent abuse, and comply with applicable requirements.',
    ],
  },
  {
    id: 'your-rights',
    title: '9. Your Rights and Controls',
    icon: 'person-circle-outline',
    paragraphs: [
      'Depending on where you live, you may have rights to access, correct, export, restrict, object to, or request deletion of personal information. You may also withdraw consent where processing relies on consent.',
      'You can edit profile details, change preferences, delete transactions or goals, export transactions as CSV, clear local app data, or delete your account from Settings. To make another request or exercise a legal right, email us from the account or describe your request clearly.',
    ],
  },
  {
    id: 'children',
    title: '10. Children and Privacy',
    icon: 'happy-outline',
    paragraphs: [
      'FinTrack AI is not intended for children under 13, and we do not knowingly collect personal information from children below that age. If you believe a child has provided information improperly, contact us so we can review and remove it where required.',
    ],
  },
  {
    id: 'policy-changes',
    title: '11. Changes to This Policy',
    icon: 'refresh-outline',
    paragraphs: [
      'We may update this Privacy Policy to describe changes to the service, our practices, or legal requirements. We will update the date shown on this page and provide additional notice when a change is material. Continuing to use FinTrack AI after an update means the revised policy applies from its effective date.',
    ],
  },
];

export default function PrivacyPolicy() {
  const { t } = useI18n();

  return (
    <SettingsScreen
      title={t('privacyPolicy.title')}
      subtitle={`Last updated: ${LEGAL_LAST_UPDATED}`}
    >
      <LegalDocument
        intro="This Privacy Policy explains what information FinTrack AI collects, how that information is used, the choices available to you, and how to contact us. It applies to the FinTrack AI mobile and web applications and related services."
        noticeTitle="Not professional advice"
        noticeBody="FinTrack AI is a financial tracking and management tool. It does not provide financial, investment, tax, accounting, or legal advice. Decisions based on app content remain your responsibility."
        sections={SECTIONS}
        contactTitle="Privacy questions"
        contactBody="If you have a privacy question, data request, or concern, contact us. Do not include passwords, one-time codes, or complete bank account numbers."
        contactButtonTitle="Contact privacy support"
        contactEmail={SUPPORT_EMAIL}
      />
    </SettingsScreen>
  );
}
