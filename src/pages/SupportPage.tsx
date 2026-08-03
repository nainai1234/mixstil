import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clipboard, FileText, Mail, Shield, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

const configuredSupportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL ?? '').trim();
const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSupportEmail)
  && !configuredSupportEmail.endsWith('@example.com')
  ? configuredSupportEmail
  : '';

const supportCopy = {
  zh: { back: '返回', title: '支持', subtitle: '收听、已保存声音和账号帮助', contact: '联系支持', contactBody: '请说明你当时想播放什么，以及问题是否发生在锁屏、更换音频设备或网络断开之后。', email: '邮件联系支持', noEmail: '此版本尚未配置支持邮箱。', diagnostics: '诊断信息', diagnosticsBody: '这些信息只包含设备和 App 信息，不包含你的账号、声音请求或已保存声音。', copied: '详情已复制', copy: '复制诊断信息', account: '账号与隐私', accountSettings: '账号设置', privacy: '隐私与数据删除', credits: '音频署名与授权' },
  en: { back: 'Back', title: 'Support', subtitle: 'Help with listening, saved sounds, and accounts', contact: 'Contact', contactBody: 'Include what you were trying to play and whether the issue happened after locking the screen, changing audio devices, or losing the network.', email: 'Email support', noEmail: 'Support contact is not configured for this build.', diagnostics: 'Diagnostic details', diagnosticsBody: 'These details contain device and app information only. They do not include your account, sound requests, or saved sounds.', copied: 'Details copied', copy: 'Copy diagnostic details', account: 'Account and privacy', accountSettings: 'Account settings', privacy: 'Privacy and data deletion', credits: 'Audio credits and licenses' },
  hi: { back: 'वापस', title: 'सहायता', subtitle: 'सुनने, सहेजे साउंड और खाते में मदद', contact: 'संपर्क', contactBody: 'बताएं आप क्या चला रहे थे और समस्या स्क्रीन लॉक, ऑडियो डिवाइस बदलने या नेटवर्क टूटने के बाद हुई या नहीं।', email: 'सहायता को ईमेल करें', noEmail: 'इस बिल्ड में सहायता संपर्क कॉन्फ़िगर नहीं है।', diagnostics: 'निदान विवरण', diagnosticsBody: 'इनमें केवल डिवाइस और ऐप जानकारी है। खाता, साउंड अनुरोध या सहेजे साउंड शामिल नहीं हैं।', copied: 'विवरण कॉपी हुआ', copy: 'निदान विवरण कॉपी करें', account: 'खाता और गोपनीयता', accountSettings: 'खाता सेटिंग', privacy: 'गोपनीयता और डेटा हटाना', credits: 'ऑडियो क्रेडिट और लाइसेंस' },
  es: { back: 'Atrás', title: 'Soporte', subtitle: 'Ayuda con escucha, sonidos guardados y cuentas', contact: 'Contacto', contactBody: 'Incluye qué intentabas reproducir y si ocurrió después de bloquear la pantalla, cambiar dispositivos de audio o perder la red.', email: 'Enviar correo a soporte', noEmail: 'El contacto de soporte no está configurado para esta versión.', diagnostics: 'Detalles de diagnóstico', diagnosticsBody: 'Solo incluyen información del dispositivo y la app. No incluyen tu cuenta, solicitudes ni sonidos guardados.', copied: 'Detalles copiados', copy: 'Copiar detalles de diagnóstico', account: 'Cuenta y privacidad', accountSettings: 'Ajustes de cuenta', privacy: 'Privacidad y eliminación de datos', credits: 'Créditos y licencias de audio' },
  ar: { back: 'رجوع', title: 'الدعم', subtitle: 'مساعدة في الاستماع والأصوات المحفوظة والحسابات', contact: 'تواصل', contactBody: 'اذكر ما كنت تحاول تشغيله وهل حدثت المشكلة بعد قفل الشاشة أو تغيير جهاز الصوت أو فقدان الشبكة.', email: 'مراسلة الدعم', noEmail: 'لم يتم إعداد جهة دعم لهذا الإصدار.', diagnostics: 'تفاصيل التشخيص', diagnosticsBody: 'تحتوي هذه التفاصيل على معلومات الجهاز والتطبيق فقط، ولا تشمل حسابك أو طلبات الصوت أو الأصوات المحفوظة.', copied: 'تم نسخ التفاصيل', copy: 'نسخ تفاصيل التشخيص', account: 'الحساب والخصوصية', accountSettings: 'إعدادات الحساب', privacy: 'الخصوصية وحذف البيانات', credits: 'اعتمادات الصوت والتراخيص' },
  bn: { back: 'ফিরুন', title: 'সহায়তা', subtitle: 'শোনা, সংরক্ষিত সাউন্ড ও অ্যাকাউন্টে সহায়তা', contact: 'যোগাযোগ', contactBody: 'আপনি কী চালাতে চেয়েছিলেন এবং সমস্যা স্ক্রিন লক, অডিও ডিভাইস বদল বা নেটওয়ার্ক হারানোর পরে হয়েছে কি না লিখুন।', email: 'সহায়তায় ইমেল করুন', noEmail: 'এই বিল্ডে সহায়তা যোগাযোগ কনফিগার করা নেই।', diagnostics: 'ডায়াগনস্টিক বিবরণ', diagnosticsBody: 'এতে শুধু ডিভাইস ও অ্যাপ তথ্য থাকে। অ্যাকাউন্ট, সাউন্ড অনুরোধ বা সংরক্ষিত সাউন্ড থাকে না।', copied: 'বিবরণ কপি হয়েছে', copy: 'ডায়াগনস্টিক বিবরণ কপি করুন', account: 'অ্যাকাউন্ট ও গোপনীয়তা', accountSettings: 'অ্যাকাউন্ট সেটিংস', privacy: 'গোপনীয়তা ও ডেটা মুছুন', credits: 'অডিও ক্রেডিট ও লাইসেন্স' },
  pt: { back: 'Voltar', title: 'Suporte', subtitle: 'Ajuda com escuta, sons salvos e contas', contact: 'Contato', contactBody: 'Inclua o que você tentava reproduzir e se aconteceu após bloquear a tela, trocar dispositivos de áudio ou perder a rede.', email: 'Enviar email ao suporte', noEmail: 'O contato de suporte não está configurado nesta versão.', diagnostics: 'Detalhes de diagnóstico', diagnosticsBody: 'Esses detalhes contêm apenas informações do dispositivo e do app. Não incluem conta, pedidos de som ou sons salvos.', copied: 'Detalhes copiados', copy: 'Copiar detalhes de diagnóstico', account: 'Conta e privacidade', accountSettings: 'Configurações da conta', privacy: 'Privacidade e exclusão de dados', credits: 'Créditos e licenças de áudio' },
  ru: { back: 'Назад', title: 'Поддержка', subtitle: 'Помощь со звуками, сохранениями и аккаунтом', contact: 'Контакты', contactBody: 'Укажите, что вы пытались воспроизвести, и случилось ли это после блокировки экрана, смены аудиоустройства или потери сети.', email: 'Написать в поддержку', noEmail: 'Контакт поддержки не настроен для этой сборки.', diagnostics: 'Диагностические данные', diagnosticsBody: 'Они содержат только сведения об устройстве и приложении. Аккаунт, запросы и сохраненные звуки не включены.', copied: 'Данные скопированы', copy: 'Скопировать диагностику', account: 'Аккаунт и приватность', accountSettings: 'Настройки аккаунта', privacy: 'Приватность и удаление данных', credits: 'Авторы и лицензии аудио' },
  ja: { back: '戻る', title: 'サポート', subtitle: '再生、保存済みサウンド、アカウントのヘルプ', contact: '問い合わせ', contactBody: '何を再生しようとしていたか、画面ロック、音声デバイス変更、ネットワーク切断の後に起きたかを書いてください。', email: 'サポートにメール', noEmail: 'このビルドではサポート連絡先が設定されていません。', diagnostics: '診断情報', diagnosticsBody: '端末とアプリ情報のみ含みます。アカウント、音のリクエスト、保存済みサウンドは含みません。', copied: '詳細をコピーしました', copy: '診断情報をコピー', account: 'アカウントとプライバシー', accountSettings: 'アカウント設定', privacy: 'プライバシーとデータ削除', credits: '音声クレジットとライセンス' },
  id: { back: 'Kembali', title: 'Dukungan', subtitle: 'Bantuan untuk mendengar, suara tersimpan, dan akun', contact: 'Kontak', contactBody: 'Sertakan apa yang ingin diputar dan apakah masalah terjadi setelah layar terkunci, perangkat audio berubah, atau jaringan hilang.', email: 'Email dukungan', noEmail: 'Kontak dukungan belum dikonfigurasi untuk build ini.', diagnostics: 'Detail diagnostik', diagnosticsBody: 'Detail ini hanya berisi informasi perangkat dan app. Tidak termasuk akun, permintaan suara, atau suara tersimpan.', copied: 'Detail disalin', copy: 'Salin detail diagnostik', account: 'Akun dan privasi', accountSettings: 'Pengaturan akun', privacy: 'Privasi dan penghapusan data', credits: 'Kredit dan lisensi audio' },
  de: { back: 'Zurück', title: 'Support', subtitle: 'Hilfe beim Hören, Speichern und Konto', contact: 'Kontakt', contactBody: 'Beschreibe, was du abspielen wolltest und ob es nach Sperrbildschirm, Audiogerätewechsel oder Netzverlust passiert ist.', email: 'Support per E-Mail', noEmail: 'Für diesen Build ist keine Supportadresse eingerichtet.', diagnostics: 'Diagnosedetails', diagnosticsBody: 'Diese Angaben enthalten nur Geräte- und App-Informationen, keine Konten, Klanganfragen oder gespeicherten Klänge.', copied: 'Details kopiert', copy: 'Diagnosedetails kopieren', account: 'Konto und Datenschutz', accountSettings: 'Kontoeinstellungen', privacy: 'Datenschutz und Datenlöschung', credits: 'Audio-Credits und Lizenzen' },
  fr: { back: 'Retour', title: 'Aide', subtitle: 'Aide pour l’écoute, les sons enregistrés et le compte', contact: 'Contact', contactBody: 'Indiquez ce que vous vouliez lire et si le problème est survenu après verrouillage, changement d’appareil audio ou perte réseau.', email: 'Contacter le support', noEmail: 'Aucun contact support n’est configuré pour cette version.', diagnostics: 'Détails de diagnostic', diagnosticsBody: 'Ces détails contiennent seulement des informations appareil et app, pas votre compte ni vos sons.', copied: 'Détails copiés', copy: 'Copier le diagnostic', account: 'Compte et confidentialité', accountSettings: 'Paramètres du compte', privacy: 'Confidentialité et suppression', credits: 'Crédits audio et licences' },
  ko: { back: '뒤로', title: '지원', subtitle: '청취, 저장된 소리, 계정 도움말', contact: '문의', contactBody: '재생하려던 내용과 화면 잠금, 오디오 기기 변경, 네트워크 끊김 뒤에 발생했는지 알려 주세요.', email: '지원팀에 이메일', noEmail: '이 빌드에는 지원 이메일이 설정되지 않았습니다.', diagnostics: '진단 정보', diagnosticsBody: '기기와 앱 정보만 포함하며 계정, 소리 요청, 저장된 소리는 포함하지 않습니다.', copied: '정보가 복사되었습니다', copy: '진단 정보 복사', account: '계정 및 개인정보', accountSettings: '계정 설정', privacy: '개인정보 및 데이터 삭제', credits: '오디오 크레딧 및 라이선스' },
  it: { back: 'Indietro', title: 'Supporto', subtitle: 'Aiuto per ascolto, suoni salvati e account', contact: 'Contatto', contactBody: 'Indica cosa stavi provando a riprodurre e se è successo dopo blocco schermo, cambio dispositivo audio o perdita rete.', email: 'Email al supporto', noEmail: 'Il contatto supporto non è configurato per questa build.', diagnostics: 'Dettagli diagnostici', diagnosticsBody: 'Contengono solo informazioni su dispositivo e app, non account, richieste o suoni salvati.', copied: 'Dettagli copiati', copy: 'Copia dettagli diagnostici', account: 'Account e privacy', accountSettings: 'Impostazioni account', privacy: 'Privacy ed eliminazione dati', credits: 'Crediti audio e licenze' },
  nl: { back: 'Terug', title: 'Ondersteuning', subtitle: 'Hulp met luisteren, opgeslagen geluiden en accounts', contact: 'Contact', contactBody: 'Vermeld wat je probeerde af te spelen en of het gebeurde na schermvergrendeling, ander audioapparaat of netwerkverlies.', email: 'Support e-mailen', noEmail: 'Supportcontact is niet ingesteld voor deze build.', diagnostics: 'Diagnostische details', diagnosticsBody: 'Deze details bevatten alleen apparaat- en app-informatie, geen account, geluidsverzoeken of opgeslagen geluiden.', copied: 'Details gekopieerd', copy: 'Diagnose kopiëren', account: 'Account en privacy', accountSettings: 'Accountinstellingen', privacy: 'Privacy en gegevens verwijderen', credits: 'Audiocredits en licenties' },
} as const;

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const copy = (supportCopy as unknown as Record<string, typeof supportCopy.en>)[locale] ?? supportCopy.en;
  const [copied, setCopied] = useState(false);
  const diagnostics = useMemo(() => [
    `Time: ${new Date().toISOString()}`,
    `Online: ${navigator.onLine ? 'yes' : 'no'}`,
    `Language: ${navigator.language}`,
    `Platform: ${navigator.platform || 'unknown'}`,
    `User agent: ${navigator.userAgent}`,
  ].join('\n'), []);

  const copyDiagnostics = async () => {
    await navigator.clipboard.writeText(diagnostics);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px var(--space-6) 72px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
          <button type="button" className="btn-icon" onClick={() => navigate(-1)} aria-label={copy.back}><ArrowLeft size={22} /></button>
          <div>
            <h1 style={{ fontSize: 26 }}>{copy.title}</h1>
            <p className="text-xs text-secondary">{copy.subtitle}</p>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 30 }}>
          <section>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{copy.contact}</h2>
            <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
              {copy.contactBody}
            </p>
            {supportEmail ? (
              <a
                className="btn btn-primary"
                href={`mailto:${supportEmail}?subject=${encodeURIComponent('MixStil support request')}`}
                style={{ width: '100%' }}
              >
                <Mail size={17} />
                {copy.email}
              </a>
            ) : (
              <p role="status" className="text-sm" style={{ padding: 14, border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-secondary)' }}>
                {copy.noEmail}
              </p>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{copy.diagnostics}</h2>
            <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
              {copy.diagnosticsBody}
            </p>
            <button type="button" className="btn" onClick={copyDiagnostics} style={{ width: '100%', background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
              {copied ? <Check size={17} /> : <Clipboard size={17} />}
              {copied ? copy.copied : copy.copy}
            </button>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>{copy.account}</h2>
            <div style={{ borderTop: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
              <button type="button" onClick={() => navigate('/profile')} style={{ width: '100%', minHeight: 56, padding: '0 4px', border: 0, borderBottom: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
                <UserRound size={19} color="var(--primary)" />
                <span style={{ flex: 1, fontWeight: 550 }}>{copy.accountSettings}</span>
                <ChevronRight size={17} color="var(--text-secondary)" />
              </button>
              <button type="button" onClick={() => navigate('/privacy')} style={{ width: '100%', minHeight: 56, padding: '0 4px', border: 0, borderBottom: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
                <Shield size={19} color="var(--primary)" />
                <span style={{ flex: 1, fontWeight: 550 }}>{copy.privacy}</span>
                <ChevronRight size={17} color="var(--text-secondary)" />
              </button>
              <button type="button" onClick={() => navigate('/audio-credits')} style={{ width: '100%', minHeight: 56, padding: '0 4px', border: 0, background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
                <FileText size={19} color="var(--primary)" />
                <span style={{ flex: 1, fontWeight: 550 }}>{copy.credits}</span>
                <ChevronRight size={17} color="var(--text-secondary)" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default SupportPage;
