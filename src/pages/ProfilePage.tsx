import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, FileText, History, Languages, LogOut, Moon, Settings, Shield, SlidersHorizontal, Sparkles, Trash2, Save, X, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { api, clearAuthToken, hasAuthToken } from '../lib/api';
import type { PreferenceEvidence, ProductGoal, User, UserSoundProfile } from '../lib/domain';
import { LANGUAGE_OPTIONS, readLanguagePreference, resolveLanguagePreference, writeLanguagePreference, type LanguagePreference } from '../lib/languagePreference';
import { localeName, useI18n } from '../lib/i18n';
import { clearLocalListeningData } from '../lib/offlineLibrary';

const savedSoundLearningLabel = (evidence: PreferenceEvidence) => {
  const match = evidence.details?.internalBaselineMatch;
  if (match && typeof match === 'object' && 'title' in match && typeof match.title === 'string') return match.title;
  return evidence.value.replace(/^internal_baseline:/, '').replaceAll('_', ' ');
};

const titleCase = (value: string) => value
  .replace(/^internal_baseline:/, '')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const sourceLabel = (source: PreferenceEvidence['source'], copy: any) => {
  if (source === 'explicit_profile') return copy.profileSignals;
  if (source === 'saved_sound') return copy.savedSounds;
  if (source === 'playback_behavior') return copy.playbackFeedback;
  return copy.memoryTitle;
};

const kindLabel = (evidence: PreferenceEvidence, copy: any) => {
  if (evidence.kind === 'like') return copy.liked;
  if (evidence.kind === 'exclusion') return copy.excluded;
  if (evidence.kind === 'sensitivity') return copy.profileSignals;
  if (evidence.kind === 'default_goal') return copy.defaultGoal;
  return copy.defaultDuration;
};

const learnedSignalTitle = (evidence: PreferenceEvidence, copy: any) => {
  if (evidence.source === 'saved_sound' && evidence.value.startsWith('internal_baseline:')) return savedSoundLearningLabel(evidence);
  const feedback = typeof evidence.details?.feedback === 'string' ? evidence.details.feedback : '';
  if (feedback) return copy.playbackFeedback;
  if (copy.sounds?.[evidence.value]) return copy.sounds[evidence.value];
  return titleCase(evidence.value);
};

const learnedSignalDescription = (evidence: PreferenceEvidence, copy: any) => {
  if (evidence.source === 'saved_sound') return copy.savedLearnHelp;
  if (evidence.source === 'explicit_profile') return copy.memorySubtitle;
  return copy.playbackHelp;
};

const isWithinDays = (isoDate: string, days: number) => {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
};

const profilePageCopy: any = {
  zh: { liked: '喜欢的声音', excluded: '排除的声音', learnedSaved: '从已保存声音学习', removeLearned: '移除学习偏好', avoidCount: '{count} 个避开项', savedStacked: '偏好已保存并加入记忆。', saveFailed: '无法保存偏好记忆。', removed: '已移除这条学习偏好。', removeFailed: '无法移除这条学习偏好。', defaultGoal: '默认目标', defaultDuration: '默认时长', savingPreferences: '正在保存偏好...', savePreferences: '保存偏好', memoryTitle: 'AI 偏好记忆', memorySubtitle: '来自已保存声音和播放反馈的学习信号', memorySummary: '偏好记忆摘要', profileSignals: '个人偏好信号', savedSounds: '已保存声音', playbackFeedback: '播放反馈', avoidRules: '避开规则', thisWeek: '本周', weeklyLoading: '正在加载最近收听信号...', weeklyEmpty: '播放、保存或评价一个声音后，本周记忆会开始积累。', weeklySummary: '{fit} 个适合信号，{saved} 个已保存声音信号，{adjusted} 个调整信号，{avoided} 个避开信号。', savedLearnHelp: '保存声音后，MixStil 可以把它作为未来相似请求的偏好。', loadingLearned: '正在加载学习偏好...', savedLearnEmpty: '保存声音到“我的声音”后会显示在这里。', removing: '正在移除...', remove: '移除', playbackLearned: '从播放反馈学习', playbackHelp: '一键适合反馈会成为下一次声音的近期记忆。', playbackEmpty: '在播放器里使用适合按钮，教 MixStil 什么有效。', allSignals: '可编辑学习信号', allSignalsEmpty: '已保存声音和播放反馈会显示在这里。', privacy: '隐私与安全', support: '帮助与支持', credits: '音频署名与授权', accountTitle: '账号管理', accountAuth: '退出登录、删除账号', accountGuest: '访客会话状态', accountDeleted: '你的账号和个人收听数据已删除。', logoutAccount: '退出账号', guestStatus: '正在以未登录账号使用此设备。', deleteAccount: '删除账号', deleteTitle: '删除账号', deleteBody: '这会永久移除你的档案、偏好、已保存声音、收听历史和账号会话。', closeDelete: '关闭账号删除', typeDelete: '输入 DELETE 以确认', deleting: '正在删除...', deleteForever: '永久删除账号', sounds: { rain: '雨声', forest: '森林', ocean: '海浪', white_noise: '白噪音', brown_noise: '棕噪音', wind: '风声', soft_music: '柔和钢琴', night: '夜晚', water: '水声', voices: '人声', birds: '鸟声', music: '音乐', sudden_noise: '突发声', thunder: '雷声' } },
  en: { liked: 'Liked sounds', excluded: 'Excluded sounds', learnedSaved: 'Learned from saved sounds', removeLearned: 'Remove learned preference', avoidCount: '{count} avoids', savedStacked: 'Preferences saved and stacked.', saveFailed: 'Could not save preference memory.', removed: 'Saved-sound learning removed.', removeFailed: 'Could not remove this learned preference.', defaultGoal: 'Default goal', defaultDuration: 'Default duration', savingPreferences: 'Saving preferences...', savePreferences: 'Save preferences', memoryTitle: 'AI Preference memory', memorySubtitle: 'Learned signals from saved sounds & playback', memorySummary: 'Preference memory summary', profileSignals: 'Profile signals', savedSounds: 'Saved sounds', playbackFeedback: 'Playback feedback', avoidRules: 'Avoid rules', thisWeek: 'This week', weeklyLoading: 'Loading recent listening signals...', weeklyEmpty: 'Play, save, or rate a sound and the weekly memory will start filling in.', weeklySummary: '{fit} fit signals, {saved} saved-sound signals, {adjusted} adjustment signals, {avoided} avoid signals.', savedLearnHelp: 'When you save a sound, MixStil can use it as a preference for similar future requests.', loadingLearned: 'Loading learned preferences...', savedLearnEmpty: 'Save a sound to My Sounds and it will appear here.', removing: 'Removing...', remove: 'Remove', playbackLearned: 'Learned from playback', playbackHelp: 'One-tap fit feedback becomes recent memory for the next sound.', playbackEmpty: 'Use fit buttons in the player to teach MixStil what worked.', allSignals: 'Editable learned signals', allSignalsEmpty: 'Saved sounds and playback feedback will appear here.', privacy: 'Privacy and security', support: 'Help and support', credits: 'Audio credits & licenses', accountTitle: 'Account management', accountAuth: 'Log out, Delete Account', accountGuest: 'Guest session status', accountDeleted: 'Your account and personal listening data were deleted.', logoutAccount: 'Log out of account', guestStatus: 'Using this device without a signed-in account.', deleteAccount: 'Delete account', deleteTitle: 'Delete account', deleteBody: 'This permanently removes your profile, preferences, saved sounds, listening history, and account sessions.', closeDelete: 'Close account deletion', typeDelete: 'Type DELETE to confirm', deleting: 'Deleting...', deleteForever: 'Permanently delete account', sounds: { rain: 'Rain', forest: 'Forest', ocean: 'Ocean', white_noise: 'White noise', brown_noise: 'Brown noise', wind: 'Wind', soft_music: 'Soft piano', night: 'Night', water: 'Water', voices: 'Voices', birds: 'Birds', music: 'Music', sudden_noise: 'Sudden sounds', thunder: 'Thunder' } },
  ja: { liked: '好きな音', excluded: '除外する音', learnedSaved: '保存済みサウンドから学習', removeLearned: '学習した好みを削除', avoidCount: '除外 {count} 件', savedStacked: '好みを保存し、記憶に追加しました。', saveFailed: '好みの記憶を保存できませんでした。', removed: '保存サウンドの学習を削除しました。', removeFailed: 'この学習した好みを削除できませんでした。', defaultGoal: '既定の目的', defaultDuration: '既定の長さ', savingPreferences: '好みを保存中...', savePreferences: '好みを保存', memoryTitle: 'AI の好み記憶', memorySubtitle: '保存済みサウンドと再生フィードバックからの信号', memorySummary: '好み記憶の概要', profileSignals: 'プロフィール信号', savedSounds: '保存済みサウンド', playbackFeedback: '再生フィードバック', avoidRules: '除外ルール', thisWeek: '今週', weeklyLoading: '最近の再生信号を読み込み中...', weeklyEmpty: '再生、保存、評価をすると今週の記憶が蓄積されます。', weeklySummary: '適合 {fit} 件、保存 {saved} 件、調整 {adjusted} 件、除外 {avoided} 件。', savedLearnHelp: 'サウンドを保存すると、MixStil は今後の似たリクエストの好みとして使えます。', loadingLearned: '学習した好みを読み込み中...', savedLearnEmpty: 'マイサウンドに保存するとここに表示されます。', removing: '削除中...', remove: '削除', playbackLearned: '再生から学習', playbackHelp: 'ワンタップの適合フィードバックが次の音の近期記憶になります。', playbackEmpty: 'プレイヤーの適合ボタンで有効だった音を教えられます。', allSignals: '編集可能な学習信号', allSignalsEmpty: '保存済みサウンドと再生フィードバックがここに表示されます。', privacy: 'プライバシーと安全', support: 'ヘルプとサポート', credits: '音声クレジットとライセンス', accountTitle: 'アカウント管理', accountAuth: 'ログアウト、アカウント削除', accountGuest: 'ゲストセッション状態', accountDeleted: 'アカウントと個人の再生データを削除しました。', logoutAccount: 'アカウントからログアウト', guestStatus: 'ログインなしでこの端末を使用中です。', deleteAccount: 'アカウントを削除', deleteTitle: 'アカウントを削除', deleteBody: 'プロフィール、好み、保存済みサウンド、再生履歴、アカウントセッションを永久に削除します。', closeDelete: 'アカウント削除を閉じる', typeDelete: '確認のため DELETE と入力', deleting: '削除中...', deleteForever: 'アカウントを永久に削除', sounds: { rain: '雨音', forest: '森', ocean: '海', white_noise: 'ホワイトノイズ', brown_noise: 'ブラウンノイズ', wind: '風', soft_music: '柔らかいピアノ', night: '夜', water: '水音', voices: '声', birds: '鳥の声', music: '音楽', sudden_noise: '突然の音', thunder: '雷' } },
  es: {}, ar: {}, hi: {}, bn: {}, pt: {}, ru: {}, id: {},
};

