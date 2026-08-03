import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Check, Copy, Heart, Loader2, LockKeyhole, MessageCircle, MoonStar, Music2, Pause, Play, Send, Share2, Sparkles, X } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';
import { api } from '../lib/api';
import type { AttributionCredit, ShareLink } from '../lib/domain';
import { copyText, shareOrCopy, type ShareOutcome } from '../lib/share';
import PaywallModal from '../components/PaywallModal';
import { useI18n } from '../lib/i18n';

type SharePayload = {
  title: string;
  url: string;
  coverImageUrl: string;
};

type SharePlatform = {
  id: string;
  label: string;
  mark: string;
  color: string;
  markColor?: string;
  buildUrl: (payload: SharePayload) => string;
  copiesLink?: boolean;
};

type PrivateAccessError = {
  code: 'private_share_login_required' | 'private_share_already_claimed';
  message: string;
  preview?: {
    title: string;
    creatorName: string;
    coverImageUrl: string;
  };
};

const directSharePlatforms: SharePlatform[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    mark: 'YT',
    color: '#FF0033',
    buildUrl: () => 'https://www.youtube.com/upload',
    copiesLink: true,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    mark: 'f',
    color: '#1877F2',
    buildUrl: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    mark: 'IG',
    color: '#D62976',
    buildUrl: () => 'https://www.instagram.com/',
    copiesLink: true,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    mark: 'TT',
    color: '#111111',
    buildUrl: () => 'https://www.tiktok.com/upload',
    copiesLink: true,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    mark: 'P',
    color: '#E60023',
    buildUrl: ({ title, url, coverImageUrl }) => `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(coverImageUrl)}&description=${encodeURIComponent(title)}`,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    mark: 'wa',
    color: '#25D366',
    buildUrl: ({ title, url }) => `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    mark: 'r',
    color: '#FF4500',
    buildUrl: ({ title, url }) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'x',
    label: 'X',
    mark: 'X',
    color: '#F4F4F4',
    markColor: '#111111',
    buildUrl: ({ title, url }) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    mark: 'tg',
    color: '#229ED9',
    buildUrl: ({ title, url }) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
];

const sharedWorkCopy = {
  zh: { unavailable: '这个声音暂时不可用', couldNotContinue: '暂时无法继续。', couldNotCopy: '无法复制链接。', couldNotShare: '无法分享链接。', shared: '已分享。', copied: '链接已复制。', copiedOpened: '链接已复制，已打开 {platform}。', opened: '已打开 {platform}。', openedCopyFailed: '已打开 {platform}，但无法复制链接。', register: '注册', login: '登录', name: '姓名', email: '邮箱', password: '密码（8 个以上字符）', registerListen: '注册并收听', loginListen: '登录并收听', back: '返回', privateLink: '这是一个私密链接', claimedBody: '你无法查看这个声音。这个单人链接已经被领取。', exploreOther: '探索其他声音', recipientLogin: '我是接收者，登录', privateWaiting: '有一个私密声音正在等待', waitingBody: '登录或注册后即可收听。第一个继续的账号会领取这个单人链接。', closePreview: '关闭预览并返回我的声音', backToStudio: '返回我的声音', by: '由', play: '播放', pause: '暂停', createYours: '创建我的版本', saved: '已保存', saveSound: '保存声音', share: '分享', madeWith: 'Made with MixStil', audioCredits: '音频署名', source: '来源', license: '许可证', shareWork: '分享声音', shareTo: '分享到', closeShare: '关闭分享选项', more: '更多', copyLink: '复制链接' },
  en: { unavailable: 'This sound is unavailable', couldNotContinue: 'Could not continue.', couldNotCopy: 'Could not copy this link.', couldNotShare: 'Could not share this link.', shared: 'Shared.', copied: 'Link copied.', copiedOpened: 'Link copied. Opened {platform}.', opened: 'Opened {platform}.', openedCopyFailed: 'Opened {platform}, but could not copy the link.', register: 'Register', login: 'Log in', name: 'Name', email: 'Email', password: 'Password (8+ characters)', registerListen: 'Register and listen', loginListen: 'Log in and listen', back: 'Back', privateLink: 'This is a private link', claimedBody: 'You cannot view this sound. This one-person link has already been claimed.', exploreOther: 'Explore other works', recipientLogin: 'Already the recipient? Log in', privateWaiting: 'A private sound is waiting', waitingBody: 'Log in or register to listen. The first account that continues will claim this one-person link.', closePreview: 'Close preview and return to Studio', backToStudio: 'Back to Studio', by: 'by', play: 'Play', pause: 'Pause', createYours: 'Create yours', saved: 'Saved', saveSound: 'Save sound', share: 'Share', madeWith: 'Made with MixStil', audioCredits: 'Audio credits', source: 'Source', license: 'License', shareWork: 'Share work', shareTo: 'Share to', closeShare: 'Close share options', more: 'More', copyLink: 'Copy link' },
  hi: { unavailable: 'यह साउंड उपलब्ध नहीं है', couldNotContinue: 'आगे नहीं बढ़ सके।', couldNotCopy: 'लिंक कॉपी नहीं हुआ।', couldNotShare: 'लिंक शेयर नहीं हुआ।', shared: 'शेयर हुआ।', copied: 'लिंक कॉपी हुआ।', copiedOpened: 'लिंक कॉपी हुआ। {platform} खुला।', opened: '{platform} खुला।', openedCopyFailed: '{platform} खुला, लेकिन लिंक कॉपी नहीं हुआ।', register: 'रजिस्टर', login: 'लॉग इन', name: 'नाम', email: 'ईमेल', password: 'पासवर्ड (8+ अक्षर)', registerListen: 'रजिस्टर कर सुनें', loginListen: 'लॉग इन कर सुनें', back: 'वापस', privateLink: 'यह निजी लिंक है', claimedBody: 'आप यह साउंड नहीं देख सकते। यह एक-व्यक्ति लिंक पहले ही क्लेम हो चुका है।', exploreOther: 'अन्य साउंड देखें', recipientLogin: 'आप प्राप्तकर्ता हैं? लॉग इन करें', privateWaiting: 'एक निजी साउंड आपका इंतजार कर रहा है', waitingBody: 'सुनने के लिए लॉग इन या रजिस्टर करें। पहला जारी रखने वाला खाता यह लिंक क्लेम करेगा।', closePreview: 'प्रीव्यू बंद कर My Sounds पर लौटें', backToStudio: 'My Sounds पर लौटें', by: 'द्वारा', play: 'चलाएं', pause: 'रोकें', createYours: 'अपना बनाएं', saved: 'सहेजा गया', saveSound: 'साउंड सहेजें', share: 'शेयर', madeWith: 'MixStil से बनाया गया', audioCredits: 'ऑडियो क्रेडिट', source: 'स्रोत', license: 'लाइसेंस', shareWork: 'साउंड शेयर करें', shareTo: 'यहां शेयर करें', closeShare: 'शेयर विकल्प बंद करें', more: 'और', copyLink: 'लिंक कॉपी करें' },
  es: { unavailable: 'Este sonido no está disponible', couldNotContinue: 'No se pudo continuar.', couldNotCopy: 'No se pudo copiar este enlace.', couldNotShare: 'No se pudo compartir este enlace.', shared: 'Compartido.', copied: 'Enlace copiado.', copiedOpened: 'Enlace copiado. Se abrió {platform}.', opened: 'Se abrió {platform}.', openedCopyFailed: 'Se abrió {platform}, pero no se pudo copiar el enlace.', register: 'Registrarse', login: 'Iniciar sesión', name: 'Nombre', email: 'Correo', password: 'Contraseña (8+ caracteres)', registerListen: 'Registrarme y escuchar', loginListen: 'Entrar y escuchar', back: 'Atrás', privateLink: 'Este es un enlace privado', claimedBody: 'No puedes ver este sonido. Este enlace de una persona ya fue reclamado.', exploreOther: 'Explorar otros sonidos', recipientLogin: '¿Eres el destinatario? Entra', privateWaiting: 'Hay un sonido privado esperando', waitingBody: 'Inicia sesión o regístrate para escuchar. La primera cuenta que continúe reclamará este enlace.', closePreview: 'Cerrar vista previa y volver a Mis sonidos', backToStudio: 'Volver a Mis sonidos', by: 'por', play: 'Reproducir', pause: 'Pausar', createYours: 'Crear mi versión', saved: 'Guardado', saveSound: 'Guardar sonido', share: 'Compartir', madeWith: 'Hecho con MixStil', audioCredits: 'Créditos de audio', source: 'Fuente', license: 'Licencia', shareWork: 'Compartir sonido', shareTo: 'Compartir en', closeShare: 'Cerrar opciones', more: 'Más', copyLink: 'Copiar enlace' },
  ar: { unavailable: 'هذا الصوت غير متاح', couldNotContinue: 'تعذر المتابعة.', couldNotCopy: 'تعذر نسخ الرابط.', couldNotShare: 'تعذر مشاركة الرابط.', shared: 'تمت المشاركة.', copied: 'تم نسخ الرابط.', copiedOpened: 'تم نسخ الرابط وفتح {platform}.', opened: 'تم فتح {platform}.', openedCopyFailed: 'تم فتح {platform} لكن تعذر نسخ الرابط.', register: 'تسجيل', login: 'تسجيل الدخول', name: 'الاسم', email: 'البريد الإلكتروني', password: 'كلمة المرور (8 أحرف أو أكثر)', registerListen: 'سجل واستمع', loginListen: 'ادخل واستمع', back: 'رجوع', privateLink: 'هذا رابط خاص', claimedBody: 'لا يمكنك عرض هذا الصوت. تم استخدام هذا الرابط المخصص لشخص واحد.', exploreOther: 'استكشف أصواتاً أخرى', recipientLogin: 'هل أنت المستلم؟ سجل الدخول', privateWaiting: 'هناك صوت خاص في انتظارك', waitingBody: 'سجل الدخول أو أنشئ حساباً للاستماع. أول حساب يتابع سيحصل على هذا الرابط.', closePreview: 'إغلاق المعاينة والعودة إلى أصواتي', backToStudio: 'العودة إلى أصواتي', by: 'بواسطة', play: 'تشغيل', pause: 'إيقاف مؤقت', createYours: 'أنشئ نسختك', saved: 'محفوظ', saveSound: 'حفظ الصوت', share: 'مشاركة', madeWith: 'صنع باستخدام MixStil', audioCredits: 'اعتمادات الصوت', source: 'المصدر', license: 'الترخيص', shareWork: 'مشاركة الصوت', shareTo: 'مشاركة إلى', closeShare: 'إغلاق خيارات المشاركة', more: 'المزيد', copyLink: 'نسخ الرابط' },
  bn: { unavailable: 'এই সাউন্ডটি উপলভ্য নয়', couldNotContinue: 'চালিয়ে যাওয়া যায়নি।', couldNotCopy: 'লিংক কপি করা যায়নি।', couldNotShare: 'লিংক শেয়ার করা যায়নি।', shared: 'শেয়ার হয়েছে।', copied: 'লিংক কপি হয়েছে।', copiedOpened: 'লিংক কপি হয়েছে। {platform} খোলা হয়েছে।', opened: '{platform} খোলা হয়েছে।', openedCopyFailed: '{platform} খোলা হয়েছে, কিন্তু লিংক কপি হয়নি।', register: 'রেজিস্টার', login: 'লগ ইন', name: 'নাম', email: 'ইমেল', password: 'পাসওয়ার্ড (৮+ অক্ষর)', registerListen: 'রেজিস্টার করে শুনুন', loginListen: 'লগ ইন করে শুনুন', back: 'ফিরুন', privateLink: 'এটি একটি ব্যক্তিগত লিংক', claimedBody: 'আপনি এই সাউন্ড দেখতে পারবেন না। এক-ব্যক্তির লিংকটি ইতিমধ্যে নেওয়া হয়েছে।', exploreOther: 'অন্যান্য সাউন্ড দেখুন', recipientLogin: 'আপনি প্রাপক? লগ ইন করুন', privateWaiting: 'একটি ব্যক্তিগত সাউন্ড অপেক্ষা করছে', waitingBody: 'শোনার জন্য লগ ইন বা রেজিস্টার করুন। প্রথম যে অ্যাকাউন্ট চালিয়ে যাবে, সে এই লিংক পাবে।', closePreview: 'প্রিভিউ বন্ধ করে My Sounds-এ ফিরুন', backToStudio: 'My Sounds-এ ফিরুন', by: 'দ্বারা', play: 'চালান', pause: 'বিরতি', createYours: 'নিজের সংস্করণ বানান', saved: 'সংরক্ষিত', saveSound: 'সাউন্ড সংরক্ষণ', share: 'শেয়ার', madeWith: 'MixStil দিয়ে তৈরি', audioCredits: 'অডিও ক্রেডিট', source: 'উৎস', license: 'লাইসেন্স', shareWork: 'সাউন্ড শেয়ার', shareTo: 'শেয়ার করুন', closeShare: 'শেয়ার অপশন বন্ধ করুন', more: 'আরও', copyLink: 'লিংক কপি' },
  pt: { unavailable: 'Este som não está disponível', couldNotContinue: 'Não foi possível continuar.', couldNotCopy: 'Não foi possível copiar este link.', couldNotShare: 'Não foi possível compartilhar este link.', shared: 'Compartilhado.', copied: 'Link copiado.', copiedOpened: 'Link copiado. {platform} aberto.', opened: '{platform} aberto.', openedCopyFailed: '{platform} aberto, mas não foi possível copiar o link.', register: 'Cadastrar', login: 'Entrar', name: 'Nome', email: 'Email', password: 'Senha (8+ caracteres)', registerListen: 'Cadastrar e ouvir', loginListen: 'Entrar e ouvir', back: 'Voltar', privateLink: 'Este é um link privado', claimedBody: 'Você não pode ver este som. Este link de uma pessoa já foi reivindicado.', exploreOther: 'Explorar outros sons', recipientLogin: 'Já é o destinatário? Entrar', privateWaiting: 'Um som privado está esperando', waitingBody: 'Entre ou cadastre-se para ouvir. A primeira conta que continuar reivindica este link.', closePreview: 'Fechar prévia e voltar para Meus sons', backToStudio: 'Voltar para Meus sons', by: 'por', play: 'Tocar', pause: 'Pausar', createYours: 'Criar minha versão', saved: 'Salvo', saveSound: 'Salvar som', share: 'Compartilhar', madeWith: 'Feito com MixStil', audioCredits: 'Créditos de áudio', source: 'Fonte', license: 'Licença', shareWork: 'Compartilhar som', shareTo: 'Compartilhar em', closeShare: 'Fechar opções', more: 'Mais', copyLink: 'Copiar link' },
  ru: { unavailable: 'Этот звук недоступен', couldNotContinue: 'Не удалось продолжить.', couldNotCopy: 'Не удалось скопировать ссылку.', couldNotShare: 'Не удалось поделиться ссылкой.', shared: 'Отправлено.', copied: 'Ссылка скопирована.', copiedOpened: 'Ссылка скопирована. Открыт {platform}.', opened: 'Открыт {platform}.', openedCopyFailed: 'Открыт {platform}, но ссылку скопировать не удалось.', register: 'Регистрация', login: 'Войти', name: 'Имя', email: 'Email', password: 'Пароль (8+ символов)', registerListen: 'Зарегистрироваться и слушать', loginListen: 'Войти и слушать', back: 'Назад', privateLink: 'Это приватная ссылка', claimedBody: 'Вы не можете открыть этот звук. Эта ссылка для одного человека уже использована.', exploreOther: 'Посмотреть другие звуки', recipientLogin: 'Вы получатель? Войдите', privateWaiting: 'Вас ждет приватный звук', waitingBody: 'Войдите или зарегистрируйтесь, чтобы слушать. Первый продолживший аккаунт получит эту ссылку.', closePreview: 'Закрыть предпросмотр и вернуться в Мои звуки', backToStudio: 'Вернуться в Мои звуки', by: 'от', play: 'Воспроизвести', pause: 'Пауза', createYours: 'Создать свою версию', saved: 'Сохранено', saveSound: 'Сохранить звук', share: 'Поделиться', madeWith: 'Создано в MixStil', audioCredits: 'Авторы аудио', source: 'Источник', license: 'Лицензия', shareWork: 'Поделиться звуком', shareTo: 'Поделиться в', closeShare: 'Закрыть варианты', more: 'Еще', copyLink: 'Копировать ссылку' },
  ja: { unavailable: 'このサウンドは利用できません', couldNotContinue: '続行できませんでした。', couldNotCopy: 'リンクをコピーできませんでした。', couldNotShare: 'リンクを共有できませんでした。', shared: '共有しました。', copied: 'リンクをコピーしました。', copiedOpened: 'リンクをコピーし、{platform} を開きました。', opened: '{platform} を開きました。', openedCopyFailed: '{platform} を開きましたが、リンクをコピーできませんでした。', register: '登録', login: 'ログイン', name: '名前', email: 'メール', password: 'パスワード（8文字以上）', registerListen: '登録して聴く', loginListen: 'ログインして聴く', back: '戻る', privateLink: 'これはプライベートリンクです', claimedBody: 'このサウンドは表示できません。この1人用リンクはすでに使用されています。', exploreOther: '他のサウンドを見る', recipientLogin: '受信者ですか？ログイン', privateWaiting: 'プライベートサウンドが待っています', waitingBody: '聴くにはログインまたは登録してください。最初に続行したアカウントがこのリンクを受け取ります。', closePreview: 'プレビューを閉じてマイサウンドへ戻る', backToStudio: 'マイサウンドへ戻る', by: '作成者', play: '再生', pause: '一時停止', createYours: '自分用に作成', saved: '保存済み', saveSound: 'サウンドを保存', share: '共有', madeWith: 'MixStil で作成', audioCredits: '音声クレジット', source: '出典', license: 'ライセンス', shareWork: 'サウンドを共有', shareTo: '共有先', closeShare: '共有オプションを閉じる', more: 'その他', copyLink: 'リンクをコピー' },
  id: { unavailable: 'Suara ini tidak tersedia', couldNotContinue: 'Tidak dapat melanjutkan.', couldNotCopy: 'Tidak dapat menyalin tautan ini.', couldNotShare: 'Tidak dapat membagikan tautan ini.', shared: 'Dibagikan.', copied: 'Tautan disalin.', copiedOpened: 'Tautan disalin. {platform} dibuka.', opened: '{platform} dibuka.', openedCopyFailed: '{platform} dibuka, tetapi tautan tidak dapat disalin.', register: 'Daftar', login: 'Masuk', name: 'Nama', email: 'Email', password: 'Kata sandi (8+ karakter)', registerListen: 'Daftar dan dengar', loginListen: 'Masuk dan dengar', back: 'Kembali', privateLink: 'Ini tautan pribadi', claimedBody: 'Kamu tidak dapat melihat suara ini. Tautan satu orang ini sudah diklaim.', exploreOther: 'Jelajahi suara lain', recipientLogin: 'Sudah penerima? Masuk', privateWaiting: 'Ada suara pribadi menunggu', waitingBody: 'Masuk atau daftar untuk mendengar. Akun pertama yang melanjutkan akan mengklaim tautan ini.', closePreview: 'Tutup pratinjau dan kembali ke Suaraku', backToStudio: 'Kembali ke Suaraku', by: 'oleh', play: 'Putar', pause: 'Jeda', createYours: 'Buat versiku', saved: 'Tersimpan', saveSound: 'Simpan suara', share: 'Bagikan', madeWith: 'Dibuat dengan MixStil', audioCredits: 'Kredit audio', source: 'Sumber', license: 'Lisensi', shareWork: 'Bagikan suara', shareTo: 'Bagikan ke', closeShare: 'Tutup opsi berbagi', more: 'Lainnya', copyLink: 'Salin tautan' },
} as const;

const avatarAssets = ['aurora', 'moon', 'sage', 'dusk'];

const hashText = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const getCreatorAvatarUrl = (creatorName: string) => {
  const avatar = avatarAssets[hashText(creatorName || 'MixStil Creator') % avatarAssets.length];
  return `/share-visuals/avatar-${avatar}.jpg`;
};

const getDefaultSceneKey = (share: ShareLink) => {
  const source = `${share.title} ${share.description} ${share.soundElements.join(' ')}`.toLowerCase();
  if (/sleep|night|bed|dream|insomnia|入眠|睡|夜|梦/.test(source)) return 'sleep';
  if (/focus|work|study|write|concentrate|专注|集中|学习|工作|写作/.test(source)) return 'focus';
  if (/calm|meditat|breath|relax|静心|冥想|呼吸|放松/.test(source)) return 'calm';
  return 'quiet';
};

const getDefaultSceneImageUrl = (share: ShareLink) => `/share-visuals/scene-${getDefaultSceneKey(share)}.jpg`;

const getVisitorId = () => {
  const stored = localStorage.getItem('snooze_share_visitor_id');
  if (stored) return stored;
  const value = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('snooze_share_visitor_id', value);
  return value;
};

const getReferrerSource = () => {
  if (!document.referrer) return 'direct';
  try {
    return new URL(document.referrer).hostname || 'direct';
  } catch {
    return 'unknown';
  }
};

const SharedWorkPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { locale, formatMinutes } = useI18n();
  const copy = (sharedWorkCopy as unknown as Record<string, typeof sharedWorkCopy.en>)[locale] ?? sharedWorkCopy.en;
  const copyWithPlatform = (template: string, platform: string) => template.replace('{platform}', platform);
  const { isPlaying, playbackError, preparePlayback, togglePlay, loadCustomTracks, stopAll } = useAudioMixer();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [attributionCredits, setAttributionCredits] = useState<AttributionCredit[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [playbackMaxSeconds, setPlaybackMaxSeconds] = useState<number | null>(null);
  const [isPreviewPlayback, setIsPreviewPlayback] = useState(false);
  const [error, setError] = useState('');
  const [privateAccessError, setPrivateAccessError] = useState<PrivateAccessError | null>(null);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authOpen, setAuthOpen] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [meaningfulListened, setMeaningfulListened] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const startedAtRef = useRef(Date.now());
  const requestedRef = useRef(false);
  const startedRef = useRef(false);
  const meaningfulRef = useRef(false);
  const visitorIdRef = useRef(getVisitorId());
  const creatorPreviewTokenRef = useRef(new URLSearchParams(window.location.search).get('creatorPreviewToken') ?? '');
  const canonicalShareUrl = slug ? `${window.location.origin}/s/${slug}` : window.location.href;

  const record = useCallback((eventType: Parameters<typeof api.recordShareEvent>[1]['eventType'], details?: Record<string, unknown>, playbackSeconds = 0) => {
    if (!slug) return;
    api.recordShareEvent(slug, {
      eventType,
      visitorId: visitorIdRef.current,
      source: getReferrerSource(),
      elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
      playbackSeconds,
      details,
    }, creatorPreviewTokenRef.current).catch((eventError) => console.warn('Could not record share event:', eventError));
  }, [slug]);

  const loadShare = useCallback(() => {
    if (!slug) return;
    setError('');
    setPrivateAccessError(null);
    return api.getShareLink(slug, creatorPreviewTokenRef.current)
      .then((result) => {
        setShare(result.shareLink);
        setAttributionCredits(result.attributionCredits ?? []);
        setCoverFailed(false);
        setDurationSeconds(result.durationSeconds);
        setPlaybackMaxSeconds(result.playbackPolicy?.maxSessionSeconds ?? null);
        setIsPreviewPlayback(Boolean(result.playbackPolicy?.isPreview));
        loadCustomTracks(result.tracks);
        record('share_page_opened', { intent: result.shareLink.intent });
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('share') === '1') {
          setSharePanelOpen(true);
        }
        if (searchParams.has('share') || searchParams.has('creatorPreviewToken')) {
          window.history.replaceState(window.history.state, '', `/s/${slug}`);
        }
        return true;
      })
      .catch((requestError) => {
        const typedError = requestError as Error & { payload?: { code?: string; preview?: PrivateAccessError['preview'] }; status?: number };
        if (typedError.payload?.code === 'private_share_login_required' || typedError.payload?.code === 'private_share_already_claimed') {
          setPrivateAccessError({ code: typedError.payload.code, message: typedError.message, preview: typedError.payload.preview });
          return false;
        }
        setError(typedError.message || copy.unavailable);
        return false;
      });
  }, [copy.unavailable, slug, loadCustomTracks, record]);

  useEffect(() => {
    loadShare();
    return () => stopAll();
  }, [loadShare, stopAll]);

  const submitPrivateAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      if (authMode === 'register') {
        await api.register({ username: authName, email: authEmail, password: authPassword });
      } else {
        await api.login({ email: authEmail, password: authPassword });
      }
      const granted = await loadShare();
      if (granted) setAuthOpen(false);
    } catch (requestError) {
      setAuthError(requestError instanceof Error ? requestError.message : copy.couldNotContinue);
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!isPlaying || startedRef.current) return;
    startedRef.current = true;
    record('playback_started');
  }, [isPlaying, record]);

  useEffect(() => {
    if (!isPlaying || meaningfulRef.current) return;
    const thresholdSeconds = Math.max(30, Math.min(300, Math.round(durationSeconds * 0.5)));
    const timer = window.setTimeout(() => {
      meaningfulRef.current = true;
      setMeaningfulListened(true);
      record('meaningful_listen', undefined, thresholdSeconds);
    }, thresholdSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [isPlaying, durationSeconds, record]);

  useEffect(() => {
    if (!isPreviewPlayback || !playbackMaxSeconds || !isPlaying) return;
    const timer = window.setTimeout(() => {
      stopAll();
      setShowPaywall(true);
    }, playbackMaxSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [isPreviewPlayback, playbackMaxSeconds, isPlaying, stopAll]);

  const handlePlay = () => {
    preparePlayback();
    if (!requestedRef.current) {
      requestedRef.current = true;
      record('playback_requested');
    }
    togglePlay();
  };

  const handleFavorite = async () => {
    if (!share || favorite) return;
    await api.favoriteMix(share.mixId);
    setFavorite(true);
    record('favorite_added');
  };

  const makeMyOwn = () => {
    record('create_from_share_started', { sourceMixId: share?.mixId });
    navigate('/ai-heal', { state: { sourceMixId: share?.mixId, sourceShareSlug: slug } });
  };

  const completeShare = (outcome: ShareOutcome, method: string) => {
    if (outcome === 'cancelled') return;
    setShareFeedback(outcome === 'shared' ? copy.shared : copy.copied);
    record('reshared', { method, outcome });
  };

  const copyShareLink = async (method = 'copy') => {
    if (!share) return;
    setShareBusy(true);
    setShareFeedback('');
    try {
      await copyText(canonicalShareUrl);
      completeShare('copied', method);
    } catch (shareError) {
      setShareFeedback(shareError instanceof Error ? shareError.message : copy.couldNotCopy);
    } finally {
      setShareBusy(false);
    }
  };

  const nativeShare = async () => {
    if (!share) return;
    setShareBusy(true);
    setShareFeedback('');
    try {
      const outcome = await shareOrCopy({ title: share.title, url: canonicalShareUrl });
      completeShare(outcome, outcome === 'shared' ? 'native' : 'native_fallback');
    } catch (shareError) {
      setShareFeedback(shareError instanceof Error ? shareError.message : copy.couldNotShare);
    } finally {
      setShareBusy(false);
    }
  };

  const shareToPlatform = async (platform: SharePlatform) => {
    if (!share) return;
    const coverImageUrl = new URL(getDefaultSceneImageUrl(share), window.location.origin).toString();
    const target = platform.buildUrl({ title: share.title, url: canonicalShareUrl, coverImageUrl });
    window.open(target, '_blank', 'noopener,noreferrer');
    if (platform.copiesLink) {
      try {
        await copyText(canonicalShareUrl);
        setShareFeedback(copyWithPlatform(copy.copiedOpened, platform.label));
        record('reshared', { method: platform.id, outcome: 'copied_and_opened' });
      } catch (shareError) {
        setShareFeedback(shareError instanceof Error ? shareError.message : copyWithPlatform(copy.openedCopyFailed, platform.label));
      }
      return;
    }
    setShareFeedback(copyWithPlatform(copy.opened, platform.label));
    record('reshared', { method: platform.id, outcome: 'opened' });
  };

  const renderPrivateAuthForm = (allowRegistration: boolean) => (
    <form onSubmit={submitPrivateAccess} style={{ display: 'grid', gap: 10, width: '100%' }}>
      {allowRegistration && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
          <button type="button" className="btn" onClick={() => { setAuthMode('register'); setAuthError(''); }} style={{ minHeight: 42, borderRadius: 8, background: authMode === 'register' ? '#E8F06A' : 'rgba(255,255,255,0.1)', color: authMode === 'register' ? '#17190B' : '#FFF' }}>{copy.register}</button>
          <button type="button" className="btn" onClick={() => { setAuthMode('login'); setAuthError(''); }} style={{ minHeight: 42, borderRadius: 8, background: authMode === 'login' ? '#E8F06A' : 'rgba(255,255,255,0.1)', color: authMode === 'login' ? '#17190B' : '#FFF' }}>{copy.login}</button>
        </div>
      )}
      {allowRegistration && authMode === 'register' && <input aria-label={copy.name} required value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder={copy.name} style={{ minHeight: 46, borderRadius: 8, padding: '0 12px', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.24)', color: '#FFF' }} />}
      <input aria-label={copy.email} required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder={copy.email} style={{ minHeight: 46, borderRadius: 8, padding: '0 12px', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.24)', color: '#FFF' }} />
      <input aria-label={copy.password} required minLength={8} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={copy.password} style={{ minHeight: 46, borderRadius: 8, padding: '0 12px', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.24)', color: '#FFF' }} />
      {authError && <p role="alert" style={{ color: '#FFB1B1', fontSize: 13 }}>{authError}</p>}
      <button className="btn btn-primary" disabled={authBusy} type="submit" style={{ minHeight: 48, borderRadius: 8 }}>
        {authBusy ? <Loader2 size={18} className="animate-spin" /> : null}
        {allowRegistration && authMode === 'register' ? copy.registerListen : copy.loginListen}
      </button>
      <button type="button" className="btn" onClick={() => { setAuthOpen(false); setAuthError(''); }} style={{ minHeight: 40, background: 'transparent', color: 'rgba(255,255,255,0.65)' }}>{copy.back}</button>
    </form>
  );

  if (error) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center' }}><div><MoonStar size={34} style={{ marginBottom: 14 }} /><h1 style={{ fontSize: 22, marginBottom: 8 }}>{copy.unavailable}</h1><p className="text-sm text-secondary">{error}</p></div></main>;
  }
  if (privateAccessError) {
    const alreadyClaimed = privateAccessError.code === 'private_share_already_claimed';
    const preview = privateAccessError.preview;
    return (
      <main style={{ minHeight: '100vh', position: 'relative', display: 'grid', placeItems: 'center', padding: 24, background: '#0A0A0C', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: -30, backgroundImage: preview?.coverImageUrl ? `url(${preview.coverImageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(28px) brightness(0.25)', transform: 'scale(1.08)' }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,8,0.68)', backdropFilter: 'blur(10px)' }} />
        <section style={{ position: 'relative', zIndex: 1, width: 'min(100%, 420px)', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: 'rgba(20,20,24,0.72)', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
          <LockKeyhole size={34} style={{ marginBottom: 14 }} />
          {preview?.title && <p style={{ maxWidth: '100%', marginBottom: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.title} · {preview.creatorName}</p>}
          {!authOpen && alreadyClaimed && (
            <>
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>{copy.privateLink}</h1>
              <p className="text-sm text-secondary" style={{ marginBottom: 22 }}>{copy.claimedBody}</p>
              <button className="btn btn-primary" onClick={() => navigate('/discover')} style={{ width: '100%', minHeight: 48, borderRadius: 8 }}>{copy.exploreOther}</button>
              <button className="btn" onClick={() => { setAuthMode('login'); setAuthOpen(true); setAuthError(''); }} style={{ marginTop: 10, minHeight: 40, background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{copy.recipientLogin}</button>
            </>
          )}
          {!authOpen && !alreadyClaimed && (
            <>
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>{copy.privateWaiting}</h1>
              <p className="text-sm text-secondary" style={{ marginBottom: 22 }}>{copy.waitingBody}</p>
              <button className="btn btn-primary" onClick={() => { setAuthMode('login'); setAuthOpen(true); setAuthError(''); }} style={{ width: '100%', minHeight: 48, borderRadius: 8 }}>{copy.loginListen}</button>
            </>
          )}
          {authOpen && renderPrivateAuthForm(!alreadyClaimed)}
        </section>
      </main>
    );
  }
  if (!share) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" /></main>;
  }

  const isGift = share.intent === 'gift';
  const isCreatorPreview = Boolean(creatorPreviewTokenRef.current);
  const minutes = formatMinutes(durationSeconds);
  const creatorAvatarUrl = getCreatorAvatarUrl(share.creatorName);
  const sceneImageUrl = getDefaultSceneImageUrl(share);

  return (
    <main style={{ minHeight: '100vh', position: 'relative', background: '#0A0A0C', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      
      {/* 沉浸式动态背景 */}
      <div 
        style={{ 
          position: 'absolute', inset: -40, zIndex: 0, 
          backgroundImage: `url(${sceneImageUrl})`, 
          backgroundSize: 'cover', backgroundPosition: 'center', 
          filter: 'blur(40px) brightness(0.35)', 
          transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 10s ease-out'
        }} 
      />
      
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 20px 40px' }}>
        {isCreatorPreview && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              aria-label={copy.closePreview}
              title={copy.backToStudio}
              className="btn-icon"
              onClick={() => navigate('/studio')}
              style={{ width: 42, height: 42, background: 'rgba(20,20,24,0.78)', color: '#FFF', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
            >
              <X size={20} />
            </button>
          </div>
        )}
        
        {/* 中心卡片 */}
        <div style={{ 
          background: 'rgba(255,255,255,0.06)', 
          backdropFilter: 'blur(24px)', 
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 24, 
          border: '1px solid rgba(255,255,255,0.12)', 
          padding: 24, 
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          marginBottom: 24,
          animation: 'fadeSlideUp 0.6s ease-out forwards'
        }}>
          {/* 卡片顶部：创作者与标题 */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
              <img src={creatorAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{share.title}</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{copy.by} {share.creatorName} · {minutes}</p>
            </div>
          </header>

          {/* 卡片核心：大场景图与悬浮播放按钮 */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            aspectRatio: '1 / 1', 
            borderRadius: 16, 
            overflow: 'hidden', 
            background: 'rgba(0,0,0,0.2)',
            marginBottom: 20,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)'
          }}>
            {coverFailed
              ? <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}><MoonStar size={40} color="rgba(255,255,255,0.3)" /></div>
              : <img src={sceneImageUrl} alt="" onError={() => setCoverFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: isPlaying ? 'scale(1.05)' : 'scale(1)', transition: 'transform 20s ease-out' }} />}
            
            {/* 播放按钮悬浮居中 */}
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
              <button 
                aria-label={isPlaying ? copy.pause : copy.play} 
                onClick={handlePlay} 
                style={{ 
                  width: 80, height: 80, borderRadius: '50%', border: 0, 
                  background: isGift ? 'rgba(244, 167, 185, 0.9)' : 'rgba(232, 240, 106, 0.9)', 
                  backdropFilter: 'blur(8px)',
                  color: '#15150D', cursor: 'pointer', display: 'grid', placeItems: 'center',
                  boxShadow: isPlaying ? (isGift ? '0 0 30px rgba(244,167,185,0.4)' : '0 0 30px rgba(232,240,106,0.4)') : '0 8px 16px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s ease'
                }}
              >
                {isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" style={{ marginLeft: 4 }} />}
              </button>
            </div>
            {playbackError && <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, textAlign: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 8px', color: '#FFB1B1', fontSize: 12 }}>{playbackError}</div>}
          </div>

          {/* 声音元素标签 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {share.soundElements.map((element) => (
              <span key={element} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 999, padding: '6px 12px', fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>
                {element}
              </span>
            ))}
          </div>
        </div>

        {/* 转化按钮区域 */}
        <section style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button 
            className="btn" 
            onClick={makeMyOwn} 
            style={{ 
              width: '100%', minHeight: 54, borderRadius: 12, 
              background: meaningfulListened ? 'linear-gradient(135deg, #5FC6A0, #3E9B79)' : '#5FC6A0', 
              color: '#071A13', fontSize: 16, fontWeight: 600,
              boxShadow: meaningfulListened ? '0 0 20px rgba(95, 198, 160, 0.4)' : 'none',
              transform: meaningfulListened ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.3s ease'
            }}
          >
            <Sparkles size={18} /> {copy.createYours}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: isGift && !isCreatorPreview ? '1fr' : '1fr 1fr', gap: 12 }}>
            <button className="btn" onClick={handleFavorite} style={{ minHeight: 48, borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', color: '#FFF', border: '1px solid rgba(255,255,255,0.05)' }}>
              {favorite ? <Heart size={18} fill="#F4A7B9" color="#F4A7B9" /> : <Bookmark size={18} />} {favorite ? copy.saved : copy.saveSound}
            </button>
            {(!isGift || isCreatorPreview) && (
              <button className="btn" onClick={() => { setSharePanelOpen(true); setShareFeedback(''); }} style={{ minHeight: 48, borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', color: '#FFF', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Send size={18} /> {copy.share}
              </button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {copy.madeWith}
        </footer>

        {attributionCredits.length > 0 && (
          <section aria-label={copy.audioCredits} style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.55 }}>
            <h2 style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{copy.audioCredits}</h2>
            {attributionCredits.map((credit) => (
              <p key={credit.stemId} style={{ marginBottom: 6 }}>
                {credit.attributionText}
                {' '}
                {credit.sourceUrl && <a href={credit.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>{copy.source}</a>}
                {credit.sourceUrl && credit.licenseUrl && ' · '}
                {credit.licenseUrl && <a href={credit.licenseUrl} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>{copy.license}</a>}
                {credit.adaptationNotice && (
                  <span style={{ display: 'block', marginTop: 2, color: 'rgba(255,255,255,0.34)' }}>
                    {credit.adaptationNotice}
                  </span>
                )}
              </p>
            ))}
          </section>
        )}
      </div>

      {/* Share Panel (Glassmorphism + Card) */}
      {sharePanelOpen && (!isGift || isCreatorPreview) && (
        <div role="presentation" onClick={() => setSharePanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16, animation: 'fadeIn 0.2s ease-out' }}>
          <section role="dialog" aria-modal="true" aria-label={copy.shareWork} onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 460px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, background: 'rgba(30,30,35,0.85)', backdropFilter: 'blur(24px)', padding: '24px 20px', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            {/* Share Poster Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12, marginBottom: 20 }}>
              <img src={sceneImageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{share.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{copy.by} {share.creatorName}</div>
              </div>
            </div>

            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{copy.shareTo}</h2>
              <button aria-label={copy.closeShare} className="btn-icon" onClick={() => setSharePanelOpen(false)} style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}><X size={18} /></button>
            </header>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {directSharePlatforms.map((platform) => (
                <button key={platform.id} className="btn" disabled={shareBusy} onClick={() => shareToPlatform(platform)} style={{ minHeight: 80, padding: 8, borderRadius: 16, background: 'transparent', color: 'rgba(255,255,255,0.8)', flexDirection: 'column', gap: 8, fontSize: 11, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: platform.color, color: platform.markColor ?? '#FFFFFF', fontSize: platform.mark.length > 1 ? 14 : 22, fontWeight: 800, textTransform: platform.mark.length > 1 ? 'uppercase' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    {platform.id === 'tiktok' ? <Music2 size={22} />
                      : platform.id === 'whatsapp' ? <MessageCircle size={22} strokeWidth={2.4} />
                        : platform.mark}
                  </span>
                  <span style={{ maxWidth: '100%', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{platform.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button className="btn" disabled={shareBusy} onClick={nativeShare} style={{ minHeight: 50, borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: '#FFF', fontWeight: 600 }}><Share2 size={18} /> {copy.more}</button>
              <button className="btn" disabled={shareBusy} onClick={() => copyShareLink()} style={{ minHeight: 50, borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: '#FFF', fontWeight: 600 }}><Copy size={18} /> {copy.copyLink}</button>
            </div>
            {shareFeedback && <p role="status" style={{ marginTop: 16, textAlign: 'center', color: shareFeedback.includes('Could not') || shareFeedback.includes('not available') ? '#FFB1B1' : '#9BE3B8', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={16} /> {shareFeedback}</p>}
          </section>
        </div>
      )}
      {showPaywall && <PaywallModal reason="community_preview" onClose={() => setShowPaywall(false)} />}
    </main>
  );
};

export default SharedWorkPage;
