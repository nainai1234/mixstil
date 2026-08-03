import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Crown, Loader2, MoonStar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

const billingCopy = {
  zh: { back: '返回', kicker: 'MixStil PLUS', title: '把有用的声音留在身边', loading: '正在加载方案...', unavailable: 'Plus 还未开放购买。', body: '你已经听到了有用的声音。Plus 会用于更长收听、离线播放、更多保存版本，以及记住偏好的后续声音。商店计费会在播放、复听和离线闭环稳定后接入。', current: '当前', comingSoon: '即将开放', annual: '年度', monthly: '月度', year: '年', month: '月', founding: '新用户之后可能看到 {price} 的首年优惠。', continueListening: '继续收听', message: '商店计费尚未接入。当前阶段先打磨声音适配、保存、复听和离线可靠性。', features: ['超过免费创建次数后继续创建', '60、90、120 分钟收听', '不限量保存声音和版本', '离线播放', '按偏好生成稳定变体', '更完整的官方和精选收听'] },
  en: { back: 'Back', kicker: 'MixStil PLUS', title: 'Keep useful sounds close', loading: 'Loading plan...', unavailable: 'Plus is not available for purchase yet.', body: 'You have heard a useful sound. Plus will support longer sessions, offline listening, more saved versions, and future sounds that remember what fits you. Store billing comes after the listening, replay, and offline loops are stable.', current: 'Current', comingSoon: 'Coming soon', annual: 'Annual', monthly: 'Monthly', year: 'year', month: 'month', founding: 'New users may later see a first-year offer of {price}.', continueListening: 'Continue listening', message: 'Store billing is not connected yet. This phase is focused on sound fit, saving, replay, and offline reliability.', features: ['Keep creating after free creations', '60, 90, and 120 minute sessions', 'Unlimited saved sounds and versions', 'Offline playback', 'Preference-aware sound variations', 'Fuller official and curated listening'] },
  hi: { back: 'वापस', kicker: 'MixStil PLUS', title: 'उपयोगी साउंड पास रखें', loading: 'प्लान लोड हो रहा है...', unavailable: 'Plus अभी खरीदने के लिए उपलब्ध नहीं है।', body: 'आपने उपयोगी साउंड सुना है। Plus आगे लंबे सत्र, बिना इंटरनेट सुनना, अधिक सहेजे संस्करण और आपकी पसंद याद रखने वाली ध्वनियां देगा। स्टोर बिलिंग सुनने, फिर से चलाने और बिना इंटरनेट वाले अनुभव के स्थिर होने के बाद जुड़ेगी।', current: 'वर्तमान', comingSoon: 'जल्द आएगा', annual: 'वार्षिक', monthly: 'मासिक', year: 'वर्ष', month: 'माह', founding: 'नए उपयोगकर्ताओं को बाद में {price} का पहले वर्ष का ऑफर दिख सकता है।', continueListening: 'सुनना जारी रखें', message: 'स्टोर बिलिंग अभी जुड़ी नहीं है। यह चरण ध्वनि की उपयुक्तता, सहेजने, फिर से चलाने और बिना इंटरनेट विश्वसनीयता पर केंद्रित है।', features: ['मुफ्त निर्माणों के बाद भी बनाना जारी रखें', '60, 90 और 120 मिनट के सत्र', 'असीमित सहेजे साउंड और संस्करण', 'बिना इंटरनेट चलाना', 'पसंद के अनुसार ध्वनि बदलाव', 'अधिक पूर्ण आधिकारिक और चुनी हुई सुनवाई'] },
  es: { back: 'Atrás', kicker: 'MixStil PLUS', title: 'Mantén cerca los sonidos útiles', loading: 'Cargando plan...', unavailable: 'Plus aún no está disponible para comprar.', body: 'Ya escuchaste un sonido útil. Plus servirá para sesiones más largas, escucha offline, más versiones guardadas y sonidos futuros que recuerdan lo que te funciona. La facturación llega cuando escucha, repetición y offline estén estables.', current: 'Actual', comingSoon: 'Próximamente', annual: 'Anual', monthly: 'Mensual', year: 'año', month: 'mes', founding: 'Más adelante, nuevos usuarios podrían ver una oferta de primer año de {price}.', continueListening: 'Seguir escuchando', message: 'La facturación de tiendas aún no está conectada. Esta fase se centra en ajuste del sonido, guardado, repetición y offline fiable.', features: ['Seguir creando tras las creaciones gratis', 'Sesiones de 60, 90 y 120 minutos', 'Sonidos y versiones guardadas ilimitadas', 'Reproducción offline', 'Variantes según preferencias', 'Escucha oficial y curada más completa'] },
  ar: { back: 'رجوع', kicker: 'MixStil PLUS', title: 'احتفظ بالأصوات المفيدة قريباً', loading: 'جار تحميل الخطة...', unavailable: 'Plus غير متاح للشراء بعد.', body: 'لقد سمعت صوتاً مفيداً. سيدعم Plus جلسات أطول واستماعاً دون اتصال ونسخاً محفوظة أكثر وأصواتاً مستقبلية تتذكر ما يناسبك. ستأتي فوترة المتاجر بعد استقرار الاستماع والإعادة والعمل دون اتصال.', current: 'الحالي', comingSoon: 'قريباً', annual: 'سنوي', monthly: 'شهري', year: 'سنة', month: 'شهر', founding: 'قد يرى المستخدمون الجدد لاحقاً عرض السنة الأولى بقيمة {price}.', continueListening: 'متابعة الاستماع', message: 'فوترة المتاجر غير متصلة بعد. تركز هذه المرحلة على ملاءمة الصوت والحفظ والإعادة والموثوقية دون اتصال.', features: ['متابعة الإنشاء بعد المحاولات المجانية', 'جلسات 60 و90 و120 دقيقة', 'أصوات ونسخ محفوظة بلا حد', 'تشغيل دون اتصال', 'تنويعات تراعي التفضيلات', 'استماع رسمي ومنتقى أوسع'] },
  bn: { back: 'ফিরুন', kicker: 'MixStil PLUS', title: 'উপকারী সাউন্ড কাছে রাখুন', loading: 'প্ল্যান লোড হচ্ছে...', unavailable: 'Plus এখনও কেনার জন্য খোলা নয়।', body: 'আপনি একটি উপকারী সাউন্ড শুনেছেন। Plus ভবিষ্যতে দীর্ঘ সেশন, অফলাইন শোনা, আরও সংরক্ষিত সংস্করণ এবং আপনার পছন্দ মনে রাখা সাউন্ড দেবে। শোনা, রিপ্লে ও অফলাইন লুপ স্থিতিশীল হলে স্টোর বিলিং যুক্ত হবে।', current: 'বর্তমান', comingSoon: 'শীঘ্রই', annual: 'বার্ষিক', monthly: 'মাসিক', year: 'বছর', month: 'মাস', founding: 'নতুন ব্যবহারকারীরা পরে {price} প্রথম বছরের অফার দেখতে পারেন।', continueListening: 'শোনা চালিয়ে যান', message: 'স্টোর বিলিং এখনও যুক্ত নয়। এই ধাপে সাউন্ড ফিট, সংরক্ষণ, রিপ্লে ও অফলাইন নির্ভরযোগ্যতা উন্নত করা হচ্ছে।', features: ['ফ্রি ক্রিয়েশনের পরও তৈরি চালিয়ে যান', '৬০, ৯০ ও ১২০ মিনিট সেশন', 'সীমাহীন সংরক্ষিত সাউন্ড ও সংস্করণ', 'অফলাইন প্লেব্যাক', 'পছন্দভিত্তিক সাউন্ড ভেরিয়েশন', 'আরও পূর্ণ official ও curated listening'] },
  pt: { back: 'Voltar', kicker: 'MixStil PLUS', title: 'Mantenha sons úteis por perto', loading: 'Carregando plano...', unavailable: 'Plus ainda não está disponível para compra.', body: 'Você já ouviu um som útil. O Plus dará sessões mais longas, escuta offline, mais versões salvas e sons futuros que lembram o que funciona para você. A cobrança das lojas vem depois que escuta, replay e offline estiverem estáveis.', current: 'Atual', comingSoon: 'Em breve', annual: 'Anual', monthly: 'Mensal', year: 'ano', month: 'mês', founding: 'Novos usuários poderão ver depois uma oferta de primeiro ano de {price}.', continueListening: 'Continuar ouvindo', message: 'A cobrança das lojas ainda não está conectada. Esta fase foca ajuste do som, salvar, repetir e confiabilidade offline.', features: ['Continuar criando após as criações grátis', 'Sessões de 60, 90 e 120 minutos', 'Sons e versões salvas ilimitados', 'Reprodução offline', 'Variações guiadas por preferências', 'Escuta oficial e curada mais completa'] },
  ru: { back: 'Назад', kicker: 'MixStil PLUS', title: 'Держите полезные звуки рядом', loading: 'Загрузка плана...', unavailable: 'Plus пока недоступен для покупки.', body: 'Вы уже услышали полезный звук. Plus даст более длинные сессии, офлайн-прослушивание, больше сохраненных версий и будущие звуки, которые помнят ваши предпочтения. Оплата через магазины появится после стабильности прослушивания, повтора и офлайна.', current: 'Текущий', comingSoon: 'Скоро', annual: 'Годовой', monthly: 'Месячный', year: 'год', month: 'месяц', founding: 'Новые пользователи позже могут увидеть предложение первого года за {price}.', continueListening: 'Продолжить слушать', message: 'Оплата через магазины еще не подключена. Этот этап посвящен подбору звука, сохранению, повтору и надежному офлайну.', features: ['Продолжать создавать после бесплатных попыток', 'Сессии 60, 90 и 120 минут', 'Безлимитные сохраненные звуки и версии', 'Офлайн-воспроизведение', 'Варианты с учетом предпочтений', 'Больше официального и отобранного прослушивания'] },
  ja: { back: '戻る', kicker: 'MixStil PLUS', title: '役に立つ音を手元に残す', loading: 'プランを読み込み中...', unavailable: 'Plus はまだ購入できません。', body: 'すでに役に立つ音を聴いています。Plus は今後、より長いセッション、オフライン再生、保存版の追加、好みを覚えた次のサウンドを支えます。ストア課金は、再生、復帰、オフラインの流れが安定してから接続します。', current: '現在', comingSoon: '近日対応', annual: '年額', monthly: '月額', year: '年', month: '月', founding: '新規ユーザーには後日、初年度 {price} のオファーが表示される場合があります。', continueListening: '聴き続ける', message: 'ストア課金はまだ接続していません。この段階では音の適合、保存、再生復帰、オフライン信頼性を優先しています。', features: ['無料作成後も続けて作成', '60、90、120分セッション', '保存済みサウンドとバージョン無制限', 'オフライン再生', '好みに合わせたサウンド変化', 'より充実した公式・厳選リスニング'] },
  id: { back: 'Kembali', kicker: 'MixStil PLUS', title: 'Simpan suara berguna tetap dekat', loading: 'Memuat paket...', unavailable: 'Plus belum tersedia untuk dibeli.', body: 'Kamu sudah mendengar suara yang berguna. Plus akan mendukung sesi lebih panjang, mendengar offline, lebih banyak versi tersimpan, dan suara berikutnya yang mengingat preferensimu. Billing toko hadir setelah loop mendengar, replay, dan offline stabil.', current: 'Saat ini', comingSoon: 'Segera hadir', annual: 'Tahunan', monthly: 'Bulanan', year: 'tahun', month: 'bulan', founding: 'Pengguna baru nanti mungkin melihat penawaran tahun pertama {price}.', continueListening: 'Lanjut mendengar', message: 'Billing toko belum terhubung. Fase ini fokus pada kecocokan suara, penyimpanan, replay, dan keandalan offline.', features: ['Tetap membuat setelah kreasi gratis', 'Sesi 60, 90, dan 120 menit', 'Suara dan versi tersimpan tanpa batas', 'Pemutaran offline', 'Variasi suara sesuai preferensi', 'Listening resmi dan kurasi yang lebih lengkap'] },
} as const;

