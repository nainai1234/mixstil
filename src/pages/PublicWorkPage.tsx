import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart2, Check, Copy, FileText, Heart, Loader2, MoonStar, Pause, Play, Sparkles } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';
import { api, getCreditsTextDownloadUrl } from '../lib/api';
import type { Mix } from '../lib/domain';
import type { AudioTrackDef } from '../context/AudioContext';
import { useI18n } from '../lib/i18n';

const publicWorkCopy = {
  zh: { back: '返回', privateTitle: '这个声音是私密的', privateBody: '只能由创建者打开，或通过私密分享链接访问。', loading: '正在加载声音...', by: '由', play: '播放', pause: '暂停', composition: '声音组成', save: '保存声音', saved: '已保存', copyLink: '复制链接', copied: '链接已复制', copyFailed: '无法复制链接。', createYours: '创建我的版本', credits: '版权与署名', madeWith: 'Made with MixStil' },
  en: { back: 'Back', privateTitle: 'This sound is private', privateBody: 'It can only be opened by its creator or through a private share link.', loading: 'Loading sound...', by: 'by', play: 'Play', pause: 'Pause', composition: 'Soundscape composition', save: 'Save sound', saved: 'Saved', copyLink: 'Copy link', copied: 'Link copied', copyFailed: 'Could not copy this link.', createYours: 'Create my version', credits: 'Copyright and credits', madeWith: 'Made with MixStil' },
  hi: { back: 'वापस', privateTitle: 'यह साउंड निजी है', privateBody: 'इसे केवल निर्माता या निजी शेयर लिंक से खोला जा सकता है।', loading: 'साउंड लोड हो रहा है...', by: 'द्वारा', play: 'चलाएं', pause: 'रोकें', composition: 'साउंडस्केप संरचना', save: 'साउंड सहेजें', saved: 'सहेजा गया', copyLink: 'लिंक कॉपी करें', copied: 'लिंक कॉपी हुआ', copyFailed: 'लिंक कॉपी नहीं हुआ।', createYours: 'अपना संस्करण बनाएं', credits: 'कॉपीराइट और क्रेडिट', madeWith: 'MixStil से बनाया गया' },
  es: { back: 'Atrás', privateTitle: 'Este sonido es privado', privateBody: 'Solo puede abrirlo su creador o quien tenga un enlace privado.', loading: 'Cargando sonido...', by: 'por', play: 'Reproducir', pause: 'Pausar', composition: 'Composición del paisaje sonoro', save: 'Guardar sonido', saved: 'Guardado', copyLink: 'Copiar enlace', copied: 'Enlace copiado', copyFailed: 'No se pudo copiar este enlace.', createYours: 'Crear mi versión', credits: 'Copyright y créditos', madeWith: 'Hecho con MixStil' },
  ar: { back: 'رجوع', privateTitle: 'هذا الصوت خاص', privateBody: 'لا يمكن فتحه إلا بواسطة منشئه أو عبر رابط مشاركة خاص.', loading: 'جار تحميل الصوت...', by: 'بواسطة', play: 'تشغيل', pause: 'إيقاف مؤقت', composition: 'تكوين المشهد الصوتي', save: 'حفظ الصوت', saved: 'محفوظ', copyLink: 'نسخ الرابط', copied: 'تم نسخ الرابط', copyFailed: 'تعذر نسخ الرابط.', createYours: 'أنشئ نسختي', credits: 'حقوق النشر والاعتمادات', madeWith: 'صنع باستخدام MixStil' },
  bn: { back: 'ফিরুন', privateTitle: 'এই সাউন্ডটি ব্যক্তিগত', privateBody: 'শুধু নির্মাতা বা ব্যক্তিগত শেয়ার লিংক দিয়ে এটি খোলা যাবে।', loading: 'সাউন্ড লোড হচ্ছে...', by: 'দ্বারা', play: 'চালান', pause: 'বিরতি', composition: 'সাউন্ডস্কেপের গঠন', save: 'সাউন্ড সংরক্ষণ', saved: 'সংরক্ষিত', copyLink: 'লিংক কপি', copied: 'লিংক কপি হয়েছে', copyFailed: 'লিংক কপি করা যায়নি।', createYours: 'নিজের সংস্করণ বানান', credits: 'কপিরাইট ও ক্রেডিট', madeWith: 'MixStil দিয়ে তৈরি' },
  pt: { back: 'Voltar', privateTitle: 'Este som é privado', privateBody: 'Ele só pode ser aberto pelo criador ou por um link privado.', loading: 'Carregando som...', by: 'por', play: 'Tocar', pause: 'Pausar', composition: 'Composição do soundscape', save: 'Salvar som', saved: 'Salvo', copyLink: 'Copiar link', copied: 'Link copiado', copyFailed: 'Não foi possível copiar este link.', createYours: 'Criar minha versão', credits: 'Copyright e créditos', madeWith: 'Feito com MixStil' },
  ru: { back: 'Назад', privateTitle: 'Этот звук приватный', privateBody: 'Его может открыть только создатель или человек с приватной ссылкой.', loading: 'Загрузка звука...', by: 'от', play: 'Воспроизвести', pause: 'Пауза', composition: 'Состав звукового ландшафта', save: 'Сохранить звук', saved: 'Сохранено', copyLink: 'Копировать ссылку', copied: 'Ссылка скопирована', copyFailed: 'Не удалось скопировать ссылку.', createYours: 'Создать свою версию', credits: 'Авторские права и сведения', madeWith: 'Создано в MixStil' },
  ja: { back: '戻る', privateTitle: 'このサウンドは非公開です', privateBody: '作成者、またはプライベート共有リンクを持つ人だけが開けます。', loading: 'サウンドを読み込み中...', by: '作成者', play: '再生', pause: '一時停止', composition: 'サウンドスケープ構成', save: 'サウンドを保存', saved: '保存済み', copyLink: 'リンクをコピー', copied: 'リンクをコピーしました', copyFailed: 'リンクをコピーできませんでした。', createYours: '自分用に作成', credits: '著作権とクレジット', madeWith: 'MixStil で作成' },
  id: { back: 'Kembali', privateTitle: 'Suara ini pribadi', privateBody: 'Hanya pembuatnya atau tautan berbagi pribadi yang dapat membukanya.', loading: 'Memuat suara...', by: 'oleh', play: 'Putar', pause: 'Jeda', composition: 'Komposisi soundscape', save: 'Simpan suara', saved: 'Tersimpan', copyLink: 'Salin tautan', copied: 'Tautan disalin', copyFailed: 'Tidak dapat menyalin tautan ini.', createYours: 'Buat versiku', credits: 'Hak cipta dan kredit', madeWith: 'Dibuat dengan MixStil' },
} as const;