const profilePageCopyFallback = profilePageCopy as Record<string, any>;
const withProfileCopyBase = (copy: any) => {
  const preference = copy.savePreferences ?? copy.liked;
  const memory = copy.memoryTitle ?? preference;
  const saved = copy.savedSounds ?? copy.learnedSaved ?? preference;
  const playback = copy.playbackFeedback ?? memory;
  const remove = copy.remove ?? copy.removeLearned ?? copy.excluded;
  const account = copy.accountTitle ?? copy.deleteAccount ?? preference;
  const loading = copy.loadingLearned ?? copy.savingPreferences ?? preference;
  return {
    liked: copy.liked,
    excluded: copy.excluded,
    learnedSaved: copy.learnedSaved ?? saved,
    removeLearned: copy.removeLearned ?? remove,
    avoidCount: copy.avoidCount,
    savedStacked: copy.savedStacked ?? preference,
    saveFailed: copy.saveFailed ?? preference,
    removed: copy.removed ?? remove,
    removeFailed: copy.removeFailed ?? remove,
    defaultGoal: copy.defaultGoal ?? preference,
    defaultDuration: copy.defaultDuration ?? preference,
    savingPreferences: copy.savingPreferences ?? loading,
    savePreferences: preference,
    memoryTitle: memory,
    memorySubtitle: copy.memorySubtitle ?? memory,
    memorySummary: copy.memorySummary ?? memory,
    profileSignals: copy.profileSignals ?? preference,
    savedSounds: saved,
    playbackFeedback: playback,
    avoidRules: copy.avoidRules ?? copy.excluded,
    thisWeek: copy.thisWeek ?? memory,
    weeklyLoading: copy.weeklyLoading ?? loading,
    weeklyEmpty: copy.weeklyEmpty ?? memory,
    weeklySummary: copy.weeklySummary ?? '{fit} · {saved} · {adjusted} · {avoided}',
    savedLearnHelp: copy.savedLearnHelp ?? memory,
    loadingLearned: loading,
    savedLearnEmpty: copy.savedLearnEmpty ?? saved,
    removing: copy.removing ?? remove,
    remove,
    playbackLearned: copy.playbackLearned ?? playback,
    playbackHelp: copy.playbackHelp ?? playback,
    playbackEmpty: copy.playbackEmpty ?? playback,
    allSignals: copy.allSignals ?? memory,
    allSignalsEmpty: copy.allSignalsEmpty ?? memory,
    privacy: copy.privacy,
    support: copy.support,
    credits: copy.credits,
    accountTitle: account,
    accountAuth: copy.accountAuth ?? account,
    accountGuest: copy.accountGuest ?? account,
    accountDeleted: copy.accountDeleted ?? copy.deleteAccount,
    logoutAccount: copy.logoutAccount,
    guestStatus: copy.guestStatus ?? copy.accountGuest,
    deleteAccount: copy.deleteAccount,
    deleteTitle: copy.deleteTitle ?? copy.deleteAccount,
    deleteBody: copy.deleteBody ?? copy.deleteAccount,
    closeDelete: copy.closeDelete ?? remove,
    typeDelete: copy.typeDelete,
    deleting: copy.deleting ?? loading,
    deleteForever: copy.deleteForever ?? copy.deleteAccount,
    sounds: copy.sounds,
  };
};
profilePageCopyFallback.es = withProfileCopyBase({ liked: 'Sonidos preferidos', excluded: 'Sonidos excluidos', learnedSaved: 'Aprendido de sonidos guardados', removeLearned: 'Eliminar preferencia aprendida', avoidCount: '{count} evitados', savePreferences: 'Guardar preferencias', memoryTitle: 'Memoria de preferencias de IA', memorySubtitle: 'Señales aprendidas de guardados y reproducción', profileSignals: 'Señales de perfil', savedSounds: 'Sonidos guardados', playbackFeedback: 'Comentarios de reproducción', avoidRules: 'Reglas de evitación', thisWeek: 'Esta semana', privacy: 'Privacidad y seguridad', support: 'Ayuda y soporte', credits: 'Créditos y licencias de audio', accountTitle: 'Gestión de cuenta', accountAuth: 'Cerrar sesión, eliminar cuenta', accountGuest: 'Estado de invitado', logoutAccount: 'Cerrar sesión', deleteAccount: 'Eliminar cuenta', deleteTitle: 'Eliminar cuenta', typeDelete: 'Escribe DELETE para confirmar', deleteForever: 'Eliminar cuenta permanentemente', sounds: { rain: 'Lluvia', forest: 'Bosque', ocean: 'Océano', white_noise: 'Ruido blanco', brown_noise: 'Ruido marrón', wind: 'Viento', soft_music: 'Piano suave', night: 'Noche', water: 'Agua', voices: 'Voces', birds: 'Pájaros', music: 'Música', sudden_noise: 'Sonidos repentinos', thunder: 'Trueno' } });
profilePageCopyFallback.pt = withProfileCopyBase({ liked: 'Sons preferidos', excluded: 'Sons excluídos', learnedSaved: 'Aprendido com sons salvos', removeLearned: 'Remover preferência aprendida', avoidCount: '{count} evitados', savePreferences: 'Salvar preferências', memoryTitle: 'Memória de preferências de IA', memorySubtitle: 'Sinais aprendidos de sons salvos e reprodução', profileSignals: 'Sinais do perfil', savedSounds: 'Sons salvos', playbackFeedback: 'Feedback de reprodução', avoidRules: 'Regras de evitar', thisWeek: 'Esta semana', privacy: 'Privacidade e segurança', support: 'Ajuda e suporte', credits: 'Créditos e licenças de áudio', accountTitle: 'Gerenciamento da conta', accountAuth: 'Sair, excluir conta', accountGuest: 'Sessão de convidado', logoutAccount: 'Sair da conta', deleteAccount: 'Excluir conta', deleteTitle: 'Excluir conta', typeDelete: 'Digite DELETE para confirmar', deleteForever: 'Excluir conta permanentemente', sounds: { rain: 'Chuva', forest: 'Floresta', ocean: 'Oceano', white_noise: 'Ruído branco', brown_noise: 'Ruído marrom', wind: 'Vento', soft_music: 'Piano suave', night: 'Noite', water: 'Água', voices: 'Vozes', birds: 'Pássaros', music: 'Música', sudden_noise: 'Sons repentinos', thunder: 'Trovão' } });
profilePageCopyFallback.ru = withProfileCopyBase({ liked: 'Любимые звуки', excluded: 'Исключенные звуки', learnedSaved: 'Из сохраненных звуков', removeLearned: 'Удалить выученную настройку', avoidCount: '{count} исключений', savePreferences: 'Сохранить предпочтения', memoryTitle: 'Память предпочтений AI', memorySubtitle: 'Сигналы из сохранений и воспроизведения', profileSignals: 'Сигналы профиля', savedSounds: 'Сохраненные звуки', playbackFeedback: 'Отзывы о воспроизведении', avoidRules: 'Правила исключения', thisWeek: 'На этой неделе', privacy: 'Приватность и безопасность', support: 'Помощь и поддержка', credits: 'Авторы и лицензии аудио', accountTitle: 'Управление аккаунтом', accountAuth: 'Выйти, удалить аккаунт', accountGuest: 'Гостевая сессия', logoutAccount: 'Выйти из аккаунта', deleteAccount: 'Удалить аккаунт', deleteTitle: 'Удалить аккаунт', typeDelete: 'Введите DELETE для подтверждения', deleteForever: 'Удалить аккаунт навсегда', sounds: { rain: 'Дождь', forest: 'Лес', ocean: 'Океан', white_noise: 'Белый шум', brown_noise: 'Коричневый шум', wind: 'Ветер', soft_music: 'Мягкое пианино', night: 'Ночь', water: 'Вода', voices: 'Голоса', birds: 'Птицы', music: 'Музыка', sudden_noise: 'Внезапные звуки', thunder: 'Гром' } });
profilePageCopyFallback.hi = withProfileCopyBase({ liked: 'पसंदीदा ध्वनियां', excluded: 'बाहर रखी ध्वनियां', learnedSaved: 'सहेजे साउंड से सीखा', removeLearned: 'सीखी पसंद हटाएं', avoidCount: '{count} बचाव', savePreferences: 'पसंद सहेजें', memoryTitle: 'AI पसंद स्मृति', memorySubtitle: 'सहेजे साउंड और प्लेबैक से संकेत', profileSignals: 'प्रोफ़ाइल संकेत', savedSounds: 'सहेजे साउंड', playbackFeedback: 'प्लेबैक प्रतिक्रिया', avoidRules: 'बचाव नियम', thisWeek: 'इस सप्ताह', privacy: 'गोपनीयता और सुरक्षा', support: 'मदद और सहायता', credits: 'ऑडियो क्रेडिट और लाइसेंस', accountTitle: 'खाता प्रबंधन', accountAuth: 'लॉग आउट, खाता हटाएं', accountGuest: 'अतिथि सत्र', logoutAccount: 'खाते से लॉग आउट', deleteAccount: 'खाता हटाएं', deleteTitle: 'खाता हटाएं', typeDelete: 'पुष्टि के लिए DELETE लिखें', deleteForever: 'खाता स्थायी रूप से हटाएं', sounds: { rain: 'बारिश', forest: 'जंगल', ocean: 'समुद्र', white_noise: 'व्हाइट नॉइज़', brown_noise: 'ब्राउन नॉइज़', wind: 'हवा', soft_music: 'नर्म पियानो', night: 'रात', water: 'पानी', voices: 'आवाज़ें', birds: 'पक्षी', music: 'संगीत', sudden_noise: 'अचानक आवाज़', thunder: 'गरज' } });
profilePageCopyFallback.bn = withProfileCopyBase({ liked: 'পছন্দের সাউন্ড', excluded: 'বাদ দেওয়া সাউন্ড', learnedSaved: 'সংরক্ষিত সাউন্ড থেকে শেখা', removeLearned: 'শেখা পছন্দ সরান', avoidCount: '{count} এড়ানো', savePreferences: 'পছন্দ সংরক্ষণ', memoryTitle: 'AI পছন্দ স্মৃতি', memorySubtitle: 'সংরক্ষিত সাউন্ড ও প্লেব্যাক থেকে সংকেত', profileSignals: 'প্রোফাইল সংকেত', savedSounds: 'সংরক্ষিত সাউন্ড', playbackFeedback: 'প্লেব্যাক মতামত', avoidRules: 'এড়ানোর নিয়ম', thisWeek: 'এই সপ্তাহ', privacy: 'গোপনীয়তা ও নিরাপত্তা', support: 'সহায়তা', credits: 'অডিও ক্রেডিট ও লাইসেন্স', accountTitle: 'অ্যাকাউন্ট ব্যবস্থাপনা', accountAuth: 'লগ আউট, অ্যাকাউন্ট মুছুন', accountGuest: 'অতিথি সেশন', logoutAccount: 'অ্যাকাউন্ট থেকে লগ আউট', deleteAccount: 'অ্যাকাউন্ট মুছুন', deleteTitle: 'অ্যাকাউন্ট মুছুন', typeDelete: 'নিশ্চিত করতে DELETE লিখুন', deleteForever: 'স্থায়ীভাবে অ্যাকাউন্ট মুছুন', sounds: { rain: 'বৃষ্টি', forest: 'বন', ocean: 'সমুদ্র', white_noise: 'সাদা শব্দ', brown_noise: 'বাদামী শব্দ', wind: 'বাতাস', soft_music: 'নরম পিয়ানো', night: 'রাত', water: 'পানি', voices: 'কণ্ঠ', birds: 'পাখি', music: 'সঙ্গীত', sudden_noise: 'হঠাৎ শব্দ', thunder: 'বজ্র' } });
profilePageCopyFallback.ar = withProfileCopyBase({ liked: 'الأصوات المفضلة', excluded: 'الأصوات المستبعدة', learnedSaved: 'تعلّم من الأصوات المحفوظة', removeLearned: 'إزالة تفضيل متعلم', avoidCount: '{count} تجنبات', savePreferences: 'حفظ التفضيلات', memoryTitle: 'ذاكرة تفضيلات الذكاء الاصطناعي', memorySubtitle: 'إشارات من الأصوات المحفوظة والتشغيل', profileSignals: 'إشارات الملف', savedSounds: 'الأصوات المحفوظة', playbackFeedback: 'ملاحظات التشغيل', avoidRules: 'قواعد التجنب', thisWeek: 'هذا الأسبوع', privacy: 'الخصوصية والأمان', support: 'المساعدة والدعم', credits: 'اعتمادات الصوت والتراخيص', accountTitle: 'إدارة الحساب', accountAuth: 'تسجيل الخروج، حذف الحساب', accountGuest: 'جلسة ضيف', logoutAccount: 'تسجيل الخروج من الحساب', deleteAccount: 'حذف الحساب', deleteTitle: 'حذف الحساب', typeDelete: 'اكتب DELETE للتأكيد', deleteForever: 'حذف الحساب نهائياً', sounds: { rain: 'مطر', forest: 'غابة', ocean: 'محيط', white_noise: 'ضوضاء بيضاء', brown_noise: 'ضوضاء بنية', wind: 'رياح', soft_music: 'بيانو هادئ', night: 'ليل', water: 'ماء', voices: 'أصوات بشرية', birds: 'طيور', music: 'موسيقى', sudden_noise: 'أصوات مفاجئة', thunder: 'رعد' } });
profilePageCopyFallback.id = withProfileCopyBase({ liked: 'Suara yang disukai', excluded: 'Suara yang dihindari', learnedSaved: 'Belajar dari suara tersimpan', removeLearned: 'Hapus preferensi belajar', avoidCount: '{count} hindaran', savePreferences: 'Simpan preferensi', memoryTitle: 'Memori preferensi AI', memorySubtitle: 'Sinyal dari suara tersimpan dan pemutaran', profileSignals: 'Sinyal profil', savedSounds: 'Suara tersimpan', playbackFeedback: 'Umpan balik pemutaran', avoidRules: 'Aturan hindari', thisWeek: 'Minggu ini', privacy: 'Privasi dan keamanan', support: 'Bantuan dan dukungan', credits: 'Kredit dan lisensi audio', accountTitle: 'Manajemen akun', accountAuth: 'Keluar, hapus akun', accountGuest: 'Sesi tamu', logoutAccount: 'Keluar dari akun', deleteAccount: 'Hapus akun', deleteTitle: 'Hapus akun', typeDelete: 'Ketik DELETE untuk konfirmasi', deleteForever: 'Hapus akun permanen', sounds: { rain: 'Hujan', forest: 'Hutan', ocean: 'Laut', white_noise: 'White noise', brown_noise: 'Brown noise', wind: 'Angin', soft_music: 'Piano lembut', night: 'Malam', water: 'Air', voices: 'Suara manusia', birds: 'Burung', music: 'Musik', sudden_noise: 'Suara mendadak', thunder: 'Petir' } });
profilePageCopyFallback.de = withProfileCopyBase({ liked: 'Gemochte Klänge', excluded: 'Ausgeschlossene Klänge', learnedSaved: 'Aus gespeicherten Klängen gelernt', removeLearned: 'Gelernte Vorliebe entfernen', avoidCount: '{count} Ausschlüsse', savedStacked: 'Vorlieben gespeichert und zur Erinnerung hinzugefügt.', saveFailed: 'Vorliebengedächtnis konnte nicht gespeichert werden.', removed: 'Gelernte Vorliebe wurde entfernt.', removeFailed: 'Diese gelernte Vorliebe konnte nicht entfernt werden.', defaultGoal: 'Standardziel', defaultDuration: 'Standarddauer', savingPreferences: 'Vorlieben werden gespeichert...', savePreferences: 'Vorlieben speichern', memoryTitle: 'KI-Vorliebengedächtnis', memorySubtitle: 'Signale aus gespeicherten Klängen und Wiedergabe', memorySummary: 'Zusammenfassung der Vorlieben', profileSignals: 'Profilsignale', savedSounds: 'Gespeicherte Klänge', playbackFeedback: 'Wiedergabe-Feedback', avoidRules: 'Ausschlussregeln', thisWeek: 'Diese Woche', weeklyLoading: 'Letzte Hörsignale werden geladen...', weeklyEmpty: 'Spiele, speichere oder bewerte einen Klang, dann füllt sich die Erinnerung.', weeklySummary: '{fit} passende Signale, {saved} gespeicherte Klangsignale, {adjusted} Anpassungssignale, {avoided} Ausschlusssignale.', savedLearnHelp: 'Wenn du einen Klang speicherst, kann MixStil ihn für ähnliche künftige Wünsche nutzen.', loadingLearned: 'Gelernte Vorlieben werden geladen...', savedLearnEmpty: 'Speichere einen Klang in Meine Klänge, dann erscheint er hier.', removing: 'Entfernen...', remove: 'Entfernen', playbackLearned: 'Aus Wiedergabe gelernt', playbackHelp: 'Ein Tipp auf passend wird zur kurzfristigen Erinnerung für den nächsten Klang.', playbackEmpty: 'Nutze die Passend-Tasten im Player, um MixStil zu zeigen, was funktioniert.', allSignals: 'Bearbeitbare Lernsignale', allSignalsEmpty: 'Gespeicherte Klänge und Wiedergabe-Feedback erscheinen hier.', privacy: 'Datenschutz und Sicherheit', support: 'Hilfe und Support', credits: 'Audio-Credits und Lizenzen', accountTitle: 'Kontoverwaltung', accountAuth: 'Abmelden, Konto löschen', accountGuest: 'Gaststatus', accountDeleted: 'Dein Konto und deine persönlichen Hördaten wurden gelöscht.', logoutAccount: 'Vom Konto abmelden', guestStatus: 'Dieses Gerät wird ohne Anmeldung verwendet.', deleteAccount: 'Konto löschen', deleteTitle: 'Konto löschen', deleteBody: 'Dies entfernt Profil, Vorlieben, gespeicherte Klänge, Hörverlauf und Kontositzungen dauerhaft.', closeDelete: 'Kontolöschung schließen', typeDelete: 'Zum Bestätigen DELETE eingeben', deleting: 'Wird gelöscht...', deleteForever: 'Konto dauerhaft löschen', sounds: { rain: 'Regen', forest: 'Wald', ocean: 'Meer', white_noise: 'Weißes Rauschen', brown_noise: 'Braunes Rauschen', wind: 'Wind', soft_music: 'Sanftes Klavier', night: 'Nacht', water: 'Wasser', voices: 'Stimmen', birds: 'Vögel', music: 'Musik', sudden_noise: 'Plötzliche Geräusche', thunder: 'Donner' } });
profilePageCopyFallback.fr = withProfileCopyBase({ liked: 'Sons aimés', excluded: 'Sons exclus', learnedSaved: 'Appris depuis les sons enregistrés', removeLearned: 'Retirer la préférence apprise', avoidCount: '{count} exclusions', savedStacked: 'Préférences enregistrées et ajoutées à la mémoire.', saveFailed: 'Impossible d’enregistrer la mémoire des préférences.', removed: 'Préférence apprise retirée.', removeFailed: 'Impossible de retirer cette préférence.', defaultGoal: 'Objectif par défaut', defaultDuration: 'Durée par défaut', savingPreferences: 'Enregistrement...', savePreferences: 'Enregistrer les préférences', memoryTitle: 'Mémoire de préférences IA', memorySubtitle: 'Signaux issus des sons enregistrés et de l’écoute', memorySummary: 'Résumé des préférences', profileSignals: 'Signaux du profil', savedSounds: 'Sons enregistrés', playbackFeedback: 'Retour d’écoute', avoidRules: 'Règles d’exclusion', thisWeek: 'Cette semaine', privacy: 'Confidentialité et sécurité', support: 'Aide et support', credits: 'Crédits audio et licences', accountTitle: 'Gestion du compte', accountAuth: 'Se déconnecter, supprimer le compte', accountGuest: 'Session invitée', accountDeleted: 'Votre compte et vos données d’écoute personnelles ont été supprimés.', logoutAccount: 'Se déconnecter', guestStatus: 'Utilisation de cet appareil sans compte connecté.', deleteAccount: 'Supprimer le compte', deleteTitle: 'Supprimer le compte', typeDelete: 'Saisissez DELETE pour confirmer', deleting: 'Suppression...', deleteForever: 'Supprimer définitivement le compte', sounds: { rain: 'Pluie', forest: 'Forêt', ocean: 'Océan', white_noise: 'Bruit blanc', brown_noise: 'Bruit brun', wind: 'Vent', soft_music: 'Piano doux', night: 'Nuit', water: 'Eau', voices: 'Voix', birds: 'Oiseaux', music: 'Musique', sudden_noise: 'Sons soudains', thunder: 'Tonnerre' } });
profilePageCopyFallback.ko = withProfileCopyBase({ liked: '좋아하는 소리', excluded: '제외한 소리', learnedSaved: '저장한 소리에서 학습', removeLearned: '학습된 선호 제거', avoidCount: '제외 {count}개', savedStacked: '선호가 저장되고 기억에 추가되었습니다.', saveFailed: '선호 기억을 저장할 수 없습니다.', removed: '학습된 선호가 제거되었습니다.', removeFailed: '이 학습 선호를 제거할 수 없습니다.', defaultGoal: '기본 목표', defaultDuration: '기본 시간', savingPreferences: '선호 저장 중...', savePreferences: '선호 저장', memoryTitle: 'AI 선호 기억', memorySubtitle: '저장한 소리와 재생 피드백에서 온 신호', memorySummary: '선호 기억 요약', profileSignals: '프로필 신호', savedSounds: '저장된 소리', playbackFeedback: '재생 피드백', avoidRules: '제외 규칙', thisWeek: '이번 주', privacy: '개인정보 및 보안', support: '도움말 및 지원', credits: '오디오 크레딧 및 라이선스', accountTitle: '계정 관리', accountAuth: '로그아웃, 계정 삭제', accountGuest: '게스트 세션 상태', accountDeleted: '계정과 개인 청취 데이터가 삭제되었습니다.', logoutAccount: '계정에서 로그아웃', guestStatus: '로그인하지 않고 이 기기를 사용 중입니다.', deleteAccount: '계정 삭제', deleteTitle: '계정 삭제', typeDelete: '확인을 위해 DELETE 입력', deleting: '삭제 중...', deleteForever: '계정 영구 삭제', sounds: { rain: '비', forest: '숲', ocean: '바다', white_noise: '화이트 노이즈', brown_noise: '브라운 노이즈', wind: '바람', soft_music: '부드러운 피아노', night: '밤', water: '물', voices: '목소리', birds: '새', music: '음악', sudden_noise: '갑작스러운 소리', thunder: '천둥' } });
profilePageCopyFallback.it = withProfileCopyBase({ liked: 'Suoni preferiti', excluded: 'Suoni esclusi', learnedSaved: 'Appreso dai suoni salvati', removeLearned: 'Rimuovi preferenza appresa', avoidCount: '{count} esclusioni', savedStacked: 'Preferenze salvate e aggiunte alla memoria.', saveFailed: 'Impossibile salvare la memoria preferenze.', removed: 'Preferenza appresa rimossa.', removeFailed: 'Impossibile rimuovere questa preferenza.', defaultGoal: 'Obiettivo predefinito', defaultDuration: 'Durata predefinita', savingPreferences: 'Salvataggio preferenze...', savePreferences: 'Salva preferenze', memoryTitle: 'Memoria preferenze IA', memorySubtitle: 'Segnali da suoni salvati e riproduzione', memorySummary: 'Riepilogo preferenze', profileSignals: 'Segnali profilo', savedSounds: 'Suoni salvati', playbackFeedback: 'Feedback di riproduzione', avoidRules: 'Regole di esclusione', thisWeek: 'Questa settimana', privacy: 'Privacy e sicurezza', support: 'Aiuto e supporto', credits: 'Crediti audio e licenze', accountTitle: 'Gestione account', accountAuth: 'Esci, elimina account', accountGuest: 'Sessione ospite', accountDeleted: 'Account e dati personali di ascolto eliminati.', logoutAccount: 'Esci dall’account', guestStatus: 'Dispositivo in uso senza account connesso.', deleteAccount: 'Elimina account', deleteTitle: 'Elimina account', typeDelete: 'Digita DELETE per confermare', deleting: 'Eliminazione...', deleteForever: 'Elimina account definitivamente', sounds: { rain: 'Pioggia', forest: 'Foresta', ocean: 'Oceano', white_noise: 'Rumore bianco', brown_noise: 'Rumore marrone', wind: 'Vento', soft_music: 'Piano morbido', night: 'Notte', water: 'Acqua', voices: 'Voci', birds: 'Uccelli', music: 'Musica', sudden_noise: 'Suoni improvvisi', thunder: 'Tuono' } });
profilePageCopyFallback.nl = withProfileCopyBase({ liked: 'Geliefde geluiden', excluded: 'Uitgesloten geluiden', learnedSaved: 'Geleerd van opgeslagen geluiden', removeLearned: 'Geleerde voorkeur verwijderen', avoidCount: '{count} uitsluitingen', savedStacked: 'Voorkeuren opgeslagen en aan geheugen toegevoegd.', saveFailed: 'Voorkeursgeheugen kon niet worden opgeslagen.', removed: 'Geleerde voorkeur verwijderd.', removeFailed: 'Deze voorkeur kon niet worden verwijderd.', defaultGoal: 'Standaarddoel', defaultDuration: 'Standaardduur', savingPreferences: 'Voorkeuren opslaan...', savePreferences: 'Voorkeuren opslaan', memoryTitle: 'AI-voorkeursgeheugen', memorySubtitle: 'Signalen uit opgeslagen geluiden en afspelen', memorySummary: 'Samenvatting voorkeuren', profileSignals: 'Profielsignalen', savedSounds: 'Opgeslagen geluiden', playbackFeedback: 'Afspeelfeedback', avoidRules: 'Uitsluitregels', thisWeek: 'Deze week', privacy: 'Privacy en veiligheid', support: 'Hulp en ondersteuning', credits: 'Audiocredits en licenties', accountTitle: 'Accountbeheer', accountAuth: 'Uitloggen, account verwijderen', accountGuest: 'Gaststatus', accountDeleted: 'Je account en persoonlijke luistergegevens zijn verwijderd.', logoutAccount: 'Uitloggen', guestStatus: 'Dit apparaat wordt zonder ingelogd account gebruikt.', deleteAccount: 'Account verwijderen', deleteTitle: 'Account verwijderen', typeDelete: 'Typ DELETE om te bevestigen', deleting: 'Verwijderen...', deleteForever: 'Account permanent verwijderen', sounds: { rain: 'Regen', forest: 'Bos', ocean: 'Oceaan', white_noise: 'Witte ruis', brown_noise: 'Bruine ruis', wind: 'Wind', soft_music: 'Zachte piano', night: 'Nacht', water: 'Water', voices: 'Stemmen', birds: 'Vogels', music: 'Muziek', sudden_noise: 'Plotselinge geluiden', thunder: 'Donder' } });
profilePageCopyFallback['zh-Hant'] = withProfileCopyBase({ liked: '喜歡的聲音', excluded: '排除的聲音', learnedSaved: '從已儲存聲音學習', removeLearned: '移除學習偏好', avoidCount: '{count} 個避開項', savePreferences: '儲存偏好', memoryTitle: 'AI 偏好記憶', memorySubtitle: '來自已儲存聲音與播放的訊號', profileSignals: '個人偏好訊號', savedSounds: '已儲存聲音', playbackFeedback: '播放回饋', avoidRules: '避開規則', thisWeek: '本週', privacy: '隱私與安全', support: '說明與支援', credits: '音訊署名與授權', accountTitle: '帳號管理', accountAuth: '登出、刪除帳號', accountGuest: '訪客狀態', logoutAccount: '登出帳號', deleteAccount: '刪除帳號', typeDelete: '輸入 DELETE 以確認', deleteForever: '永久刪除帳號', sounds: { rain: '雨聲', forest: '森林', ocean: '海浪', white_noise: '白噪音', brown_noise: '棕噪音', wind: '風聲', soft_music: '柔和鋼琴', night: '夜晚', water: '水聲', voices: '人聲', birds: '鳥聲', music: '音樂', sudden_noise: '突發聲', thunder: '雷聲' } });
profilePageCopyFallback.tr = withProfileCopyBase({ liked: 'Sevilen sesler', excluded: 'Hariç tutulan sesler', learnedSaved: 'Kaydedilen seslerden öğrenilenler', removeLearned: 'Öğrenilen tercihi kaldır', avoidCount: '{count} kaçınma', savePreferences: 'Tercihleri kaydet', memoryTitle: 'AI tercih hafızası', memorySubtitle: 'Kaydedilen sesler ve oynatmadan gelen sinyaller', profileSignals: 'Profil sinyalleri', savedSounds: 'Kaydedilen sesler', playbackFeedback: 'Oynatma geri bildirimi', avoidRules: 'Kaçınma kuralları', thisWeek: 'Bu hafta', privacy: 'Gizlilik ve güvenlik', support: 'Yardım ve destek', credits: 'Ses katkıları ve lisanslar', accountTitle: 'Hesap yönetimi', accountAuth: 'Çıkış yap, hesabı sil', accountGuest: 'Misafir durumu', logoutAccount: 'Hesaptan çıkış yap', deleteAccount: 'Hesabı sil', typeDelete: 'Onaylamak için DELETE yazın', deleteForever: 'Hesabı kalıcı olarak sil', sounds: { rain: 'Yağmur', forest: 'Orman', ocean: 'Okyanus', white_noise: 'Beyaz gürültü', brown_noise: 'Kahverengi gürültü', wind: 'Rüzgar', soft_music: 'Yumuşak piyano', night: 'Gece', water: 'Su', voices: 'Sesler', birds: 'Kuşlar', music: 'Müzik', sudden_noise: 'Ani sesler', thunder: 'Gök gürültüsü' } });
profilePageCopyFallback.pl = withProfileCopyBase({ liked: 'Lubiane dźwięki', excluded: 'Wykluczone dźwięki', learnedSaved: 'Nauka z zapisanych dźwięków', removeLearned: 'Usuń zapamiętaną preferencję', avoidCount: '{count} wykluczeń', savePreferences: 'Zapisz preferencje', memoryTitle: 'Pamięć preferencji AI', memorySubtitle: 'Sygnały z zapisów i odtwarzania', profileSignals: 'Sygnały profilu', savedSounds: 'Zapisane dźwięki', playbackFeedback: 'Opinie po odtwarzaniu', avoidRules: 'Reguły wykluczeń', thisWeek: 'Ten tydzień', privacy: 'Prywatność i bezpieczeństwo', support: 'Pomoc i wsparcie', credits: 'Autorzy i licencje audio', accountTitle: 'Zarządzanie kontem', accountAuth: 'Wyloguj, usuń konto', accountGuest: 'Tryb gościa', logoutAccount: 'Wyloguj się', deleteAccount: 'Usuń konto', typeDelete: 'Wpisz DELETE, aby potwierdzić', deleteForever: 'Usuń konto na stałe', sounds: { rain: 'Deszcz', forest: 'Las', ocean: 'Ocean', white_noise: 'Biały szum', brown_noise: 'Brązowy szum', wind: 'Wiatr', soft_music: 'Delikatny fortepian', night: 'Noc', water: 'Woda', voices: 'Głosy', birds: 'Ptaki', music: 'Muzyka', sudden_noise: 'Nagłe dźwięki', thunder: 'Grzmot' } });
profilePageCopyFallback.sv = withProfileCopyBase({ liked: 'Gillade ljud', excluded: 'Uteslutna ljud', learnedSaved: 'Lärt från sparade ljud', removeLearned: 'Ta bort inlärd preferens', avoidCount: '{count} undantag', savePreferences: 'Spara preferenser', memoryTitle: 'AI-minne för preferenser', memorySubtitle: 'Signaler från sparade ljud och uppspelning', profileSignals: 'Profilsignaler', savedSounds: 'Sparade ljud', playbackFeedback: 'Uppspelningsfeedback', avoidRules: 'Undantagsregler', thisWeek: 'Den här veckan', privacy: 'Integritet och säkerhet', support: 'Hjälp och support', credits: 'Ljudkrediter och licenser', accountTitle: 'Kontohantering', accountAuth: 'Logga ut, radera konto', accountGuest: 'Gäststatus', logoutAccount: 'Logga ut', deleteAccount: 'Radera konto', typeDelete: 'Skriv DELETE för att bekräfta', deleteForever: 'Radera kontot permanent', sounds: { rain: 'Regn', forest: 'Skog', ocean: 'Hav', white_noise: 'Vitt brus', brown_noise: 'Brunt brus', wind: 'Vind', soft_music: 'Mjuk piano', night: 'Natt', water: 'Vatten', voices: 'Röster', birds: 'Fåglar', music: 'Musik', sudden_noise: 'Plötsliga ljud', thunder: 'Åska' } });
profilePageCopyFallback.th = withProfileCopyBase({ liked: 'เสียงที่ชอบ', excluded: 'เสียงที่ไม่ต้องการ', learnedSaved: 'เรียนรู้จากเสียงที่บันทึก', removeLearned: 'ลบค่าที่เรียนรู้', avoidCount: 'หลีกเลี่ยง {count} รายการ', savePreferences: 'บันทึกการตั้งค่า', memoryTitle: 'หน่วยความจำความชอบ AI', memorySubtitle: 'สัญญาณจากเสียงที่บันทึกและการเล่น', profileSignals: 'สัญญาณโปรไฟล์', savedSounds: 'เสียงที่บันทึก', playbackFeedback: 'ความคิดเห็นการเล่น', avoidRules: 'กฎการหลีกเลี่ยง', thisWeek: 'สัปดาห์นี้', privacy: 'ความเป็นส่วนตัวและความปลอดภัย', support: 'ช่วยเหลือและสนับสนุน', credits: 'เครดิตและสิทธิ์เสียง', accountTitle: 'จัดการบัญชี', accountAuth: 'ออกจากระบบ ลบบัญชี', accountGuest: 'สถานะผู้เยี่ยมชม', logoutAccount: 'ออกจากบัญชี', deleteAccount: 'ลบบัญชี', typeDelete: 'พิมพ์ DELETE เพื่อยืนยัน', deleteForever: 'ลบบัญชีถาวร', sounds: { rain: 'ฝน', forest: 'ป่า', ocean: 'มหาสมุทร', white_noise: 'ไวท์นอยส์', brown_noise: 'บราวน์นอยส์', wind: 'ลม', soft_music: 'เปียโนเบา', night: 'กลางคืน', water: 'น้ำ', voices: 'เสียงพูด', birds: 'นก', music: 'ดนตรี', sudden_noise: 'เสียงฉับพลัน', thunder: 'ฟ้าร้อง' } });
profilePageCopyFallback.vi = withProfileCopyBase({ liked: 'Âm thanh yêu thích', excluded: 'Âm thanh loại trừ', learnedSaved: 'Học từ âm thanh đã lưu', removeLearned: 'Xóa sở thích đã học', avoidCount: '{count} mục tránh', savePreferences: 'Lưu sở thích', memoryTitle: 'Bộ nhớ sở thích AI', memorySubtitle: 'Tín hiệu từ âm thanh đã lưu và phát lại', profileSignals: 'Tín hiệu hồ sơ', savedSounds: 'Âm thanh đã lưu', playbackFeedback: 'Phản hồi phát lại', avoidRules: 'Quy tắc tránh', thisWeek: 'Tuần này', privacy: 'Quyền riêng tư và bảo mật', support: 'Trợ giúp và hỗ trợ', credits: 'Ghi công và giấy phép âm thanh', accountTitle: 'Quản lý tài khoản', accountAuth: 'Đăng xuất, xóa tài khoản', accountGuest: 'Trạng thái khách', logoutAccount: 'Đăng xuất', deleteAccount: 'Xóa tài khoản', typeDelete: 'Nhập DELETE để xác nhận', deleteForever: 'Xóa tài khoản vĩnh viễn', sounds: { rain: 'Mưa', forest: 'Rừng', ocean: 'Đại dương', white_noise: 'Tiếng ồn trắng', brown_noise: 'Tiếng ồn nâu', wind: 'Gió', soft_music: 'Piano nhẹ', night: 'Ban đêm', water: 'Nước', voices: 'Giọng nói', birds: 'Chim', music: 'Âm nhạc', sudden_noise: 'Âm thanh đột ngột', thunder: 'Sấm' } });
profilePageCopyFallback.ms = withProfileCopyBase({ liked: 'Bunyi disukai', excluded: 'Bunyi dikecualikan', learnedSaved: 'Dipelajari daripada bunyi tersimpan', removeLearned: 'Buang pilihan dipelajari', avoidCount: '{count} dielakkan', savePreferences: 'Simpan pilihan', memoryTitle: 'Memori pilihan AI', memorySubtitle: 'Isyarat daripada bunyi tersimpan dan main balik', profileSignals: 'Isyarat profil', savedSounds: 'Bunyi tersimpan', playbackFeedback: 'Maklum balas main balik', avoidRules: 'Peraturan elak', thisWeek: 'Minggu ini', privacy: 'Privasi dan keselamatan', support: 'Bantuan dan sokongan', credits: 'Kredit dan lesen audio', accountTitle: 'Pengurusan akaun', accountAuth: 'Log keluar, padam akaun', accountGuest: 'Status tetamu', logoutAccount: 'Log keluar', deleteAccount: 'Padam akaun', typeDelete: 'Taip DELETE untuk mengesahkan', deleteForever: 'Padam akaun secara kekal', sounds: { rain: 'Hujan', forest: 'Hutan', ocean: 'Lautan', white_noise: 'Hingar putih', brown_noise: 'Hingar perang', wind: 'Angin', soft_music: 'Piano lembut', night: 'Malam', water: 'Air', voices: 'Suara', birds: 'Burung', music: 'Muzik', sudden_noise: 'Bunyi mengejut', thunder: 'Guruh' } });
profilePageCopyFallback.he = withProfileCopyBase({ liked: 'צלילים אהובים', excluded: 'צלילים שלא ייכללו', learnedSaved: 'נלמד מצלילים שמורים', removeLearned: 'הסרת העדפה שנלמדה', avoidCount: '{count} הימנעויות', savePreferences: 'שמירת העדפות', memoryTitle: 'זיכרון העדפות AI', memorySubtitle: 'אותות מצלילים שמורים ומהשמעה', profileSignals: 'אותות פרופיל', savedSounds: 'צלילים שמורים', playbackFeedback: 'משוב השמעה', avoidRules: 'כללי הימנעות', thisWeek: 'השבוע', privacy: 'פרטיות ואבטחה', support: 'עזרה ותמיכה', credits: 'קרדיטים ורישיונות שמע', accountTitle: 'ניהול חשבון', accountAuth: 'יציאה, מחיקת חשבון', accountGuest: 'מצב אורח', logoutAccount: 'יציאה מהחשבון', deleteAccount: 'מחיקת חשבון', typeDelete: 'הקלידו DELETE לאישור', deleteForever: 'מחיקת החשבון לצמיתות', sounds: { rain: 'גשם', forest: 'יער', ocean: 'אוקיינוס', white_noise: 'רעש לבן', brown_noise: 'רעש חום', wind: 'רוח', soft_music: 'פסנתר רך', night: 'לילה', water: 'מים', voices: 'קולות', birds: 'ציפורים', music: 'מוזיקה', sudden_noise: 'צלילים פתאומיים', thunder: 'רעם' } });
profilePageCopyFallback.da = withProfileCopyBase({ liked: 'Foretrukne lyde', excluded: 'Udelukkede lyde', learnedSaved: 'Lært fra gemte lyde', removeLearned: 'Fjern lært præference', avoidCount: '{count} fravalg', savePreferences: 'Gem præferencer', memoryTitle: 'AI-præferencehukommelse', memorySubtitle: 'Signaler fra gemte lyde og afspilning', profileSignals: 'Profilsignaler', savedSounds: 'Gemte lyde', playbackFeedback: 'Afspilningsfeedback', avoidRules: 'Fravalgsregler', thisWeek: 'Denne uge', privacy: 'Privatliv og sikkerhed', support: 'Hjælp og support', credits: 'Lydkreditering og licenser', accountTitle: 'Kontohåndtering', accountAuth: 'Log ud, slet konto', accountGuest: 'Gæstestatus', logoutAccount: 'Log ud', deleteAccount: 'Slet konto', typeDelete: 'Skriv DELETE for at bekræfte', deleteForever: 'Slet kontoen permanent', sounds: { rain: 'Regn', forest: 'Skov', ocean: 'Hav', white_noise: 'Hvid støj', brown_noise: 'Brun støj', wind: 'Vind', soft_music: 'Blødt klaver', night: 'Nat', water: 'Vand', voices: 'Stemmer', birds: 'Fugle', music: 'Musik', sudden_noise: 'Pludselige lyde', thunder: 'Torden' } });
profilePageCopyFallback.no = withProfileCopyBase({ liked: 'Likede lyder', excluded: 'Utelatte lyder', learnedSaved: 'Lært fra lagrede lyder', removeLearned: 'Fjern lært preferanse', avoidCount: '{count} unntak', savePreferences: 'Lagre preferanser', memoryTitle: 'AI-preferanseminne', memorySubtitle: 'Signaler fra lagrede lyder og avspilling', profileSignals: 'Profilsignaler', savedSounds: 'Lagrede lyder', playbackFeedback: 'Avspillingsfeedback', avoidRules: 'Unntaksregler', thisWeek: 'Denne uken', privacy: 'Personvern og sikkerhet', support: 'Hjelp og støtte', credits: 'Lydkreditering og lisenser', accountTitle: 'Kontoadministrasjon', accountAuth: 'Logg ut, slett konto', accountGuest: 'Gjestestatus', logoutAccount: 'Logg ut', deleteAccount: 'Slett konto', typeDelete: 'Skriv DELETE for å bekrefte', deleteForever: 'Slett kontoen permanent', sounds: { rain: 'Regn', forest: 'Skog', ocean: 'Hav', white_noise: 'Hvit støy', brown_noise: 'Brun støy', wind: 'Vind', soft_music: 'Mykt piano', night: 'Natt', water: 'Vann', voices: 'Stemmer', birds: 'Fugler', music: 'Musikk', sudden_noise: 'Plutselige lyder', thunder: 'Torden' } });
profilePageCopyFallback.fi = withProfileCopyBase({ liked: 'Pidetyt äänet', excluded: 'Pois jätetyt äänet', learnedSaved: 'Opittu tallennetuista äänistä', removeLearned: 'Poista opittu asetus', avoidCount: '{count} poissulkua', savePreferences: 'Tallenna asetukset', memoryTitle: 'Tekoälyn asetusmuisti', memorySubtitle: 'Signaalit tallennetuista äänistä ja toistosta', profileSignals: 'Profiilisignaalit', savedSounds: 'Tallennetut äänet', playbackFeedback: 'Toistopalaute', avoidRules: 'Poissulkusäännöt', thisWeek: 'Tällä viikolla', privacy: 'Tietosuoja ja turvallisuus', support: 'Ohje ja tuki', credits: 'Äänikrediitit ja lisenssit', accountTitle: 'Tilin hallinta', accountAuth: 'Kirjaudu ulos, poista tili', accountGuest: 'Vierastila', logoutAccount: 'Kirjaudu ulos', deleteAccount: 'Poista tili', typeDelete: 'Vahvista kirjoittamalla DELETE', deleteForever: 'Poista tili pysyvästi', sounds: { rain: 'Sade', forest: 'Metsä', ocean: 'Meri', white_noise: 'Valkoinen kohina', brown_noise: 'Ruskea kohina', wind: 'Tuuli', soft_music: 'Pehmeä piano', night: 'Yö', water: 'Vesi', voices: 'Äänet', birds: 'Linnut', music: 'Musiikki', sudden_noise: 'Äkilliset äänet', thunder: 'Ukkonen' } });

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { t, goalLabel, formatMinutes, locale } = useI18n();
  const copy = profilePageCopy[locale] ?? profilePageCopy.en;
  const likedSoundsLabel = copy.liked;
  const excludedSoundsLabel = copy.excluded;
  const learnedFromSavedSoundsLabel = copy.learnedSaved;
  const removeLearnedPreferenceLabel = copy.removeLearned;
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof api.getBilling>> | null>(null);
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(() => readLanguagePreference());
  const resolvedLanguage = resolveLanguagePreference(languagePreference);
  const [soundProfile, setSoundProfile] = useState<UserSoundProfile | null>(null);
  const [preferenceEvidence, setPreferenceEvidence] = useState<PreferenceEvidence[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [removingEvidenceId, setRemovingEvidenceId] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => hasAuthToken());
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSection, setOpenSection] = useState<'memory' | 'account' | null>(null);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const preferenceSectionRef = useRef<HTMLElement>(null);
  const accountSectionRef = useRef<HTMLElement>(null);

  const toggleSection = (section: 'memory' | 'account') => {
    setOpenSection((current) => (current === section ? null : section));
  };

  useEffect(() => {
    api.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setAuthenticated(hasAuthToken());
    }).catch((error) => console.warn('Failed to load account:', error));
    api.getBilling().then(setBilling).catch((error) => console.warn('Failed to load billing:', error));
    api.getSoundProfile()
      .then(({ profile, evidence }) => {
        setSoundProfile(profile);
        setPreferenceEvidence(evidence);
      })
      .catch((error) => console.warn('Failed to load sound profile:', error))
      .finally(() => setProfileLoading(false));
  }, []);

  const draftProfile = useMemo(() => soundProfile ?? {
    userId: user?.id ?? '',
    likedSounds: [],
    excludedSounds: [],
    defaultGoal: 'sleep' as ProductGoal,
    defaultDurationSeconds: 900,
    sensitivity: {},
    updatedAt: new Date().toISOString(),
  }, [soundProfile, user?.id]);

  const preferenceSummary = profileLoading
    ? copy.loadingLearned
    : `${goalLabel(draftProfile.defaultGoal)} · ${formatMinutes(draftProfile.defaultDurationSeconds)}${draftProfile.excludedSounds.length ? ` · ${copy.avoidCount.replace('{count}', String(draftProfile.excludedSounds.length))}` : ''}`;
  const displayName = user?.username && user.username.toLowerCase() !== 'guest'
    ? user.username
    : t('profile.title');
  const learnedSavedSoundEvidence = preferenceEvidence
    .filter((item) => item.source === 'saved_sound' && item.kind === 'like' && item.value.startsWith('internal_baseline:'))
    .slice(0, 6);
  const learnedBehaviorEvidence = preferenceEvidence
    .filter((item) => item.source === 'playback_behavior')
    .slice(0, 8);
  const removableLearnedEvidence = preferenceEvidence
    .filter((item) => item.source !== 'explicit_profile')
    .slice(0, 10);
  const stableExclusions = preferenceEvidence.filter((item) => item.kind === 'exclusion' && item.stable);
  const recentEvidence = preferenceEvidence.filter((item) => isWithinDays(item.createdAt, 7));
  const profileStats = {
    explicit: preferenceEvidence.filter((item) => item.source === 'explicit_profile').length,
    saved: preferenceEvidence.filter((item) => item.source === 'saved_sound').length,
    playback: preferenceEvidence.filter((item) => item.source === 'playback_behavior').length,
    avoids: stableExclusions.length,
  };
  const weeklyInsight = {
    fit: recentEvidence.filter((item) => item.source === 'playback_behavior' && item.kind === 'like').length,
    saved: recentEvidence.filter((item) => item.source === 'saved_sound').length,
    adjusted: recentEvidence.filter((item) => item.source === 'playback_behavior' && item.kind === 'sensitivity').length,
    avoided: recentEvidence.filter((item) => item.kind === 'exclusion').length,
  };

  const updateLanguagePreference = (preference: LanguagePreference) => {
    setLanguagePreference(preference);
    writeLanguagePreference(preference);
  };

  const scrollToPreferences = () => {
    setIsEditingPreferences(true);
    preferenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToAccount = () => {
    setOpenSection('account');
    accountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveSoundProfile = async () => {
    if (profileSaving) return;
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const result = await api.updateSoundProfile({
        likedSounds: draftProfile.likedSounds,
        excludedSounds: draftProfile.excludedSounds,
        defaultGoal: draftProfile.defaultGoal,
        defaultDurationSeconds: draftProfile.defaultDurationSeconds,
        sensitivity: draftProfile.sensitivity,
      });
      setSoundProfile(result.profile);
      setPreferenceEvidence(result.evidence);
      setProfileMessage(copy.savedStacked);
      setIsEditingPreferences(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      setProfileSaving(false);
    }
  };

  const removePreferenceEvidence = async (id: string) => {
    if (removingEvidenceId) return;
    setRemovingEvidenceId(id);
    setProfileMessage('');
    setProfileError('');
    try {
      const result = await api.deletePreferenceEvidence(id);
      setSoundProfile(result.profile);
      setPreferenceEvidence(result.evidence);
      setProfileMessage(copy.removed);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : copy.removeFailed);
    } finally {
      setRemovingEvidenceId(null);
    }
  };

  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      clearAuthToken();
      await clearLocalListeningData();
      setAuthenticated(false);
      navigate('/listen', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await api.deleteAccount();
      clearAuthToken();
      await clearLocalListeningData();
      setAccountDeleted(true);
      setShowDeleteAccount(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Your account could not be deleted.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <main style={{ flex: 1, padding: '28px var(--space-6) 116px', overflowY: 'auto' }}>
        <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="ambient-glow" />
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15 }}>{t('profile.title')}</h1>
          <button type="button" className="btn-icon interactive-card" onClick={scrollToAccount} aria-label={copy.accountTitle} title={copy.accountTitle} style={{ width: 44, height: 44, background: 'var(--surface-1)' }}>
            <Settings size={20} />
          </button>
        </header>

        {/* UNIFIED HERO CARD: Account Identity + Upgrade Plan */}
        <section className="glass-panel-heavy interactive-card" style={{ padding: 20, marginBottom: 24, border: '1px solid rgba(148,116,255,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: 'var(--primary)', filter: 'blur(70px)', opacity: 0.25, borderRadius: '50%' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, rgba(148,116,255,0.25), rgba(46,229,245,0.25))', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.15)' }}>
                <Moon size={26} />
              </span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 18, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </strong>
                <span className="text-xs text-secondary">
                  {authenticated ? copy.accountAuth : copy.accountGuest}
                </span>
              </div>
            </div>
            {authenticated && (
              <button type="button" onClick={logOut} disabled={loggingOut} style={{ minHeight: 32, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: loggingOut ? 'default' : 'pointer' }}>
                {loggingOut ? copy.savingPreferences : copy.logoutAccount}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {billing?.tier === 'pro' ? (
                <span className="pro-badge-yellow" style={{ flexShrink: 0 }}>
                  <Crown size={14} fill="#000000" />
                </span>
              ) : (
                <Crown size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
              )}
              <div>
                <strong style={{ display: 'block', fontSize: 15 }}>{billing?.tier === 'pro' ? 'MixStil PRO' : copy.accountGuest}</strong>
                <span className="text-xs text-secondary">
                  {billing?.tier === 'pro'
                    ? copy.savedSounds
                    : String(billing?.generation.remaining ?? 3)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/creator/upgrade')}
              className="interactive-card"
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--radius-pill)',
                flexShrink: 0,
                background: billing?.tier === 'pro' ? 'var(--surface-2)' : 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                color: '#FFFFFF',
                boxShadow: billing?.tier === 'pro' ? 'none' : '0 4px 14px rgba(124, 58, 237, 0.5)',
                border: billing?.tier === 'pro' ? '1px solid var(--surface-border)' : 'none',
                cursor: 'pointer'
              }}
            >
              {copy.accountTitle}
            </button>
          </div>
        </section>

        {/* CORE FOCUS: Personal Preferences (Collapsed by Default, Expands on Edit) */}
        <section ref={preferenceSectionRef} className="glass-panel" style={{ padding: 20, marginBottom: 24, display: 'grid', gap: 16, border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SlidersHorizontal size={20} color="var(--primary)" />
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{copy.profileSignals}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-xs text-secondary">{preferenceSummary}</span>
              <button
                type="button"
                className="interactive-card"
                onClick={scrollToPreferences}
                style={{
                  minHeight: 32,
                  padding: '0 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--surface-border)',
                  background: isEditingPreferences ? 'rgba(148,116,255,0.18)' : 'var(--surface-1)',
                  color: isEditingPreferences ? 'var(--primary)' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isEditingPreferences ? copy.remove : copy.savePreferences}
              </button>
            </div>
          </div>

          {profileMessage && <p className="text-sm" style={{ color: 'var(--primary)', margin: 0 }}>{profileMessage}</p>}

          {!isEditingPreferences ? (
            /* COLLAPSED / STACKED SUMMARY VIEW */
            <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
              <div style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{copy.liked}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {draftProfile.likedSounds.length === 0 ? (
                      <span className="text-xs text-secondary">{copy.liked}</span>
                    ) : (
                      draftProfile.likedSounds.map((item) => (
                        <span key={item} style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(148,116,255,0.18)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, border: '1px solid rgba(148,116,255,0.3)' }}>
                          {item.replaceAll('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <span className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{copy.excluded}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {draftProfile.excludedSounds.length === 0 ? (
                      <span className="text-xs text-secondary">{copy.excluded}</span>
                    ) : (
                      draftProfile.excludedSounds.map((item) => (
                        <span key={item} style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,100,100,0.15)', color: '#ff8095', fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,100,100,0.3)' }}>
                          {item.replaceAll('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <span className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{copy.defaultGoal} · {copy.defaultDuration}</span>
                  <span className="text-xs" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {goalLabel(draftProfile.defaultGoal)} · {formatMinutes(draftProfile.defaultDurationSeconds)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary interactive-card"
                onClick={() => setIsEditingPreferences(true)}
                style={{ width: '100%', minHeight: 42, fontSize: 13 }}
              >
                <SlidersHorizontal size={16} /> {copy.savePreferences}
              </button>
            </div>
          ) : (
            /* EXPANDED OPTION CHIPS EDITOR */
            <div style={{ display: 'grid', gap: 18, paddingTop: 4 }}>
              {/* Liked Sounds Option Chips */}
              <div aria-label={likedSoundsLabel} style={{ display: 'grid', gap: 10 }}>
                <div>
                  <strong style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{copy.liked}</strong>
                  <span className="text-xs text-secondary">{copy.memorySubtitle}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { value: 'rain', label: copy.sounds.rain },
                    { value: 'forest', label: copy.sounds.forest },
                    { value: 'ocean', label: copy.sounds.ocean },
                    { value: 'white_noise', label: copy.sounds.white_noise },
                    { value: 'brown_noise', label: copy.sounds.brown_noise },
                    { value: 'wind', label: copy.sounds.wind },
                    { value: 'soft_music', label: copy.sounds.soft_music },
                    { value: 'night', label: copy.sounds.night },
                  ].map((option) => {
                    const isSelected = draftProfile.likedSounds.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="interactive-card"
                        aria-pressed={isSelected}
                        onClick={() => {
                          const nextLiked = isSelected
                            ? draftProfile.likedSounds.filter((item) => item !== option.value)
                            : [...draftProfile.likedSounds, option.value];
                          setSoundProfile((current) => ({ ...(current ?? draftProfile), likedSounds: nextLiked }));
                        }}
                        style={{
                          minHeight: 38,
                          padding: '0 14px',
                          borderRadius: 'var(--radius-pill)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                          background: isSelected ? 'rgba(148,116,255,0.22)' : 'var(--surface-1)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: isSelected ? 700 : 500,
                          boxShadow: isSelected ? '0 0 12px var(--primary-glow)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  {draftProfile.likedSounds
                    .filter((item) => !['rain', 'forest', 'ocean', 'white_noise', 'brown_noise', 'wind', 'soft_music', 'night'].includes(item))
                    .map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="interactive-card"
                        onClick={() => {
                          const nextLiked = draftProfile.likedSounds.filter((tag) => tag !== item);
                          setSoundProfile((current) => ({ ...(current ?? draftProfile), likedSounds: nextLiked }));
                        }}
                        style={{
                          minHeight: 38,
                          padding: '0 14px',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--primary)',
                          background: 'rgba(148,116,255,0.22)',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {item} ✕
                      </button>
                    ))}
                </div>
              </div>

              {/* Excluded Sounds Option Chips */}
              <div aria-label={excludedSoundsLabel} style={{ display: 'grid', gap: 10 }}>
                <div>
                  <strong style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{copy.excluded}</strong>
                  <span className="text-xs text-secondary">{copy.avoidRules}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { value: 'water', label: copy.sounds.water },
                    { value: 'rain', label: copy.sounds.rain },
                    { value: 'wind', label: copy.sounds.wind },
                    { value: 'voices', label: copy.sounds.voices },
                    { value: 'birds', label: copy.sounds.birds },
                    { value: 'music', label: copy.sounds.music },
                    { value: 'sudden_noise', label: copy.sounds.sudden_noise },
                    { value: 'thunder', label: copy.sounds.thunder },
                  ].map((option) => {
                    const isSelected = draftProfile.excludedSounds.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="interactive-card"
                        aria-pressed={isSelected}
                        onClick={() => {
                          const nextExcluded = isSelected
                            ? draftProfile.excludedSounds.filter((item) => item !== option.value)
                            : [...draftProfile.excludedSounds, option.value];
                          setSoundProfile((current) => ({ ...(current ?? draftProfile), excludedSounds: nextExcluded }));
                        }}
                        style={{
                          minHeight: 38,
                          padding: '0 14px',
                          borderRadius: 'var(--radius-pill)',
                          border: isSelected ? '1px solid rgba(255,100,100,0.6)' : '1px solid var(--surface-border)',
                          background: isSelected ? 'rgba(255,100,100,0.18)' : 'var(--surface-1)',
                          color: isSelected ? '#ff8095' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: isSelected ? 700 : 500,
                          boxShadow: isSelected ? '0 0 12px rgba(255,100,100,0.25)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  {draftProfile.excludedSounds
                    .filter((item) => !['water', 'rain', 'wind', 'voices', 'birds', 'music', 'sudden_noise', 'thunder'].includes(item))
                    .map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="interactive-card"
                        onClick={() => {
                          const nextExcluded = draftProfile.excludedSounds.filter((tag) => tag !== item);
                          setSoundProfile((current) => ({ ...(current ?? draftProfile), excludedSounds: nextExcluded }));
                        }}
                        style={{
                          minHeight: 38,
                          padding: '0 14px',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid rgba(255,100,100,0.6)',
                          background: 'rgba(255,100,100,0.18)',
                          color: '#ff8095',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {item} ✕
                      </button>
                    ))}
                </div>
              </div>

              {/* Goal & Duration Options */}
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{copy.defaultGoal}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(['sleep', 'calm', 'focus'] as ProductGoal[]).map((goalOption) => {
                      const isSelected = draftProfile.defaultGoal === goalOption;
                      return (
                        <button
                          key={goalOption}
                          type="button"
                          className="interactive-card"
                          onClick={() => setSoundProfile((current) => ({ ...(current ?? draftProfile), defaultGoal: goalOption }))}
                          style={{
                            minHeight: 40,
                            borderRadius: 'var(--radius-sm)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                            background: isSelected ? 'rgba(148,116,255,0.18)' : 'var(--surface-1)',
                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 13,
                            textTransform: 'capitalize',
                          }}
                        >
                          {goalLabel(goalOption)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{copy.defaultDuration}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { seconds: 300, label: formatMinutes(300) },
                      { seconds: 600, label: formatMinutes(600) },
                      { seconds: 900, label: formatMinutes(900) },
                      { seconds: 1800, label: formatMinutes(1800) },
                      { seconds: 2700, label: formatMinutes(2700) },
                      { seconds: 3600, label: formatMinutes(3600) },
                    ].map((option) => {
                      const isSelected = draftProfile.defaultDurationSeconds === option.seconds;
                      return (
                        <button
                          key={option.seconds}
                          type="button"
                          className="interactive-card"
                          onClick={() => setSoundProfile((current) => ({ ...(current ?? draftProfile), defaultDurationSeconds: option.seconds }))}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 'var(--radius-pill)',
                            border: isSelected ? '1px solid var(--accent)' : '1px solid var(--surface-border)',
                            background: isSelected ? 'rgba(46,229,245,0.14)' : 'var(--surface-1)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button type="button" className="btn btn-primary" onClick={saveSoundProfile} disabled={profileSaving || profileLoading} style={{ width: '100%', minHeight: 46, marginTop: 4 }}>
                <Save size={18} />
                {profileSaving ? copy.savingPreferences : copy.savePreferences}
              </button>
              {profileError && <p role="alert" style={{ color: '#ffd3d3', margin: 0 }}>{profileError}</p>}
            </div>
          )}
        </section>

        {/* ACCORDION 1: AI Preference Memory */}
        <section style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="glass-panel interactive-card"
            onClick={() => toggleSection('memory')}
            style={{ width: '100%', padding: '16px 20px', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkles size={19} color="var(--primary)" />
              <div>
                <strong style={{ display: 'block', fontSize: 15 }}>{copy.memoryTitle}</strong>
                <span className="text-xs text-secondary">{copy.memorySubtitle}</span>
              </div>
            </div>
            {openSection === 'memory' ? <ChevronDown size={18} color="var(--text-secondary)" /> : <ChevronRight size={18} color="var(--text-secondary)" />}
          </button>

          {openSection === 'memory' && (
            <div className="glass-panel" style={{ padding: 18, marginTop: 8, display: 'grid', gap: 16, borderTop: 0 }}>
              <section aria-label={copy.memorySummary} style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    { label: copy.profileSignals, value: profileStats.explicit, icon: SlidersHorizontal },
                    { label: copy.savedSounds, value: profileStats.saved, icon: Sparkles },
                    { label: copy.playbackFeedback, value: profileStats.playback, icon: History },
                    { label: copy.avoidRules, value: profileStats.avoids, icon: Ban },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} style={{ minHeight: 76, padding: 12, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', display: 'grid', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <Icon size={16} color="var(--primary)" />
                          <strong style={{ fontSize: 20 }}>{profileLoading ? '-' : item.value}</strong>
                        </span>
                        <span className="text-xs text-secondary">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(140,106,255,0.24)', background: 'rgba(140,106,255,0.08)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{copy.thisWeek}</strong>
                    <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.45 }}>
                      {profileLoading
                        ? copy.weeklyLoading
                        : recentEvidence.length === 0
                          ? copy.weeklyEmpty
                          : copy.weeklySummary
                            .replace('{fit}', String(weeklyInsight.fit))
                            .replace('{saved}', String(weeklyInsight.saved))
                            .replace('{adjusted}', String(weeklyInsight.adjusted))
                            .replace('{avoided}', String(weeklyInsight.avoided))}
                    </p>
                  </div>
                </div>
              </section>

              <section aria-label={learnedFromSavedSoundsLabel} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(140,106,255,0.24)', background: 'rgba(140,106,255,0.08)' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{copy.learnedSaved}</strong>
                  <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.45 }}>
                    {copy.savedLearnHelp}
                  </p>
                </div>
                {profileLoading ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.loadingLearned}</p>
                ) : learnedSavedSoundEvidence.length === 0 ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.savedLearnEmpty}</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {learnedSavedSoundEvidence.map((evidence) => (
                      <article key={evidence.id} style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{savedSoundLearningLabel(evidence)}</strong>
                            <p className="text-xs text-secondary" style={{ margin: '4px 0 0', lineHeight: 1.45 }}>{copy.savedLearnHelp}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`${removeLearnedPreferenceLabel}: ${savedSoundLearningLabel(evidence)}`}
                            onClick={() => void removePreferenceEvidence(evidence.id)}
                            disabled={Boolean(removingEvidenceId)}
                            style={{ minWidth: 76, height: 34, borderRadius: 999, border: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.07)', color: removingEvidenceId === evidence.id ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: removingEvidenceId ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            {removingEvidenceId === evidence.id ? copy.removing : copy.remove}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section aria-label={copy.playbackLearned} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-1)' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{copy.playbackLearned}</strong>
                  <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.45 }}>
                    {copy.playbackHelp}
                  </p>
                </div>
                {profileLoading ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.loadingLearned}</p>
                ) : learnedBehaviorEvidence.length === 0 ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.playbackEmpty}</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {learnedBehaviorEvidence.slice(0, 4).map((evidence) => (
                      <article key={evidence.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span className="text-xs text-secondary">{kindLabel(evidence, copy)}</span>
                          <strong style={{ display: 'block', fontSize: 13, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{learnedSignalTitle(evidence, copy)}</strong>
                          <p className="text-xs text-secondary" style={{ margin: '4px 0 0', lineHeight: 1.45 }}>{learnedSignalDescription(evidence, copy)}</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`${removeLearnedPreferenceLabel}: ${learnedSignalTitle(evidence, copy)}`}
                          onClick={() => void removePreferenceEvidence(evidence.id)}
                          disabled={Boolean(removingEvidenceId)}
                          style={{ minWidth: 76, height: 34, borderRadius: 999, border: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.07)', color: removingEvidenceId === evidence.id ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: removingEvidenceId ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}
                        >
                          {removingEvidenceId === evidence.id ? copy.removing : copy.remove}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section aria-label={copy.allSignals} style={{ display: 'grid', gap: 10 }}>
                <strong style={{ display: 'block' }}>{copy.allSignals}</strong>
                {profileLoading ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.loadingLearned}</p>
                ) : removableLearnedEvidence.length === 0 ? (
                  <p className="text-sm text-secondary" style={{ margin: 0 }}>{copy.allSignalsEmpty}</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {removableLearnedEvidence.slice(0, 5).map((evidence) => (
                      <article key={evidence.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.04)' }}>
                        <div style={{ minWidth: 0 }}>
                          <span className="text-xs text-secondary">{sourceLabel(evidence.source, copy)} · {kindLabel(evidence, copy)}</span>
                          <strong style={{ display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{learnedSignalTitle(evidence, copy)}</strong>
                        </div>
                        <button
                          type="button"
                          aria-label={`${removeLearnedPreferenceLabel}: ${learnedSignalTitle(evidence, copy)}`}
                          onClick={() => void removePreferenceEvidence(evidence.id)}
                          disabled={Boolean(removingEvidenceId)}
                          style={{ minWidth: 76, height: 34, borderRadius: 999, border: '1px solid var(--surface-border)', background: 'transparent', color: removingEvidenceId === evidence.id ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: removingEvidenceId ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}
                        >
                          {removingEvidenceId === evidence.id ? copy.removing : copy.remove}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>

        <section data-testid="profile-language-setting" className="glass-panel" aria-label={t('profile.language')} style={{ padding: '12px 16px', marginBottom: 16, border: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(150px, 44%)', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Languages size={19} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 15 }}>{t('profile.language')}</strong>
                <span className="text-xs text-secondary" style={{ display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {languagePreference === 'system'
                    ? `${t('profile.followSystem')} · ${localeName(resolvedLanguage)}`
                    : localeName(resolvedLanguage)}
                </span>
              </div>
            </div>
            <select
              id="language-preference"
              data-testid="profile-language-select"
              value={languagePreference}
              onChange={(event) => updateLanguagePreference(event.target.value as LanguagePreference)}
              aria-label={t('profile.language')}
              style={{
                width: '100%',
                minWidth: 0,
                height: 42,
                borderRadius: 8,
                border: '1px solid var(--surface-border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                padding: '0 10px',
                fontSize: 14,
                fontWeight: 650,
              }}
            >
              <option value="system">{t('profile.followSystem')}</option>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.nativeLabel}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="glass-panel" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <button type="button" onClick={() => navigate('/privacy')} style={{ width: '100%', minHeight: 56, padding: '0 18px', border: 0, borderBottom: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
            <Shield size={19} color="var(--primary)" />
            <span style={{ flex: 1, fontWeight: 550 }}>{copy.privacy}</span>
            <ChevronRight size={17} color="var(--text-secondary)" />
          </button>
          <button type="button" onClick={() => navigate('/support')} style={{ width: '100%', minHeight: 56, padding: '0 18px', border: 0, borderBottom: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
            <CircleHelp size={19} color="var(--primary)" />
            <span style={{ flex: 1, fontWeight: 550 }}>{copy.support}</span>
            <ChevronRight size={17} color="var(--text-secondary)" />
          </button>
          <button type="button" onClick={() => navigate('/audio-credits')} style={{ width: '100%', minHeight: 56, padding: '0 18px', border: 0, background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer' }}>
            <FileText size={19} color="var(--primary)" />
            <span style={{ flex: 1, fontWeight: 550 }}>{copy.credits}</span>
            <ChevronRight size={17} color="var(--text-secondary)" />
          </button>
        </section>

        {/* ACCORDION 2: Account Actions */}
        <section ref={accountSectionRef} style={{ marginBottom: 24 }}>
          <button
            type="button"
            className="glass-panel interactive-card"
            onClick={() => toggleSection('account')}
            style={{ width: '100%', padding: '16px 20px', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Settings size={19} color="var(--primary)" />
              <div>
                <strong style={{ display: 'block', fontSize: 15 }}>{copy.accountTitle}</strong>
                <span className="text-xs text-secondary">{authenticated ? copy.accountAuth : copy.accountGuest}</span>
              </div>
            </div>
            {openSection === 'account' ? <ChevronDown size={18} color="var(--text-secondary)" /> : <ChevronRight size={18} color="var(--text-secondary)" />}
          </button>

          {openSection === 'account' && (
            <div className="glass-panel" style={{ padding: 0, marginTop: 8, overflow: 'hidden', borderTop: 0 }}>
              {accountDeleted ? (
                <p role="status" style={{ padding: 16, color: 'var(--text-secondary)', margin: 0 }}>{copy.accountDeleted}</p>
              ) : authenticated ? (
                <>
                  <button type="button" onClick={logOut} disabled={loggingOut} style={{ width: '100%', minHeight: 56, padding: '0 18px', border: 0, borderBottom: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 13, cursor: loggingOut ? 'default' : 'pointer' }}>
                    <LogOut size={19} />
                    <span style={{ fontWeight: 600 }}>{loggingOut ? copy.savingPreferences : copy.logoutAccount}</span>
                  </button>
                  <button type="button" onClick={() => setShowDeleteAccount(true)} style={{ width: '100%', minHeight: 56, padding: '0 18px', border: 0, background: 'transparent', color: '#ff8585', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
                    <Trash2 size={19} />
                    <span style={{ fontWeight: 600 }}>{copy.deleteAccount}</span>
                  </button>
                </>
              ) : (
                <p className="text-sm text-secondary" style={{ padding: '16px', margin: 0 }}>{copy.guestStatus}</p>
              )}
            </div>
          )}
        </section>
      </main>
      <BottomNav activeTab="profile" />
      {showDeleteAccount && (
        <div className="adjust-sheet-backdrop" onClick={() => setShowDeleteAccount(false)}>
          <section className="adjust-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" onClick={(event) => event.stopPropagation()}>
            <div className="ai-adjust-header">
              <div>
                <h3 id="delete-account-title">{copy.deleteTitle}</h3>
                <p>{copy.deleteBody}</p>
              </div>
              <button className="ai-adjust-close" onClick={() => setShowDeleteAccount(false)} aria-label={copy.closeDelete}><X size={18} /></button>
            </div>
            <label style={{ display: 'grid', gap: 8, marginTop: 18 }}>
              <span className="text-sm">{copy.typeDelete}</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoCapitalize="characters" style={{ height: 44, borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 11px' }} />
            </label>
            {deleteError && <p role="alert" style={{ color: '#ffd3d3', marginTop: 10 }}>{deleteError}</p>}
            <button type="button" className="btn" disabled={deleteConfirmation !== 'DELETE' || deletingAccount} onClick={deleteAccount} style={{ width: '100%', marginTop: 16, background: '#a93434', color: '#fff' }}>
              <Trash2 size={17} /> {deletingAccount ? copy.deleting : copy.deleteForever}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