const BillingUpgrade: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const copy = (billingCopy as unknown as Record<string, typeof billingCopy.en>)[locale] ?? billingCopy.en;
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof api.getBilling>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getBilling()
      .then(setBilling)
      .catch(() => setMessage(copy.unavailable))
      .finally(() => setLoading(false));
  }, [copy.unavailable]);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }), [locale]);
  const annualPrice = money.format(billing?.pricing.annual ?? 59.9);
  const foundingPrice = money.format(billing?.pricing.foundingAnnual ?? 49.9);
  const monthlyPrice = money.format(billing?.pricing.monthly ?? 9.99);

  return (
    <main style={{ minHeight: '100vh', padding: '24px var(--space-6) 40px', background: 'var(--bg-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button type="button" className="btn-icon" onClick={() => navigate(-1)} aria-label={copy.back} title={copy.back}><ArrowLeft size={20} /></button>
        <div>
          <p className="text-xs text-secondary" style={{ margin: 0 }}>{copy.kicker}</p>
          <h1 style={{ fontSize: 26, margin: 2 }}>{copy.title}</h1>
        </div>
      </header>

      {loading && <p role="status" className="text-sm text-secondary"><Loader2 size={16} className="animate-spin" /> {copy.loading}</p>}
      {!loading && (
        <section className="glass-panel" style={{ maxWidth: 520, margin: '0 auto', padding: 22, border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Crown size={22} color="var(--primary)" />
            <strong style={{ fontSize: 20 }}>Plus</strong>
            <span className="text-xs text-secondary" style={{ marginLeft: 'auto' }}>{copy.current}: {billing?.plan ?? 'Free'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>
            <MoonStar size={15} /> {copy.unavailable}
          </div>
          <p className="text-sm text-secondary" style={{ lineHeight: 1.55, marginBottom: 20 }}>{copy.body}</p>

          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {copy.features.map((feature: string) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14 }}>
                <Check size={16} color="var(--primary)" /> <span>{feature}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <button
              type="button"
              className="interactive-card"
              onClick={() => setMessage(copy.message)}
              style={{
                minHeight: 76,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.15) 0%, rgba(250, 204, 21, 0.05) 100%)',
                border: '1px solid var(--gold)',
                borderRadius: '16px',
                color: '#FFFFFF',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(250, 204, 21, 0.15)',
              }}
            >
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 750 }}>{copy.annual} <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', background: 'var(--gold)', color: '#000', borderRadius: '999px', marginLeft: 8 }}>BEST VALUE</span></span>
                <strong style={{ fontSize: 18, color: 'var(--gold)' }}>{annualPrice}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>/{copy.year}</span></strong>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{copy.comingSoon}</span>
            </button>
            
            <button
              type="button"
              className="interactive-card"
              onClick={() => setMessage(copy.message)}
              style={{
                minHeight: 70,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '16px',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{copy.monthly}</span>
                <strong style={{ fontSize: 17 }}>{monthlyPrice}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>/{copy.month}</span></strong>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{copy.comingSoon}</span>
            </button>
            
            <button
              type="button"
              className="interactive-card"
              onClick={() => navigate('/sounds')}
              style={{
                minHeight: 52,
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 750,
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.5)',
              }}
            >
              {copy.continueListening}
            </button>
          </div>

          <p className="text-xs text-secondary" style={{ margin: '14px 0 0', textAlign: 'center' }}>
            {copy.founding.replace('{price}', foundingPrice)}
          </p>
          {message && <p role="status" className="text-sm" style={{ margin: '16px 0 0', color: 'var(--primary)', textAlign: 'center' }}>{message}</p>}
        </section>
      )}
    </main>
  );
};

export default BillingUpgrade;
