import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

const privacyCopy = {
  zh: {
    back: '返回',
    title: '隐私',
    effective: '生效日期：2026 年 7 月 14 日',
    sections: [
      ['MixStil 使用的数据', 'MixStil 会保存账号信息、声音请求、明确偏好和排除项、已保存声音配方、收听历史、播放可靠性事件，以及提供和改进服务所需的基础设备或 App 诊断信息。'],
      ['数据如何使用', '这些数据用于生成和重播你的声景、记住你明确保存的选择、维护账号安全、诊断播放失败，并理解整体产品可靠性。MixStil 不会用声音偏好做医疗诊断或治疗决策。'],
      ['服务提供方', '基础设施、AI 处理、存储和分发服务提供方只会处理运行其服务部分所需的信息。MixStil 不出售个人信息，也不为跨场景行为广告共享个人信息。'],
      ['保留与控制', '你可以在“我的”页面更改明确的声音偏好。账号有效期间，已保存声音和账号数据会被保留，或因安全和法律义务按需保留。离线副本会保留在设备上，直到被移除或本地 App 数据被清除。'],
      ['账号删除', '“我的”页面包含删除账号。登录并明确确认后，删除会移除账号、认证会话、偏好记忆、已保存声音、收听历史和用户生成的渲染文件。因法律或安全义务必须保留的数据会被隔离，并按适用保留政策到期。'],
      ['儿童与健康信息', 'MixStil 不面向 13 岁以下儿童，也不是医疗服务。请不要在声音请求中提交医疗记录或紧急信息。'],
    ],
  },
  en: {
    back: 'Back',
    title: 'Privacy',
    effective: 'Effective July 14, 2026',
    sections: [
      ['Data MixStil uses', 'MixStil stores account details, sound requests, explicit preferences and exclusions, saved sound recipes, listening history, playback reliability events, and basic device or app diagnostics needed to provide and improve the service.'],
      ['How data is used', 'The data is used to generate and replay your soundscapes, remember choices you explicitly save, maintain account security, diagnose playback failures, and understand aggregate product reliability. MixStil does not use sound preferences to make medical diagnoses or treatment decisions.'],
      ['Service providers', 'Infrastructure, AI processing, storage, and delivery providers may process only the information needed to operate their part of the service. MixStil does not sell personal information or share it for cross-context behavioral advertising.'],
      ['Retention and control', 'You can change explicit sound preferences in Profile. Saved sounds and account data are retained while your account is active or as needed for security and legal obligations. Offline copies remain on the device until removed or until local app data is cleared.'],
      ['Account deletion', 'Profile includes Delete account. After sign-in and explicit confirmation, deletion removes the account, authentication sessions, preference memory, saved sounds, listening history, and user-generated rendered files. Data that must be retained for legal or security obligations is isolated and expires under the applicable retention policy.'],
      ['Children and health information', 'MixStil is not directed to children under 13 and is not a medical service. Do not submit medical records or emergency information in sound requests.'],
    ],
  },
  hi: { back: 'वापस', title: 'गोपनीयता', effective: 'प्रभावी 14 जुलाई 2026', sections: [['MixStil कौन सा डेटा उपयोग करता है', 'MixStil खाता जानकारी, साउंड अनुरोध, स्पष्ट पसंद और बहिष्करण, सहेजी गई रेसिपी, सुनने का इतिहास, प्लेबैक विश्वसनीयता घटनाएं और सेवा सुधार के लिए जरूरी बुनियादी डिवाइस या ऐप निदान रखता है।'], ['डेटा का उपयोग', 'डेटा साउंडस्केप बनाने और फिर चलाने, आपकी स्पष्ट रूप से सहेजी पसंद याद रखने, खाता सुरक्षा, प्लेबैक विफलता निदान और समग्र विश्वसनीयता समझने के लिए उपयोग होता है। MixStil चिकित्सा निदान या उपचार निर्णय नहीं करता।'], ['सेवा प्रदाता', 'इन्फ्रास्ट्रक्चर, AI, स्टोरेज और डिलीवरी प्रदाता केवल सेवा चलाने के लिए जरूरी जानकारी संसाधित कर सकते हैं। MixStil व्यक्तिगत जानकारी नहीं बेचता।'], ['रोक और नियंत्रण', 'आप प्रोफ़ाइल में स्पष्ट ध्वनि पसंद बदल सकते हैं। सहेजे साउंड और खाता डेटा खाता सक्रिय रहने तक या सुरक्षा व कानूनी जरूरत के अनुसार रखे जाते हैं।'], ['खाता हटाना', 'प्रोफ़ाइल में खाता हटाने का विकल्प है। पुष्टि के बाद खाता, सत्र, पसंद स्मृति, सहेजे साउंड और सुनने का इतिहास हटाए जाते हैं।'], ['बच्चे और स्वास्थ्य जानकारी', 'MixStil 13 वर्ष से कम बच्चों के लिए नहीं है और चिकित्सा सेवा नहीं है। ध्वनि अनुरोधों में मेडिकल रिकॉर्ड या आपात जानकारी न दें।']] },
  es: { back: 'Atrás', title: 'Privacidad', effective: 'Vigente desde el 14 de julio de 2026', sections: [['Datos que usa MixStil', 'MixStil guarda datos de cuenta, solicitudes de sonido, preferencias y exclusiones explícitas, recetas guardadas, historial de escucha, eventos de fiabilidad y diagnósticos básicos necesarios para prestar y mejorar el servicio.'], ['Cómo se usan los datos', 'Los datos se usan para generar y reproducir tus paisajes sonoros, recordar elecciones que guardas, mantener la seguridad, diagnosticar fallos y entender la fiabilidad agregada. MixStil no usa preferencias sonoras para diagnósticos médicos ni decisiones de tratamiento.'], ['Proveedores de servicio', 'Los proveedores de infraestructura, IA, almacenamiento y entrega procesan solo la información necesaria. MixStil no vende información personal ni la comparte para publicidad conductual entre contextos.'], ['Retención y control', 'Puedes cambiar tus preferencias en Perfil. Los sonidos guardados y datos de cuenta se conservan mientras la cuenta esté activa o por obligaciones legales y de seguridad.'], ['Eliminación de cuenta', 'Perfil incluye eliminar cuenta. Tras iniciar sesión y confirmar, se eliminan cuenta, sesiones, memoria de preferencias, sonidos guardados, historial y archivos generados.'], ['Niños e información de salud', 'MixStil no está dirigido a menores de 13 años y no es un servicio médico. No envíes historiales médicos ni información de emergencia.']] },
  ar: { back: 'رجوع', title: 'الخصوصية', effective: 'ساري في 14 يوليو 2026', sections: [['البيانات التي يستخدمها MixStil', 'يحفظ MixStil تفاصيل الحساب وطلبات الصوت والتفضيلات والاستبعادات الصريحة والوصفات المحفوظة وسجل الاستماع وأحداث موثوقية التشغيل وتشخيصات أساسية لازمة لتقديم الخدمة وتحسينها.'], ['كيفية استخدام البيانات', 'تستخدم البيانات لإنشاء المشاهد الصوتية وإعادتها وتذكر اختياراتك المحفوظة وحماية الحساب وتشخيص أعطال التشغيل وفهم الموثوقية الإجمالية. لا يستخدم MixStil تفضيلات الصوت للتشخيص الطبي أو قرارات العلاج.'], ['مزودو الخدمة', 'قد يعالج مزودو البنية التحتية والذكاء الاصطناعي والتخزين والتسليم المعلومات اللازمة فقط لتشغيل جزءهم من الخدمة. لا يبيع MixStil المعلومات الشخصية.'], ['الاحتفاظ والتحكم', 'يمكنك تغيير تفضيلات الصوت الصريحة في الملف. يتم الاحتفاظ بالأصوات وبيانات الحساب أثناء نشاط الحساب أو حسب متطلبات الأمن والقانون.'], ['حذف الحساب', 'يتضمن الملف حذف الحساب. بعد تسجيل الدخول والتأكيد الصريح، تتم إزالة الحساب والجلسات وذاكرة التفضيلات والأصوات المحفوظة وسجل الاستماع والملفات الناتجة.'], ['الأطفال والمعلومات الصحية', 'MixStil ليس موجهاً للأطفال دون 13 عاماً وليس خدمة طبية. لا ترسل سجلات طبية أو معلومات طوارئ.']] },
  bn: { back: 'ফিরুন', title: 'গোপনীয়তা', effective: 'কার্যকর 14 জুলাই 2026', sections: [['MixStil যে ডেটা ব্যবহার করে', 'MixStil অ্যাকাউন্ট তথ্য, সাউন্ড অনুরোধ, স্পষ্ট পছন্দ ও বর্জন, সংরক্ষিত রেসিপি, শোনার ইতিহাস, প্লেব্যাক নির্ভরযোগ্যতা ইভেন্ট এবং পরিষেবা উন্নতির জন্য প্রয়োজনীয় ডিভাইস বা অ্যাপ ডায়াগনস্টিক সংরক্ষণ করে।'], ['ডেটা কীভাবে ব্যবহৃত হয়', 'ডেটা সাউন্ডস্কেপ তৈরি ও রিপ্লে, সংরক্ষিত পছন্দ মনে রাখা, নিরাপত্তা, প্লেব্যাক ব্যর্থতা নির্ণয় এবং সামগ্রিক নির্ভরযোগ্যতা বোঝার জন্য ব্যবহৃত হয়। MixStil চিকিৎসা নির্ণয় বা চিকিৎসা সিদ্ধান্ত করে না।'], ['সেবা প্রদানকারী', 'ইনফ্রাস্ট্রাকচার, AI, স্টোরেজ ও ডেলিভারি প্রদানকারী শুধুমাত্র প্রয়োজনীয় তথ্য প্রক্রিয়া করতে পারে। MixStil ব্যক্তিগত তথ্য বিক্রি করে না।'], ['রক্ষণ ও নিয়ন্ত্রণ', 'আপনি প্রোফাইলে স্পষ্ট সাউন্ড পছন্দ বদলাতে পারেন। অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত বা নিরাপত্তা ও আইনি কারণে ডেটা রাখা হয়।'], ['অ্যাকাউন্ট মুছে ফেলা', 'প্রোফাইলে অ্যাকাউন্ট মুছে ফেলার ব্যবস্থা আছে। নিশ্চিতকরণের পর অ্যাকাউন্ট, সেশন, পছন্দ স্মৃতি, সংরক্ষিত সাউন্ড ও ইতিহাস মুছে যায়।'], ['শিশু ও স্বাস্থ্য তথ্য', 'MixStil 13 বছরের কম শিশুদের জন্য নয় এবং চিকিৎসা সেবা নয়। মেডিকেল রেকর্ড বা জরুরি তথ্য দেবেন না।']] },
  pt: { back: 'Voltar', title: 'Privacidade', effective: 'Em vigor em 14 de julho de 2026', sections: [['Dados que o MixStil usa', 'O MixStil armazena dados de conta, pedidos de som, preferências e exclusões explícitas, receitas salvas, histórico de escuta, eventos de confiabilidade e diagnósticos básicos necessários para oferecer e melhorar o serviço.'], ['Como os dados são usados', 'Os dados são usados para gerar e repetir soundscapes, lembrar escolhas salvas, manter segurança, diagnosticar falhas e entender a confiabilidade agregada. O MixStil não usa preferências sonoras para diagnóstico médico ou decisões de tratamento.'], ['Provedores de serviço', 'Provedores de infraestrutura, IA, armazenamento e entrega processam somente as informações necessárias. O MixStil não vende informações pessoais.'], ['Retenção e controle', 'Você pode alterar preferências explícitas no Perfil. Sons salvos e dados de conta são mantidos enquanto a conta está ativa ou por obrigações legais e de segurança.'], ['Exclusão da conta', 'O Perfil inclui excluir conta. Após login e confirmação, conta, sessões, memória de preferências, sons salvos, histórico e arquivos gerados são removidos.'], ['Crianças e informações de saúde', 'O MixStil não é direcionado a menores de 13 anos e não é serviço médico. Não envie registros médicos ou informações de emergência.']] },
  ru: { back: 'Назад', title: 'Конфиденциальность', effective: 'Действует с 14 июля 2026 г.', sections: [['Данные, которые использует MixStil', 'MixStil хранит данные аккаунта, звуковые запросы, явные предпочтения и исключения, сохраненные рецепты, историю прослушивания, события надежности воспроизведения и базовую диагностику устройства или приложения.'], ['Как используются данные', 'Данные используются для создания и повторного воспроизведения звуков, запоминания сохраненных выборов, безопасности аккаунта, диагностики сбоев и понимания общей надежности. MixStil не использует звуковые предпочтения для медицинской диагностики или лечения.'], ['Поставщики услуг', 'Поставщики инфраструктуры, AI, хранения и доставки обрабатывают только информацию, необходимую для работы их части сервиса. MixStil не продает персональные данные.'], ['Хранение и контроль', 'Вы можете менять явные предпочтения в профиле. Сохраненные звуки и данные аккаунта хранятся, пока аккаунт активен, или по требованиям безопасности и закона.'], ['Удаление аккаунта', 'В профиле есть удаление аккаунта. После входа и подтверждения удаляются аккаунт, сессии, память предпочтений, сохраненные звуки, история и созданные файлы.'], ['Дети и медицинская информация', 'MixStil не предназначен для детей младше 13 лет и не является медицинской услугой. Не отправляйте медицинские записи или экстренную информацию.']] },
  ja: { back: '戻る', title: 'プライバシー', effective: '2026年7月14日より有効', sections: [['MixStil が使用するデータ', 'MixStil はアカウント情報、音のリクエスト、明示的な好みと除外、保存済みレシピ、再生履歴、再生信頼性イベント、サービス提供と改善に必要な基本的な端末またはアプリ診断を保存します。'], ['データの使い方', 'データはサウンドスケープの生成と再生、保存した選択の記憶、アカウント保護、再生失敗の診断、全体的な信頼性の把握に使われます。MixStil は音の好みを医療診断や治療判断に使いません。'], ['サービス提供者', 'インフラ、AI 処理、保存、配信の提供者は、担当部分の運用に必要な情報のみ処理します。MixStil は個人情報を販売しません。'], ['保持と管理', '明示的な音の好みはプロフィールで変更できます。保存済みサウンドとアカウントデータは、アカウントが有効な間、または安全と法的義務に必要な範囲で保持されます。'], ['アカウント削除', 'プロフィールからアカウントを削除できます。ログインして明示的に確認すると、アカウント、認証セッション、好みの記憶、保存済みサウンド、再生履歴、生成ファイルが削除されます。'], ['子どもと健康情報', 'MixStil は13歳未満の子ども向けではなく、医療サービスでもありません。医療記録や緊急情報を送信しないでください。']] },
  id: { back: 'Kembali', title: 'Privasi', effective: 'Berlaku 14 Juli 2026', sections: [['Data yang digunakan MixStil', 'MixStil menyimpan detail akun, permintaan suara, preferensi dan pengecualian eksplisit, resep suara tersimpan, riwayat mendengar, peristiwa keandalan pemutaran, serta diagnostik dasar yang diperlukan untuk menyediakan dan meningkatkan layanan.'], ['Cara data digunakan', 'Data digunakan untuk membuat dan memutar ulang soundscape, mengingat pilihan yang kamu simpan, menjaga keamanan akun, mendiagnosis kegagalan pemutaran, dan memahami keandalan produk secara agregat. MixStil tidak memakai preferensi suara untuk diagnosis medis atau keputusan perawatan.'], ['Penyedia layanan', 'Penyedia infrastruktur, AI, penyimpanan, dan pengiriman hanya memproses informasi yang dibutuhkan untuk menjalankan bagian layanan mereka. MixStil tidak menjual informasi pribadi.'], ['Retensi dan kontrol', 'Kamu dapat mengubah preferensi suara eksplisit di Profil. Suara tersimpan dan data akun disimpan selama akun aktif atau sesuai kewajiban keamanan dan hukum.'], ['Penghapusan akun', 'Profil menyertakan hapus akun. Setelah masuk dan konfirmasi, akun, sesi, memori preferensi, suara tersimpan, riwayat, dan file hasil dibuat akan dihapus.'], ['Anak dan informasi kesehatan', 'MixStil tidak ditujukan untuk anak di bawah 13 tahun dan bukan layanan medis. Jangan kirim rekam medis atau informasi darurat.']] },
} as const;

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const copy = (privacyCopy as unknown as Record<string, typeof privacyCopy.en>)[locale] ?? privacyCopy.en;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px var(--space-6) 72px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button type="button" className="btn-icon" onClick={() => navigate(-1)} aria-label={copy.back}><ArrowLeft size={22} /></button>
          <div>
            <h1 style={{ fontSize: 26 }}>{copy.title}</h1>
            <p className="text-xs text-secondary">{copy.effective}</p>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 26, lineHeight: 1.6 }}>
          {copy.sections.map(([heading, body]: readonly [string, string]) => (
            <section key={heading}>
              <h2 style={{ fontSize: 18, marginBottom: 7 }}>{heading}</h2>
              <p className="text-sm text-secondary">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
