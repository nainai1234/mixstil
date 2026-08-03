import React, { useDeferredValue, useEffect, useState } from 'react';
import { Brain, Check, Clock3, Compass, Heart, LoaderCircle, Moon, Music2, Play, Search, Sparkles, TimerReset, Trees, Volume2, VolumeX, Waves, Wind } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { api } from '../lib/api';
import type { Mix } from '../lib/domain';
import { useI18n } from '../lib/i18n';
import type { ResolvedLanguage } from '../lib/languagePreference';

type DiscoverSection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  prompt: string;
  icon: string;
  mixIds: string[];
  mixes: Mix[];
};

const iconMap = {
  brain: Brain,
  clock: Clock3,
  compass: Compass,
  moon: Moon,
  music: Music2,
  'timer-reset': TimerReset,
  trees: Trees,
  volume: Volume2,
  'volume-x': VolumeX,
  waves: Waves,
  wind: Wind,
};

type DiscoverLocalizedSection = Pick<DiscoverSection, 'eyebrow' | 'title' | 'description'>;

const discoverLocaleCopy: Partial<Record<ResolvedLanguage, {
  heroLabel: string;
  tags: string[];
  quickActions: Record<string, string>;
  sections: Record<string, DiscoverLocalizedSection>;
}>> = {
  en: {
    heroLabel: 'Start here',
    tags: ['#Deep sleep', '#Focus', '#Meditation', '#Rain', '#No voice'],
    quickActions: {
      '睡前入睡': 'Bedtime sleep',
      '夜醒回睡': 'Back to sleep',
      '深度专注': 'Deep focus',
      '安静冥想': 'Quiet meditation',
      '短时放松': 'Short reset',
      '自然声': 'Nature sound',
      '不要旋律': 'No melody',
      '不要人声': 'No voice',
    },
    sections: {
      'sleep-ready': { eyebrow: 'Sleep need', title: 'Bedtime sleep', description: 'Soft, low-event bedtime soundscapes for people who want less searching and a steady sound right away.' },
      'return-to-sleep': { eyebrow: 'Night waking', title: 'Back to sleep fast', description: 'For waking in the night: stable from the start, with no attention-grabbing details.' },
      'light-music': { eyebrow: 'Sound type', title: 'Light music, not catchy', description: 'Warm backing and sparse musical color without turning into a song.' },
      'noise-masking': { eyebrow: 'Sound type', title: 'Noise and room masking', description: 'Brown noise, air tone, cabin tone, and room beds for gentle masking without a busy scene.' },
      'quiet-nature': { eyebrow: 'Sound type', title: 'Low-event nature', description: 'Quiet nature textures that avoid sharp foregrounds and attention-grabbing motion.' },
      'asmr-texture': { eyebrow: 'Texture', title: 'Delicate texture', description: 'Soft close textures and small details, kept voice-free and non-startling.' },
      'calm-reset': { eyebrow: 'Calm need', title: 'Short relaxation reset', description: 'Five to fifteen minute soundscapes for after work, a breath of space, or a quick downshift.' },
      focus: { eyebrow: 'Work mode', title: 'Low-distraction focus', description: 'For reading, coding, studying, or masking the room without getting sleepy or distracted.' },
      minimal: { eyebrow: 'Sensitive preference', title: 'Minimal low stimulation', description: 'For sensitive listeners who are pulled away by details, melody, or movement.' },
      exclusions: { eyebrow: 'Avoidance preference', title: 'Strict no voice, simple', description: 'For listeners who care most about what must not appear: no voice, no birds, no melody.' },
    },
  },
  hi: {
    heroLabel: 'यहां से शुरू करें',
    tags: ['#गहरी नींद', '#फोकस', '#ध्यान', '#बारिश', '#बिना आवाज़'],
    quickActions: { '睡前入睡': 'सोने से पहले नींद', '夜醒回睡': 'फिर से सोना', '深度专注': 'गहरा फोकस', '安静冥想': 'शांत ध्यान', '短时放松': 'छोटा आराम', '自然声': 'प्राकृतिक ध्वनि', '不要旋律': 'धुन नहीं', '不要人声': 'आवाज़ नहीं' },
    sections: {
      'sleep-ready': { eyebrow: 'नींद की जरूरत', title: 'सोने से पहले नींद', description: 'नरम और कम-घटना वाला सोने का साउंडस्केप, ताकि खोज कम हो और स्थिर ध्वनि तुरंत मिले।' },
      'return-to-sleep': { eyebrow: 'रात में जागना', title: 'जल्दी फिर सोना', description: 'रात में जागने के बाद उपयोग के लिए, शुरुआत से ही स्थिर और ध्यान खींचने वाले विवरणों से दूर।' },
      'light-music': { eyebrow: 'ध्वनि प्रकार', title: 'हल्का संगीत, चिपकने वाला नहीं', description: 'गर्म आधार और विरल संगीत रंग, पर गीत जैसा नहीं।' },
      'noise-masking': { eyebrow: 'ध्वनि प्रकार', title: 'शोर और कमरे की आड़', description: 'ब्राउन नॉइज़, हवा, केबिन और कमरे की पृष्ठभूमि, बिना जटिल दृश्य के।' },
      'quiet-nature': { eyebrow: 'ध्वनि प्रकार', title: 'कम-घटना प्रकृति', description: 'शांत प्राकृतिक बनावट, तेज अग्रभूमि और ध्यान खींचने वाली गति से दूर।' },
      'asmr-texture': { eyebrow: 'बनावट', title: 'सूक्ष्म बनावट', description: 'नरम पास की बनावट और छोटे विवरण, बिना आवाज़ और बिना चौंकाए।' },
      'calm-reset': { eyebrow: 'शांति की जरूरत', title: 'छोटा आराम और बदलाव', description: 'काम के बाद या तुरंत धीमा होने के लिए पांच से पंद्रह मिनट के साउंडस्केप।' },
      focus: { eyebrow: 'कार्य मोड', title: 'कम-विघ्न फोकस', description: 'पढ़ने, कोडिंग, अध्ययन या कमरे की आवाज़ ढकने के लिए, बिना ज्यादा उनींदा या विचलित किए।' },
      minimal: { eyebrow: 'संवेदनशील पसंद', title: 'न्यूनतम कम उत्तेजना', description: 'उन लोगों के लिए जिन्हें विवरण, धुन या बदलाव आसानी से खींच लेते हैं।' },
      exclusions: { eyebrow: 'बचाव पसंद', title: 'कड़ाई से बिना आवाज़, सरल', description: 'उन लोगों के लिए जो सबसे ज्यादा यह चाहते हैं कि आवाज़, पक्षी या स्पष्ट धुन न आए।' },
    },
  },
  es: {
    heroLabel: 'Empieza aquí',
    tags: ['#Sueño profundo', '#Foco', '#Meditación', '#Lluvia', '#Sin voz'],
    quickActions: { '睡前入睡': 'Dormir al acostarse', '夜醒回睡': 'Volver a dormir', '深度专注': 'Foco profundo', '安静冥想': 'Meditación tranquila', '短时放松': 'Pausa breve', '自然声': 'Sonido natural', '不要旋律': 'Sin melodía', '不要人声': 'Sin voz' },
    sections: {
      'sleep-ready': { eyebrow: 'Necesidad de sueño', title: 'Dormir al acostarse', description: 'Paisajes suaves y con pocos eventos para entrar en un sonido estable sin buscar demasiado.' },
      'return-to-sleep': { eyebrow: 'Despertar nocturno', title: 'Volver a dormir rápido', description: 'Para usar al despertar de noche: estable desde el inicio y sin detalles que llamen la atención.' },
      'light-music': { eyebrow: 'Tipo de sonido', title: 'Música ligera sin enganchar', description: 'Base cálida y color musical escaso, sin convertirse en canción.' },
      'noise-masking': { eyebrow: 'Tipo de sonido', title: 'Ruido y máscara de habitación', description: 'Ruido marrón, aire, cabina y fondo de habitación para cubrir sin una escena compleja.' },
      'quiet-nature': { eyebrow: 'Tipo de sonido', title: 'Naturaleza de baja actividad', description: 'Naturaleza tranquila que evita primeros planos agudos y movimiento que distrae.' },
      'asmr-texture': { eyebrow: 'Textura', title: 'Textura delicada', description: 'Texturas cercanas y suaves, con pequeños detalles, sin voz y sin sobresaltos.' },
      'calm-reset': { eyebrow: 'Necesidad de calma', title: 'Relajación breve y cambio', description: 'Cinco a quince minutos para después del trabajo, respirar o bajar revoluciones.' },
      focus: { eyebrow: 'Modo trabajo', title: 'Foco con baja distracción', description: 'Para leer, programar, estudiar o tapar el ambiente sin dormirte ni distraerte.' },
      minimal: { eyebrow: 'Preferencia sensible', title: 'Mínimo y poco estimulante', description: 'Para oyentes sensibles a detalles, melodía o movimiento.' },
      exclusions: { eyebrow: 'Preferencia de exclusión', title: 'Simple y estrictamente sin voz', description: 'Para quien prioriza lo que no debe aparecer: sin voz, sin pájaros, sin melodía.' },
    },
  },
  ar: {
    heroLabel: 'ابدأ هنا',
    tags: ['#نوم عميق', '#تركيز', '#تأمل', '#مطر', '#بلا صوت'],
    quickActions: { '睡前入睡': 'النوم قبل السرير', '夜醒回睡': 'العودة للنوم', '深度专注': 'تركيز عميق', '安静冥想': 'تأمل هادئ', '短时放松': 'استرخاء قصير', '自然声': 'صوت طبيعي', '不要旋律': 'بلا لحن', '不要人声': 'بلا صوت بشري' },
    sections: {
      'sleep-ready': { eyebrow: 'حاجة النوم', title: 'النوم قبل السرير', description: 'مشاهد ناعمة قليلة الأحداث لمن يريد صوتاً ثابتاً بسرعة ومن دون بحث طويل.' },
      'return-to-sleep': { eyebrow: 'استيقاظ ليلي', title: 'العودة للنوم بسرعة', description: 'للاستخدام بعد الاستيقاظ ليلاً، مستقر من البداية وبلا تفاصيل تجذب الانتباه.' },
      'light-music': { eyebrow: 'نوع الصوت', title: 'موسيقى خفيفة غير عالقة', description: 'طبقة دافئة ولمسة موسيقية قليلة من دون أن تصبح أغنية.' },
      'noise-masking': { eyebrow: 'نوع الصوت', title: 'حجب الضوضاء والغرفة', description: 'ضوضاء بنية وهواء ومقصورة وخلفية غرفة لحجب لطيف بلا مشهد مزدحم.' },
      'quiet-nature': { eyebrow: 'نوع الصوت', title: 'طبيعة قليلة الأحداث', description: 'طبيعة هادئة تتجنب المقدمة الحادة والحركة التي تخطف الانتباه.' },
      'asmr-texture': { eyebrow: 'ملمس', title: 'ملمس دقيق', description: 'ملمس قريب وناعم مع تفاصيل صغيرة، بلا صوت بشري وبلا مفاجآت.' },
      'calm-reset': { eyebrow: 'حاجة الهدوء', title: 'استرخاء قصير وانتقال', description: 'خمس إلى خمس عشرة دقيقة لما بعد العمل أو مساحة تنفس أو تهدئة سريعة.' },
      focus: { eyebrow: 'وضع العمل', title: 'تركيز قليل التشتيت', description: 'للقراءة أو البرمجة أو الدراسة أو حجب الغرفة بلا نعاس أو تشتيت.' },
      minimal: { eyebrow: 'تفضيل حساس', title: 'بساطة قليلة التحفيز', description: 'لمن تجذبهم التفاصيل أو اللحن أو الحركة بسهولة.' },
      exclusions: { eyebrow: 'تفضيل الاستبعاد', title: 'بلا صوت بشري وبسيط', description: 'لمن يهتم أكثر بما لا يجب ظهوره: بلا صوت بشري، بلا طيور، بلا لحن.' },
    },
  },
  bn: {
    heroLabel: 'এখান থেকে শুরু',
    tags: ['#গভীর ঘুম', '#ফোকাস', '#ধ্যান', '#বৃষ্টি', '#কণ্ঠহীন'],
    quickActions: { '睡前入睡': 'ঘুমানোর আগে', '夜醒回睡': 'আবার ঘুম', '深度专注': 'গভীর ফোকাস', '安静冥想': 'শান্ত ধ্যান', '短时放松': 'ছোট বিশ্রাম', '自然声': 'প্রাকৃতিক শব্দ', '不要旋律': 'সুর নয়', '不要人声': 'কণ্ঠ নয়' },
    sections: {
      'sleep-ready': { eyebrow: 'ঘুমের দরকার', title: 'ঘুমানোর আগে', description: 'নরম, কম-ঘটনার ঘুমের সাউন্ডস্কেপ, যাতে কম খুঁজে দ্রুত স্থির শব্দে ঢোকা যায়।' },
      'return-to-sleep': { eyebrow: 'রাতে জাগা', title: 'দ্রুত আবার ঘুম', description: 'রাতে জেগে ওঠার পর, শুরু থেকেই স্থির এবং মনোযোগ টেনে নেওয়া বিস্তারিত ছাড়া।' },
      'light-music': { eyebrow: 'শব্দের ধরন', title: 'হালকা সঙ্গীত, মাথায় আটকে নয়', description: 'উষ্ণ ভিত্তি ও অল্প সঙ্গীতের রং, কিন্তু গান হয়ে যায় না।' },
      'noise-masking': { eyebrow: 'শব্দের ধরন', title: 'শব্দ ও ঘর ঢেকে রাখা', description: 'ব্রাউন নয়েজ, বাতাস, কেবিন ও ঘরের পটভূমি, জটিল দৃশ্য ছাড়া।' },
      'quiet-nature': { eyebrow: 'শব্দের ধরন', title: 'কম-ঘটনার প্রকৃতি', description: 'শান্ত প্রাকৃতিক টেক্সচার, তীক্ষ্ণ সামনের শব্দ ও মনোযোগ টানা গতি ছাড়া।' },
      'asmr-texture': { eyebrow: 'টেক্সচার', title: 'সূক্ষ্ম টেক্সচার', description: 'নরম কাছের টেক্সচার ও ছোট বিস্তারিত, কণ্ঠহীন এবং চমকহীন।' },
      'calm-reset': { eyebrow: 'শান্ত দরকার', title: 'ছোট বিশ্রাম ও বদল', description: 'কাজের পর, শ্বাস নেওয়ার বিরতি বা দ্রুত শান্ত হতে পাঁচ থেকে পনেরো মিনিট।' },
      focus: { eyebrow: 'কাজের মোড', title: 'কম-বিক্ষিপ্ত ফোকাস', description: 'পড়া, কোডিং, শেখা বা ঘরের শব্দ ঢাকার জন্য, খুব ঘুমঘুম বা বিভ্রান্তিকর নয়।' },
      minimal: { eyebrow: 'সংবেদনশীল পছন্দ', title: 'অতি কম উদ্দীপনা', description: 'যারা বিস্তারিত, সুর বা পরিবর্তনে সহজে মনোযোগ হারান তাদের জন্য।' },
      exclusions: { eyebrow: 'বাদ দেওয়ার পছন্দ', title: 'কড়াভাবে কণ্ঠহীন, সহজ', description: 'যারা বেশি ভাবেন কী থাকবে না: কণ্ঠ নয়, পাখি নয়, স্পষ্ট সুর নয়।' },
    },
  },
  pt: {
    heroLabel: 'Comece aqui',
    tags: ['#Sono profundo', '#Foco', '#Meditação', '#Chuva', '#Sem voz'],
    quickActions: { '睡前入睡': 'Sono ao deitar', '夜醒回睡': 'Voltar a dormir', '深度专注': 'Foco profundo', '安静冥想': 'Meditação quieta', '短时放松': 'Pausa curta', '自然声': 'Som natural', '不要旋律': 'Sem melodia', '不要人声': 'Sem voz' },
    sections: {
      'sleep-ready': { eyebrow: 'Necessidade de sono', title: 'Sono ao deitar', description: 'Soundscapes suaves e com poucos eventos para entrar rápido em um som estável.' },
      'return-to-sleep': { eyebrow: 'Acordar à noite', title: 'Voltar a dormir rápido', description: 'Para usar ao acordar de noite, estável desde o início e sem detalhes que chamam atenção.' },
      'light-music': { eyebrow: 'Tipo de som', title: 'Música leve sem grudar', description: 'Base quente e cor musical esparsa, sem virar uma canção.' },
      'noise-masking': { eyebrow: 'Tipo de som', title: 'Ruído e máscara de quarto', description: 'Ruído marrom, ar, cabine e fundo de quarto para mascarar sem cena complexa.' },
      'quiet-nature': { eyebrow: 'Tipo de som', title: 'Natureza de poucos eventos', description: 'Natureza quieta que evita primeiro plano agudo e movimento que distrai.' },
      'asmr-texture': { eyebrow: 'Textura', title: 'Textura delicada', description: 'Texturas próximas e suaves com pequenos detalhes, sem voz e sem sustos.' },
      'calm-reset': { eyebrow: 'Necessidade de calma', title: 'Relaxamento curto e troca', description: 'Cinco a quinze minutos para depois do trabalho, respirar ou desacelerar.' },
      focus: { eyebrow: 'Modo trabalho', title: 'Foco de baixa distração', description: 'Para ler, programar, estudar ou mascarar o ambiente sem dar sono nem distrair.' },
      minimal: { eyebrow: 'Preferência sensível', title: 'Mínimo e pouco estimulante', description: 'Para ouvintes sensíveis a detalhes, melodia ou movimento.' },
      exclusions: { eyebrow: 'Preferência de exclusão', title: 'Simples e sem voz', description: 'Para quem se importa mais com o que não pode aparecer: sem voz, pássaros ou melodia.' },
    },
  },
  ru: {
    heroLabel: 'Начните здесь',
    tags: ['#Глубокий сон', '#Фокус', '#Медитация', '#Дождь', '#Без голоса'],
    quickActions: { '睡前入睡': 'Сон перед сном', '夜醒回睡': 'Снова уснуть', '深度专注': 'Глубокий фокус', '安静冥想': 'Тихая медитация', '短时放松': 'Короткий отдых', '自然声': 'Звук природы', '不要旋律': 'Без мелодии', '不要人声': 'Без голоса' },
    sections: {
      'sleep-ready': { eyebrow: 'Запрос сна', title: 'Сон перед сном', description: 'Мягкие звуковые сцены с малым числом событий, чтобы быстро войти в устойчивый звук.' },
      'return-to-sleep': { eyebrow: 'Ночное пробуждение', title: 'Быстро снова уснуть', description: 'Для пробуждения ночью: устойчиво с начала и без деталей, цепляющих внимание.' },
      'light-music': { eyebrow: 'Тип звука', title: 'Легкая музыка без навязчивости', description: 'Теплая основа и редкий музыкальный оттенок, не превращающийся в песню.' },
      'noise-masking': { eyebrow: 'Тип звука', title: 'Маскировка шума и комнаты', description: 'Коричневый шум, воздух, кабина и фон комнаты для мягкой маскировки без сложной сцены.' },
      'quiet-nature': { eyebrow: 'Тип звука', title: 'Природа с малым числом событий', description: 'Тихие природные текстуры без резкого переднего плана и отвлекающего движения.' },
      'asmr-texture': { eyebrow: 'Текстура', title: 'Деликатная текстура', description: 'Мягкие близкие текстуры и мелкие детали, без голоса и внезапных событий.' },
      'calm-reset': { eyebrow: 'Запрос спокойствия', title: 'Короткое расслабление и переход', description: 'Пять-пятнадцать минут после работы, для паузы или быстрого замедления.' },
      focus: { eyebrow: 'Рабочий режим', title: 'Фокус без отвлечения', description: 'Для чтения, кода, учебы или маскировки комнаты без сонливости и отвлечения.' },
      minimal: { eyebrow: 'Чувствительные предпочтения', title: 'Минимум и низкая стимуляция', description: 'Для слушателей, которых легко отвлекают детали, мелодия или движение.' },
      exclusions: { eyebrow: 'Исключения', title: 'Строго без голоса, просто', description: 'Для тех, кому важнее всего отсутствие голоса, птиц и явной мелодии.' },
    },
  },
  ja: {
    heroLabel: 'ここから開始',
    tags: ['#深い睡眠', '#集中', '#瞑想', '#雨音', '#声なし'],
    quickActions: { '睡前入睡': '就寝前の睡眠', '夜醒回睡': '再入眠', '深度专注': '深い集中', '安静冥想': '静かな瞑想', '短时放松': '短い休息', '自然声': '自然音', '不要旋律': 'メロディなし', '不要人声': '声なし' },
    sections: {
      'sleep-ready': { eyebrow: '睡眠の目的', title: '就寝前の睡眠', description: 'やわらかく出来事の少ない就寝前サウンド。探す時間を減らして、すぐ安定した音へ。' },
      'return-to-sleep': { eyebrow: '夜中の目覚め', title: 'すばやく再入眠', description: '夜中に目が覚めた後に。最初から安定し、注意を引く細部を避けます。' },
      'light-music': { eyebrow: '音の種類', title: '軽い音楽、耳に残らない', description: '温かい下地と少ない音楽感。曲として聴こえすぎません。' },
      'noise-masking': { eyebrow: '音の種類', title: 'ノイズと部屋の遮蔽', description: 'ブラウンノイズ、空気音、室内の下地で、複雑な場面なしにやさしく遮蔽。' },
      'quiet-nature': { eyebrow: '音の種類', title: '出来事の少ない自然音', description: '鋭い前景音や注意を引く動きを避けた、静かな自然の質感。' },
      'asmr-texture': { eyebrow: '質感', title: '繊細な質感', description: '近くのやわらかな質感と小さな細部。声なし、驚きなし。' },
      'calm-reset': { eyebrow: '落ち着きの目的', title: '短いリラックスと切り替え', description: '仕事後、呼吸の余白、すばやく落ち着くための5から15分。' },
      focus: { eyebrow: '作業モード', title: '低干渉の集中', description: '読書、コーディング、学習、環境音の遮蔽に。眠くなりすぎず、邪魔しません。' },
      minimal: { eyebrow: '敏感な好み', title: '極小で低刺激', description: '細部、旋律、動きに注意を引かれやすい人向け。' },
      exclusions: { eyebrow: '除外の好み', title: '厳密に声なし、シンプル', description: '声、鳥、明確なメロディを避けたい人向け。' },
    },
  },
  id: {
    heroLabel: 'Mulai di sini',
    tags: ['#Tidur nyenyak', '#Fokus', '#Meditasi', '#Hujan', '#Tanpa suara'],
    quickActions: { '睡前入睡': 'Tidur sebelum malam', '夜醒回睡': 'Tidur lagi', '深度专注': 'Fokus mendalam', '安静冥想': 'Meditasi tenang', '短时放松': 'Rileks singkat', '自然声': 'Suara alam', '不要旋律': 'Tanpa melodi', '不要人声': 'Tanpa suara manusia' },
    sections: {
      'sleep-ready': { eyebrow: 'Kebutuhan tidur', title: 'Tidur sebelum malam', description: 'Soundscape lembut dengan sedikit kejadian agar cepat masuk ke suara yang stabil.' },
      'return-to-sleep': { eyebrow: 'Terbangun malam', title: 'Cepat tidur lagi', description: 'Untuk setelah terbangun malam: stabil sejak awal dan tanpa detail yang menarik perhatian.' },
      'light-music': { eyebrow: 'Jenis suara', title: 'Musik ringan, tidak melekat', description: 'Dasar hangat dan warna musik tipis, tanpa menjadi lagu.' },
      'noise-masking': { eyebrow: 'Jenis suara', title: 'Masking suara dan ruangan', description: 'Brown noise, udara, kabin, dan dasar ruangan untuk masking lembut tanpa adegan rumit.' },
      'quiet-nature': { eyebrow: 'Jenis suara', title: 'Alam dengan sedikit kejadian', description: 'Tekstur alam tenang yang menghindari suara tajam dan gerak yang mengganggu.' },
      'asmr-texture': { eyebrow: 'Tekstur', title: 'Tekstur halus', description: 'Tekstur dekat yang lembut dengan detail kecil, tanpa suara manusia dan tanpa kejutan.' },
      'calm-reset': { eyebrow: 'Kebutuhan tenang', title: 'Rileks singkat dan beralih', description: 'Lima sampai lima belas menit untuk setelah kerja, jeda napas, atau menurunkan tempo.' },
      focus: { eyebrow: 'Mode kerja', title: 'Fokus minim gangguan', description: 'Untuk membaca, coding, belajar, atau menutupi suara ruangan tanpa mengantuk atau terdistraksi.' },
      minimal: { eyebrow: 'Preferensi sensitif', title: 'Minimal dan rendah stimulasi', description: 'Untuk pendengar yang mudah tertarik oleh detail, melodi, atau perubahan.' },
      exclusions: { eyebrow: 'Preferensi hindari', title: 'Ketat tanpa suara, sederhana', description: 'Untuk yang paling peduli pada hal yang tidak boleh muncul: suara manusia, burung, melodi.' },
    },
  },
};

