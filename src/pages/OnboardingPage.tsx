import React, { useState } from 'react';
import { ArrowRight, Brain, Check, Moon, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ProductGoal } from '../lib/domain';
import { useI18n } from '../lib/i18n';
import { completeOnboarding } from '../lib/onboarding';

const goals = [
  { id: 'sleep' as const, icon: Moon },
  { id: 'calm' as const, icon: Waves },
  { id: 'focus' as const, icon: Brain },
];

const exclusions = ['water', 'music', 'voice', 'birds'] as const;
const durations = [900, 1800, 3600] as const;

const onboardingCopy = {
  zh: {
    title: '设置你的声音',
    subtitle: '选择第一个结果应该遵循的方向。',
    need: '你最需要什么？',
    avoid: '有什么要避开？',
    avoidHelp: '这些会一直被排除，直到你在“我的”里修改。',
    duration: '默认时长',
    durationLabel: '默认收听时长',
    saveError: '你的声音设置暂时无法保存。',
    saving: '正在保存...',
    continue: '继续',
    skip: '暂时跳过',
    exclusions: { water: '水声', music: '音乐', voice: '人声', birds: '鸟声' },
    prompts: {
      sleep: '帮我入睡，声音要安静、低刺激、不要突然变化。',
      calm: '帮我安定下来，声音要轻柔、开阔、不要突然变化。',
      focus: '帮我专注，声音要稳定、低干扰、不要突然变化。',
      avoid: '不要',
    },
  },
  en: {
    title: 'Set up your sound',
    subtitle: 'Choose what should guide your first result.',
    need: 'What do you need most?',
    avoid: 'Anything to avoid?',
    avoidHelp: 'These stay excluded until you change them in Profile.',
    duration: 'Default session',
    durationLabel: 'Default session duration',
    saveError: 'Your sound settings could not be saved.',
    saving: 'Saving...',
    continue: 'Continue',
    skip: 'Skip for now',
    exclusions: { water: 'Water', music: 'Music', voice: 'Voice', birds: 'Birds' },
    prompts: {
      sleep: 'Help me sleep with a quiet, low-stimulation sound and no sudden changes.',
      calm: 'Help me settle down with a gentle, spacious sound and no sudden changes.',
      focus: 'Help me focus with a steady, low-distraction sound and no sudden changes.',
      avoid: 'No',
    },
  },
  hi: {
    title: 'अपना साउंड सेट करें',
    subtitle: 'चुनें कि पहला परिणाम किससे निर्देशित हो।',
    need: 'आपको सबसे ज्यादा क्या चाहिए?',
    avoid: 'कुछ बचाना है?',
    avoidHelp: 'ये तब तक बाहर रहेंगे जब तक आप प्रोफ़ाइल में बदलें।',
    duration: 'डिफ़ॉल्ट सेशन',
    durationLabel: 'डिफ़ॉल्ट सेशन अवधि',
    saveError: 'आपकी साउंड सेटिंग सहेजी नहीं जा सकी।',
    saving: 'सहेजा जा रहा है...',
    continue: 'जारी रखें',
    skip: 'अभी छोड़ें',
    exclusions: { water: 'पानी', music: 'संगीत', voice: 'आवाज़', birds: 'पक्षी' },
    prompts: {
      sleep: 'मुझे शांत, कम-उत्तेजना वाली ध्वनि से सुलाने में मदद करें, अचानक बदलाव न हों।',
      calm: 'मुझे हल्की, खुली ध्वनि से शांत होने में मदद करें, अचानक बदलाव न हों।',
      focus: 'मुझे स्थिर, कम-विघ्न ध्वनि से फोकस करने में मदद करें, अचानक बदलाव न हों।',
      avoid: 'नहीं',
    },
  },
  es: {
    title: 'Configura tu sonido',
    subtitle: 'Elige qué debe guiar tu primer resultado.',
    need: '¿Qué necesitas más?',
    avoid: '¿Algo que evitar?',
    avoidHelp: 'Esto queda excluido hasta que lo cambies en Perfil.',
    duration: 'Sesión predeterminada',
    durationLabel: 'Duración predeterminada',
    saveError: 'No se pudieron guardar tus ajustes de sonido.',
    saving: 'Guardando...',
    continue: 'Continuar',
    skip: 'Omitir por ahora',
    exclusions: { water: 'Agua', music: 'Música', voice: 'Voz', birds: 'Pájaros' },
    prompts: {
      sleep: 'Ayúdame a dormir con un sonido tranquilo, de baja estimulación y sin cambios repentinos.',
      calm: 'Ayúdame a calmarme con un sonido suave, amplio y sin cambios repentinos.',
      focus: 'Ayúdame a concentrarme con un sonido estable, de baja distracción y sin cambios repentinos.',
      avoid: 'Sin',
    },
  },
  ar: {
    title: 'اضبط صوتك',
    subtitle: 'اختر ما يوجه النتيجة الأولى.',
    need: 'ما الذي تحتاجه أكثر؟',
    avoid: 'هل هناك ما تريد تجنبه؟',
    avoidHelp: 'تبقى هذه مستبعدة حتى تغيرها في الملف.',
    duration: 'الجلسة الافتراضية',
    durationLabel: 'مدة الجلسة الافتراضية',
    saveError: 'تعذر حفظ إعدادات الصوت.',
    saving: 'جارٍ الحفظ...',
    continue: 'متابعة',
    skip: 'تخطي الآن',
    exclusions: { water: 'ماء', music: 'موسيقى', voice: 'صوت بشري', birds: 'طيور' },
    prompts: {
      sleep: 'ساعدني على النوم بصوت هادئ ومنخفض التحفيز ومن دون تغييرات مفاجئة.',
      calm: 'ساعدني على الهدوء بصوت لطيف وواسع ومن دون تغييرات مفاجئة.',
      focus: 'ساعدني على التركيز بصوت ثابت وقليل التشتيت ومن دون تغييرات مفاجئة.',
      avoid: 'بدون',
    },
  },
  bn: {
    title: 'আপনার সাউন্ড সেট করুন',
    subtitle: 'প্রথম ফলাফল কী অনুসরণ করবে তা বেছে নিন।',
    need: 'আপনার সবচেয়ে বেশি কী দরকার?',
    avoid: 'কিছু এড়াতে চান?',
    avoidHelp: 'প্রোফাইলে পরিবর্তন না করা পর্যন্ত এগুলো বাদ থাকবে।',
    duration: 'ডিফল্ট সেশন',
    durationLabel: 'ডিফল্ট সেশনের সময়',
    saveError: 'আপনার সাউন্ড সেটিং সংরক্ষণ করা যায়নি।',
    saving: 'সংরক্ষণ হচ্ছে...',
    continue: 'চালিয়ে যান',
    skip: 'এখন এড়িয়ে যান',
    exclusions: { water: 'পানি', music: 'সঙ্গীত', voice: 'কণ্ঠ', birds: 'পাখি' },
    prompts: {
      sleep: 'শান্ত, কম-উত্তেজক এবং হঠাৎ পরিবর্তনহীন সাউন্ড দিয়ে আমাকে ঘুমাতে সাহায্য করুন।',
      calm: 'নরম, খোলা এবং হঠাৎ পরিবর্তনহীন সাউন্ড দিয়ে আমাকে শান্ত হতে সাহায্য করুন।',
      focus: 'স্থিতিশীল, কম-বিক্ষিপ্ত এবং হঠাৎ পরিবর্তনহীন সাউন্ড দিয়ে আমাকে ফোকাস করতে সাহায্য করুন।',
      avoid: 'না',
    },
  },
  pt: {
    title: 'Configure seu som',
    subtitle: 'Escolha o que deve guiar seu primeiro resultado.',
    need: 'Do que você mais precisa?',
    avoid: 'Algo a evitar?',
    avoidHelp: 'Isso fica excluído até você mudar no Perfil.',
    duration: 'Sessão padrão',
    durationLabel: 'Duração padrão da sessão',
    saveError: 'Não foi possível salvar suas configurações de som.',
    saving: 'Salvando...',
    continue: 'Continuar',
    skip: 'Pular por agora',
    exclusions: { water: 'Água', music: 'Música', voice: 'Voz', birds: 'Pássaros' },
    prompts: {
      sleep: 'Me ajude a dormir com um som calmo, de baixa estimulação e sem mudanças repentinas.',
      calm: 'Me ajude a me acalmar com um som suave, amplo e sem mudanças repentinas.',
      focus: 'Me ajude a focar com um som estável, de baixa distração e sem mudanças repentinas.',
      avoid: 'Sem',
    },
  },
  ru: {
    title: 'Настройте звук',
    subtitle: 'Выберите, что должно направлять первый результат.',
    need: 'Что нужно больше всего?',
    avoid: 'Что-то исключить?',
    avoidHelp: 'Это будет исключено, пока вы не измените в профиле.',
    duration: 'Сеанс по умолчанию',
    durationLabel: 'Длительность сеанса по умолчанию',
    saveError: 'Не удалось сохранить настройки звука.',
    saving: 'Сохранение...',
    continue: 'Продолжить',
    skip: 'Пропустить пока',
    exclusions: { water: 'Вода', music: 'Музыка', voice: 'Голос', birds: 'Птицы' },
    prompts: {
      sleep: 'Помогите мне уснуть с тихим, низкостимулирующим звуком без резких изменений.',
      calm: 'Помогите мне успокоиться с мягким, просторным звуком без резких изменений.',
      focus: 'Помогите мне сосредоточиться со стабильным, ненавязчивым звуком без резких изменений.',
      avoid: 'Без',
    },
  },
  ja: {
    title: 'サウンドを設定',
    subtitle: '最初の結果を何に合わせるか選びます。',
    need: '今いちばん必要なものは？',
    avoid: '避けたいものはありますか？',
    avoidHelp: 'プロフィールで変更するまで除外されます。',
    duration: '既定のセッション',
    durationLabel: '既定のセッション時間',
    saveError: 'サウンド設定を保存できませんでした。',
    saving: '保存中...',
    continue: '続ける',
    skip: '今はスキップ',
    exclusions: { water: '水音', music: '音楽', voice: '声', birds: '鳥の声' },
    prompts: {
      sleep: '静かで低刺激、突然の変化がない音で眠れるようにしてください。',
      calm: 'やさしく広がりがあり、突然の変化がない音で落ち着けるようにしてください。',
      focus: '安定していて低干渉、突然の変化がない音で集中できるようにしてください。',
      avoid: 'なし',
    },
  },
  id: {
    title: 'Atur suaramu',
    subtitle: 'Pilih apa yang memandu hasil pertama.',
    need: 'Apa yang paling kamu butuhkan?',
    avoid: 'Ada yang perlu dihindari?',
    avoidHelp: 'Ini tetap dikecualikan sampai kamu mengubahnya di Profil.',
    duration: 'Sesi default',
    durationLabel: 'Durasi sesi default',
    saveError: 'Pengaturan suara tidak dapat disimpan.',
    saving: 'Menyimpan...',
    continue: 'Lanjutkan',
    skip: 'Lewati dulu',
    exclusions: { water: 'Air', music: 'Musik', voice: 'Suara', birds: 'Burung' },
    prompts: {
      sleep: 'Bantu aku tidur dengan suara tenang, minim stimulasi, dan tanpa perubahan mendadak.',
      calm: 'Bantu aku tenang dengan suara lembut, lapang, dan tanpa perubahan mendadak.',
      focus: 'Bantu aku fokus dengan suara stabil, minim gangguan, dan tanpa perubahan mendadak.',
      avoid: 'Tanpa',
    },
  },
} as const;