const visualBars = [16, 26, 20, 30, 18];

const PublicWorkPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, formatMinutes } = useI18n();
  const copy = (publicWorkCopy as unknown as Record<string, typeof publicWorkCopy.en>)[locale] ?? publicWorkCopy.en;
  const { isPlaying, togglePlay, loadCustomTracks, stopAll } = useAudioMixer();
  const [isFavorite, setIsFavorite] = useState(false);
  const [work, setWork] = useState<Mix | null>(null);
  const [creatorName, setCreatorName] = useState('MixStil');
  const [tracks, setTracks] = useState<AudioTrackDef[]>([]);
  const [loadError, setLoadError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    api.getPublicMix(id || 'mix_ocean_calm').then((result) => {
      if (!result) return;
      setWork(result.mix);
      setCreatorName(result.creatorName === 'Alex R.' ? 'MixStil' : result.creatorName);
      setTracks(result.tracks);
      loadCustomTracks(result.tracks);
    }).catch((error: Error) => setLoadError(error.message));

    return () => stopAll();
  }, [id, loadCustomTracks, stopAll]);

  const saveSound = async () => {
    if (!work || isFavorite) return;
    await api.favoriteMix(work.id);
    setIsFavorite(true);
  };

  const copyLink = async () => {
    setCopyMessage('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage(copy.copied);
    } catch {
      setCopyMessage(copy.copyFailed);
    }
  };

  const createMine = () => {
    navigate('/create', {
      state: {
        sourceMixId: work?.id,
      },
    });
  };

  if (loadError) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: 'var(--bg-main)' }}>
        <div>
          <MoonStar size={34} style={{ marginBottom: 14 }} />
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>{copy.privateTitle}</h1>
          <p className="text-sm text-secondary">{copy.privateBody}</p>
        </div>
      </main>
    );
  }

  if (!work) {
    return (
      <main role="status" aria-label={copy.loading} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-main)' }}>
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  const activeTracks = tracks.filter((track) => !track.isMuted && track.volume > 0);

  return (
    <main style={{ minHeight: '100vh', color: '#fff', background: '#0A0A0C', overflowX: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(140, 106, 255, 0.18), rgba(10,10,12,0) 56%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto', padding: '20px var(--space-6) 48px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            className="btn"
            style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '8px 12px', fontSize: 14 }}
            onClick={() => navigate('/sounds')}
          >
            <ArrowLeft size={18} /> {copy.back}
          </button>
          <button className="btn-icon" aria-label={isFavorite ? copy.saved : copy.save} style={{ background: 'transparent' }} onClick={saveSound}>
            <Heart size={24} fill={isFavorite ? '#FF4B4B' : 'none'} color={isFavorite ? '#FF4B4B' : 'white'} />
          </button>
        </header>

        <section className="glass-panel" style={{ padding: 22, marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 22 }}>
            <div style={{ width: 86, height: 86, borderRadius: 8, background: 'linear-gradient(135deg, rgba(95,198,160,0.9), rgba(140,106,255,0.78))', display: 'grid', placeItems: 'center', boxShadow: isPlaying ? '0 0 30px rgba(95,198,160,0.28)' : 'none', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 5, height: 36, alignItems: 'center' }}>
                {visualBars.map((height, index) => (
                  <span key={height} style={{ width: 5, height: isPlaying ? height : 6, background: 'white', borderRadius: 3, opacity: 0.92, transition: 'height 0.28s ease', transitionDelay: `${index * 40}ms` }} />
                ))}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 25, marginBottom: 7, lineHeight: 1.15 }}>{work.title}</h1>
              <p className="text-sm text-secondary">{copy.by} {creatorName} · {formatMinutes(work.recipeData.durationSeconds)}</p>
            </div>
          </div>

          <button
            className="btn btn-primary"
            aria-label={isPlaying ? copy.pause : copy.play}
            onClick={togglePlay}
            style={{ width: '100%', minHeight: 56, borderRadius: 8, fontSize: 16, marginBottom: 18 }}
          >
            {isPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}
            {isPlaying ? copy.pause : copy.play}
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {work.recipeData.moodTags.map((tag: string) => (
              <span key={tag} className="text-xs" style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 9px', borderRadius: 999 }}>{tag}</span>
            ))}
          </div>
        </section>

        {activeTracks.length > 0 && (
          <section style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} className="text-primary" /> {copy.composition}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {activeTracks.map((track) => (
                <div key={track.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 550 }}>{track.name}</span>
                  <span className="text-xs text-secondary">{track.volume}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <button className="btn" onClick={saveSound} style={{ minHeight: 48, background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>
            {isFavorite ? <Check size={18} /> : <Heart size={18} />}
            {isFavorite ? copy.saved : copy.save}
          </button>
          <button className="btn" onClick={copyLink} style={{ minHeight: 48, background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>
            <Copy size={18} /> {copy.copyLink}
          </button>
        </section>

        <button className="btn" onClick={createMine} style={{ width: '100%', minHeight: 52, marginBottom: 14, background: '#5FC6A0', color: '#071A13', borderRadius: 8, fontWeight: 700 }}>
          <Sparkles size={18} /> {copy.createYours}
        </button>

        <a
          className="btn"
          href={getCreditsTextDownloadUrl(work.id)}
          download
          style={{ width: '100%', minHeight: 46, textDecoration: 'none', background: 'rgba(255,255,255,0.08)', color: '#FFF', marginBottom: 18 }}
        >
          <FileText size={18} /> {copy.credits}
        </a>

        {copyMessage && (
          <p role="status" className="text-sm" style={{ textAlign: 'center', color: copyMessage === copy.copied ? '#9BE3B8' : '#FFB1B1', marginBottom: 18 }}>
            {copyMessage}
          </p>
        )}

        <footer style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {copy.madeWith}
        </footer>
      </div>
    </main>
  );
};

export default PublicWorkPage;