const localizeDiscoverSection = (locale: ResolvedLanguage, section: DiscoverSection, fallback: DiscoverLocalizedSection): DiscoverSection => {
  const localized = discoverLocaleCopy[locale]?.sections[section.id];
  return { ...section, ...(localized ?? fallback) };
};

const localizeDiscoverActionLabel = (locale: ResolvedLanguage, label: string, fallback: string) =>
  discoverLocaleCopy[locale]?.quickActions[label] ?? fallback;

const localizeDiscoverTags = (locale: ResolvedLanguage, fallback: string[]) =>
  discoverLocaleCopy[locale]?.tags ?? fallback;

const localizeHeroLabel = (locale: ResolvedLanguage, fallback: string) =>
  discoverLocaleCopy[locale]?.heroLabel ?? fallback;

const DiscoverPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const noMatchingSoundsLabel = t('explore.noMatch.title');
  const createThisSoundLabel = t('explore.noMatch.action');
  const [query, setQuery] = useState('');
  const [starter, setStarter] = useState<Mix | null>(null);
  const [suggestions, setSuggestions] = useState<Mix[]>([]);
  const [quickActions, setQuickActions] = useState<Array<{ label: string; prompt: string }>>([]);
  const [sections, setSections] = useState<DiscoverSection[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState('');
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().replace(/^#+/, '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getDiscoverFeed(deferredQuery)
      .then((feed) => {
        if (cancelled) return;
        setStarter(feed.editorsChoice);
        setSuggestions(feed.editorsChoice ? feed.trending.filter((mix) => mix.id !== feed.editorsChoice?.id) : feed.trending);
        setQuickActions(feed.quickActions);
        setSections(feed.sections);
        setResultCount(feed.search.total);
      })
      .catch((requestError) => {
        if (cancelled) return;
        console.warn('Failed to load Explore:', requestError);
        setStarter(null);
        setSuggestions([]);
        setQuickActions([]);
        setSections([]);
        setResultCount(0);
        setError(requestError instanceof Error ? requestError.message : t('explore.saveError'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deferredQuery, t]);

  const openPlayer = (mix: Mix) => navigate(`/player?mixId=${encodeURIComponent(mix.id)}&returnTo=/discover`, { state: { mixId: mix.id, returnTo: '/discover' } });
  const createVersion = (mix: Mix) => navigate(`/create?prompt=${encodeURIComponent(t('create.prompt.inspired', { title: mix.title }))}`);
  const createFromSearch = () => navigate(`/create?prompt=${encodeURIComponent(t('create.prompt.search', { query: normalizedQuery }))}`);
  const createFromPrompt = (prompt: string) => navigate(`/create?prompt=${encodeURIComponent(prompt)}`);
  const mixDescriptionForUi = (mix: Mix) => locale === 'en' ? mix.description : t('explore.subtitle');
  const saveStarter = async (mix: Mix) => {
    if (savingIds.has(mix.id) || savedIds.has(mix.id)) return;
    setSaveError('');
    setSavingIds((current) => new Set(current).add(mix.id));
    try {
      await api.saveMix({
        title: mix.title,
        description: mix.description,
        coverImageUrl: mix.coverImageUrl,
        status: 'private',
        recipeData: mix.recipeData,
      });
      setSavedIds((current) => new Set(current).add(mix.id));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t('explore.saveError');
      setSaveError(message);
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(mix.id);
        return next;
      });
    }
  };
  const SaveToMySoundsButton = ({ mix, compact = false }: { mix: Mix; compact?: boolean }) => {
    const isSaving = savingIds.has(mix.id);
    const isSaved = savedIds.has(mix.id);
    return (
      <button
        type="button"
        aria-label={`${isSaved ? t('explore.saved') : t('explore.save')}: ${mix.title}`}
        title={isSaved ? t('explore.saved') : t('explore.save')}
        disabled={isSaving || isSaved}
        onClick={(event) => {
          event.stopPropagation();
          void saveStarter(mix);
        }}
        style={{
          width: compact ? 36 : 42,
          height: compact ? 36 : 42,
          borderRadius: '50%',
          border: isSaved ? '1px solid rgba(255,96,128,0.58)' : '1px solid rgba(255,255,255,0.2)',
          background: isSaved ? 'rgba(255,96,128,0.2)' : 'rgba(12,12,16,0.62)',
          color: isSaved ? '#ff6b8a' : 'rgba(255,255,255,0.92)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isSaving || isSaved ? 'default' : 'pointer',
          boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {isSaving ? <LoaderCircle size={compact ? 16 : 18} className="animate-spin" /> : isSaved ? <Check size={compact ? 16 : 18} /> : <Heart size={compact ? 17 : 19} fill="currentColor" />}
      </button>
    );
  };
  const genericSectionCopy: DiscoverLocalizedSection = {
    eyebrow: t('explore.kicker'),
    title: t('explore.featured'),
    description: t('explore.subtitle'),
  };
  const visibleSections = sections
    .filter((section) => section.mixes.length > 0)
    .map((section) => localizeDiscoverSection(locale, section, genericSectionCopy));
  const visibleTags = localizeDiscoverTags(locale, [`#${t('home.need.sleep.tag')}`, `#${t('home.need.calm.tag')}`, `#${t('home.need.focus.tag')}`]);
  const visibleHeroLabel = localizeHeroLabel(locale, t('explore.kicker'));
  const fallbackActionLabels: Record<string, string> = {
    '睡前入睡': t('home.need.sleep.tag'),
    '夜醒回睡': t('home.need.sleep.tag'),
    '深度专注': t('home.need.focus.tag'),
    '安静冥想': t('home.need.calm.tag'),
    '短时放松': t('home.need.calm.tag'),
    '自然声': t('explore.featured'),
    '不要旋律': t('explore.createVersion'),
    '不要人声': t('explore.createVersion'),
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <main style={{ flex: 1, padding: '28px var(--space-6) 116px', overflowY: 'auto' }}>
        <header style={{ position: 'relative', marginBottom: 20 }}>
          <div className="ambient-glow" />
          <p className="text-sm text-secondary" style={{ marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>{t('explore.kicker')}</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, lineHeight: 1.15 }}>{t('explore.title')}</h1>
          <p className="text-sm text-secondary" style={{ fontSize: 15, maxWidth: '92%' }}>{t('explore.subtitle')}</p>
        </header>

        <label className="glass-panel" style={{ minHeight: 52, padding: '0 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, borderRadius: 'var(--radius-pill)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Search size={20} color="var(--primary)" />
          <input aria-label={t('common.search')} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('explore.search')} style={{ width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)', fontSize: 15 }} />
        </label>

        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 0 14px', marginBottom: 14, scrollbarWidth: 'none' }}>
          {quickActions.map((chip) => (
            <button key={chip.label} type="button" className="interactive-card glass-panel" onClick={() => createFromPrompt(chip.prompt)} style={{ flexShrink: 0, minHeight: 38, padding: '0 14px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: '1px solid var(--surface-border)' }}>{localizeDiscoverActionLabel(locale, chip.label, fallbackActionLabels[chip.label] ?? t('explore.createVersion'))}</button>
          ))}
          {visibleTags.map((tag) => (
            <button key={tag} type="button" className="interactive-card" onClick={() => setQuery(tag.slice(1))} aria-pressed={normalizedQuery.toLowerCase() === tag.slice(1).toLowerCase()} style={{ flexShrink: 0, minHeight: 38, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: normalizedQuery.toLowerCase() === tag.slice(1).toLowerCase() ? '1px solid var(--primary)' : '1px solid var(--surface-border)', background: normalizedQuery.toLowerCase() === tag.slice(1).toLowerCase() ? 'rgba(148,116,255,0.18)' : 'var(--surface-1)', color: normalizedQuery.toLowerCase() === tag.slice(1).toLowerCase() ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{tag}</button>
          ))}
        </div>

        {error && <p role="alert" style={{ color: '#ffd3d3', marginBottom: 16 }}>{error}</p>}
        {saveError && <p role="alert" style={{ color: '#ffd3d3', marginBottom: 16 }}>{saveError}</p>}
        {loading && <p role="status" className="text-sm text-secondary" style={{ marginBottom: 16 }}>{t('explore.loading')}</p>}

        {!normalizedQuery && starter && !loading && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t('explore.featured')}</h2>
              <span className="text-xs text-secondary" style={{ fontWeight: 600, letterSpacing: '0.05em' }}>{visibleHeroLabel.toUpperCase()}</span>
            </div>
            <div className="glass-panel interactive-card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)', position: 'relative', border: '1px solid rgba(148,116,255,0.3)' }}>
              <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
                <SaveToMySoundsButton mix={starter} />
              </div>
              <button type="button" onClick={() => openPlayer(starter)} style={{ width: '100%', minHeight: 210, padding: 20, border: 0, background: `linear-gradient(to top, rgba(6,6,9,0.96), rgba(6,6,9,0.2)), url(${starter.coverImageUrl}) center/cover`, color: 'var(--text-primary)', textAlign: 'left', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, cursor: 'pointer' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 24, marginBottom: 6, lineHeight: 1.2 }}>{starter.title}</strong>
                  <span className="text-sm text-secondary" style={{ fontSize: 14 }}>{mixDescriptionForUi(starter)}</span>
                </span>
                <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px var(--primary-glow)' }}><Play size={20} fill="white" style={{ marginLeft: 2 }} /></span>
              </button>
              <button type="button" onClick={() => createVersion(starter)} style={{ width: '100%', minHeight: 52, border: 0, borderTop: '1px solid var(--surface-border)', background: 'rgba(148,116,255,0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                <Sparkles size={18} /> {t('explore.createVersion')}
              </button>
            </div>
          </section>
        )}

        {!loading && normalizedQuery && suggestions.length === 0 && !error && (
          <section className="glass-panel" aria-label={noMatchingSoundsLabel} style={{ padding: 24, marginBottom: 22, textAlign: 'center' }}>
            <Search size={26} color="var(--text-secondary)" style={{ marginBottom: 9 }} />
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>{t('explore.noMatch.title')}</h2>
            <p className="text-sm text-secondary" style={{ marginBottom: 16 }}>{t('explore.noMatch.body', { query: normalizedQuery })}</p>
            <button type="button" className="btn btn-primary" aria-label={createThisSoundLabel} onClick={createFromSearch}><Sparkles size={17} /> {t('explore.noMatch.action')}</button>
          </section>
        )}

        {!loading && !normalizedQuery && visibleSections.map((section) => {
          const Icon = iconMap[section.icon as keyof typeof iconMap] ?? Compass;
          return (
            <section key={section.id} style={{ marginBottom: 34 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'rgba(148,116,255,0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="text-xs text-secondary" style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{section.eyebrow}</span>
                  <h2 style={{ fontSize: 20, fontWeight: 700, overflowWrap: 'anywhere' }}>{section.title}</h2>
                </span>
                <button type="button" onClick={() => createFromPrompt(section.prompt)} aria-label={`${t('explore.createVersion')}: ${section.title}`} title={t('explore.createVersion')} className="interactive-card" style={{ width: 40, height: 40, border: '1px solid rgba(148,116,255,0.3)', borderRadius: '50%', background: 'rgba(148,116,255,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Sparkles size={18} />
                </button>
              </div>
              <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>{section.description}</p>
              <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(196px, 74%)', gap: 14, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
                {section.mixes.map((item) => (
                  <article key={`${section.id}-${item.id}`} className="glass-panel interactive-card" style={{ minHeight: 190, overflow: 'hidden', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                      <SaveToMySoundsButton mix={item} compact />
                    </div>
                    <button type="button" onClick={() => openPlayer(item)} style={{ width: '100%', minHeight: 130, padding: 14, border: 0, background: `linear-gradient(to top, rgba(6,6,9,0.88), rgba(6,6,9,0.1)), url(${item.coverImageUrl}) center/cover`, color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                      <strong style={{ minWidth: 0, fontSize: 16, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</strong>
                      <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', color: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                        <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
                      </span>
                    </button>
                    <div style={{ padding: 14 }}>
                      <p className="text-xs text-secondary" style={{ minHeight: 36, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{mixDescriptionForUi(item)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {!loading && suggestions.length > 0 && <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Compass size={18} color="var(--primary)" />
            <h2 style={{ fontSize: 18 }}>{normalizedQuery ? t('explore.results', { count: resultCount, query: normalizedQuery }) : t('explore.all')}</h2>
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
            {suggestions.map((item) => (
              <div key={item.id} className="glass-panel" style={{ padding: 12, display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 38px 38px', alignItems: 'center', gap: 10, borderRadius: 8 }}>
                <button type="button" onClick={() => openPlayer(item)} aria-label={`${t('common.play')} ${item.title}`} style={{ width: 64, height: 64, border: 0, borderRadius: 8, background: `url(${item.coverImageUrl}) center/cover`, cursor: 'pointer' }} />
                <button type="button" onClick={() => openPlayer(item)} style={{ minWidth: 0, border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                  <span className="text-xs text-secondary">{t('explore.listen')}</span>
                </button>
                <SaveToMySoundsButton mix={item} compact />
                <button type="button" onClick={() => createVersion(item)} aria-label={`${t('explore.createVersion')}: ${item.title}`} title={t('explore.createVersion')} style={{ width: 38, height: 38, border: '1px solid var(--surface-border)', borderRadius: '50%', background: 'var(--surface-1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Sparkles size={17} /></button>
              </div>
            ))}
          </div>
        </section>}
      </main>
      <BottomNav activeTab="explore" />
    </div>
  );
};

export default DiscoverPage;