const promptFor = (copy: typeof onboardingCopy[keyof typeof onboardingCopy], goal: ProductGoal, excludedSounds: string[]) => {
  const base = copy.prompts[goal];
  return excludedSounds.length > 0 ? `${base} ${copy.prompts.avoid} ${excludedSounds.join(', ')}.` : base;
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale, goalLabel, formatMinutes } = useI18n();
  const copy = (onboardingCopy as unknown as Record<string, typeof onboardingCopy.en>)[locale] ?? onboardingCopy.en;
  const [goal, setGoal] = useState<ProductGoal>('sleep');
  const [durationSeconds, setDurationSeconds] = useState(900);
  const [excludedSounds, setExcludedSounds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const continueToCreate = () => {
    completeOnboarding();
    const params = new URLSearchParams({
      goal,
      duration: String(durationSeconds),
      prompt: promptFor(copy, goal, excludedSounds.map((sound) => copy.exclusions[sound as keyof typeof copy.exclusions] ?? sound)),
    });
    navigate(`/create?${params.toString()}`, { replace: true });
  };

  const saveAndContinue = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.updateSoundProfile({ defaultGoal: goal, defaultDurationSeconds: durationSeconds, excludedSounds });
      continueToCreate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const toggleExclusion = (sound: string) => setExcludedSounds((current) => (
    current.includes(sound) ? current.filter((item) => item !== sound) : [...current, sound]
  ));

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-main)' }}>
      <main style={{ maxWidth: 480, minHeight: '100dvh', margin: '0 auto', padding: '48px var(--space-6) calc(28px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
        <header style={{ marginBottom: 34 }}>
          <p className="text-sm text-secondary" style={{ marginBottom: 8 }}>MixStil</p>
          <h1 style={{ fontSize: 30, marginBottom: 9 }}>{copy.title}</h1>
          <p className="text-sm text-secondary">{copy.subtitle}</p>
        </header>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{copy.need}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {goals.map(({ id, icon: Icon }) => (
              <button key={id} type="button" aria-pressed={goal === id} onClick={() => setGoal(id)} style={{ minHeight: 72, borderRadius: 8, border: goal === id ? '1px solid var(--primary)' : '1px solid var(--surface-border)', background: goal === id ? 'rgba(140,106,255,0.16)' : 'var(--surface-1)', color: 'var(--text-primary)', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 7, cursor: 'pointer' }}>
                <Icon size={20} color={goal === id ? 'var(--primary)' : 'var(--text-secondary)'} />
                <span style={{ fontSize: 13, fontWeight: 650 }}>{goalLabel(id)}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 5 }}>{copy.avoid}</h2>
          <p className="text-xs text-secondary" style={{ marginBottom: 12 }}>{copy.avoidHelp}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {exclusions.map((sound) => {
              const selected = excludedSounds.includes(sound);
              return (
                <button key={sound} type="button" aria-pressed={selected} onClick={() => toggleExclusion(sound)} style={{ height: 38, padding: '0 12px', borderRadius: 8, border: selected ? '1px solid var(--primary)' : '1px solid var(--surface-border)', background: selected ? 'rgba(140,106,255,0.16)' : 'var(--surface-1)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'capitalize', cursor: 'pointer' }}>
                  {selected && <Check size={14} />} {copy.exclusions[sound]}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{copy.duration}</h2>
          <div role="group" aria-label={copy.durationLabel} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: 3, borderRadius: 8, background: 'var(--surface-1)' }}>
            {durations.map((seconds) => (
              <button key={seconds} type="button" aria-pressed={durationSeconds === seconds} onClick={() => setDurationSeconds(seconds)} style={{ height: 38, border: 0, borderRadius: 6, background: durationSeconds === seconds ? 'var(--surface-2)' : 'transparent', color: durationSeconds === seconds ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 650, cursor: 'pointer' }}>
                {formatMinutes(seconds)}
              </button>
            ))}
          </div>
        </section>

        <div style={{ marginTop: 'auto' }}>
          {error && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button type="button" className="btn btn-primary" onClick={saveAndContinue} disabled={saving} style={{ width: '100%', minHeight: 48 }}>
            {saving ? copy.saving : copy.continue} {!saving && <ArrowRight size={17} />}
          </button>
          <button type="button" onClick={continueToCreate} disabled={saving} style={{ width: '100%', minHeight: 42, marginTop: 7, border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>{copy.skip}</button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;
