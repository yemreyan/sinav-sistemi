// examLinks.js — Seri (video) ↔ Sınav ilişkisi ve arşivin birlikte taşınması
//
// Bir seri birden fazla sınava bağlanabilir (videos.examIds[]). Eski kayıtlarda
// tekil videos.examId alanı kullanılıyordu; getExamIds ikisini de tek biçime getirir.
//
// Kural: bir sınav arşivlenince ona bağlı seriler de arşivlenir — ancak seri hâlâ
// aktif bir sınava bağlıysa dokunulmaz. Sınav geri alınınca yalnızca o arşivleme
// sırasında kapatılan seriler (archivedByExam alanı) geri açılır; elle arşivlenmiş
// seriler arşivde kalır.
const { db } = require('../config/firebase');

const getExamIds = (video) => {
    if (!video) return [];
    if (Array.isArray(video.examIds)) return video.examIds.filter(Boolean);
    return video.examId ? [video.examId] : [];
};

// Seri, giriş yapmamış kullanıcıya görünür mü?
// Arşivlenmişse ya da bağlı olduğu sınavların hepsi arşivlendiyse görünmez.
const isVideoPublic = (video, examsById) => {
    if (video.isArchived) return false;

    const examIds = getExamIds(video);
    if (examIds.length === 0) return true; // hiçbir sınava bağlı değil — eskisi gibi görünür

    return examIds.some((id) => examsById[id]?.status !== 'archived');
};

// Sınav arşivlendiğinde bağlı serileri de arşivler. Arşivlenen seri sayısını döner.
async function archiveVideosOfExam(examId) {
    const [videosSnap, examsSnap] = await Promise.all([
        db.ref('videos').once('value'),
        db.ref('exams').once('value')
    ]);

    const videos = videosSnap.val() || {};
    const exams = examsSnap.val() || {};

    const updates = {};
    let count = 0;

    for (const [videoId, video] of Object.entries(videos)) {
        if (video.isArchived) continue;

        const examIds = getExamIds(video);
        if (!examIds.includes(examId)) continue;

        // Başka bir aktif sınavda da kullanılıyorsa arşivleme
        const stillInUse = examIds.some((id) => id !== examId && exams[id]?.status === 'active');
        if (stillInUse) continue;

        updates[`${videoId}/isArchived`] = true;
        updates[`${videoId}/archivedByExam`] = examId;
        count++;
    }

    if (count > 0) await db.ref('videos').update(updates);
    return count;
}

// Sınav geri alındığında, o sınavla birlikte arşivlenmiş serileri geri açar.
async function restoreVideosOfExam(examId) {
    const videosSnap = await db.ref('videos').once('value');
    const videos = videosSnap.val() || {};

    const updates = {};
    let count = 0;

    for (const [videoId, video] of Object.entries(videos)) {
        if (!video.isArchived) continue;
        // Elle arşivlenmiş seriler (archivedByExam boş) arşivde kalır
        if (!video.archivedByExam) continue;
        // Sınav yeniden aktif olduğuna göre ona bağlı her seri de aktif bağ kazanır
        if (!getExamIds(video).includes(examId)) continue;

        updates[`${videoId}/isArchived`] = false;
        updates[`${videoId}/archivedByExam`] = null;
        count++;
    }

    if (count > 0) await db.ref('videos').update(updates);
    return count;
}

// Bir sınav arşivlenirse kaç serinin kapanacağını önceden söyler (onay ekranı için).
async function countVideosAffectedByArchive(examId) {
    const [videosSnap, examsSnap] = await Promise.all([
        db.ref('videos').once('value'),
        db.ref('exams').once('value')
    ]);

    const videos = videosSnap.val() || {};
    const exams = examsSnap.val() || {};

    return Object.values(videos).filter((video) => {
        if (video.isArchived) return false;
        const examIds = getExamIds(video);
        if (!examIds.includes(examId)) return false;
        return !examIds.some((id) => id !== examId && exams[id]?.status === 'active');
    }).length;
}

// ---- Podyumlar ----
// Podyum tek bir yarışmaya bağlıdır (podiums/<id>/examId). Yarışma arşivlenince
// podyum da kapatılır: hakem ekranı "yarışma sona erdi" der ve yeni puan kabul
// edilmez. Geri alındığında podyum IDLE'a döner (kendiliğinden puanlama açılmaz).

// Yarışma arşivlenince kapanacak podyumlar (zaten arşivli olanlar sayılmaz)
async function findOpenPodiumsOfExam(examId) {
    const snap = await db.ref('podiums').once('value');
    const podiums = snap.val() || {};

    return Object.entries(podiums)
        .filter(([, podium]) => podium.examId === examId && !podium.archivedByExam);
}

async function archivePodiumsOfExam(examId) {
    const targets = await findOpenPodiumsOfExam(examId);
    if (targets.length === 0) return [];

    const updates = {};
    for (const [podiumId] of targets) {
        updates[`${podiumId}/state/status`] = 'ARCHIVED';
        updates[`${podiumId}/state/activeVideoId`] = null;
        updates[`${podiumId}/state/startedAt`] = null;
        updates[`${podiumId}/archivedByExam`] = examId;
    }

    await db.ref('podiums').update(updates);
    return targets.map(([podiumId]) => podiumId);
}

async function restorePodiumsOfExam(examId) {
    const snap = await db.ref('podiums').once('value');
    const podiums = snap.val() || {};

    const targets = Object.entries(podiums).filter(([, p]) => p.archivedByExam === examId);
    if (targets.length === 0) return [];

    const updates = {};
    for (const [podiumId] of targets) {
        updates[`${podiumId}/state/status`] = 'IDLE';
        updates[`${podiumId}/archivedByExam`] = null;
    }

    await db.ref('podiums').update(updates);
    return targets.map(([podiumId]) => podiumId);
}

async function countPodiumsAffectedByArchive(examId) {
    const targets = await findOpenPodiumsOfExam(examId);
    return targets.length;
}

module.exports = {
    getExamIds,
    isVideoPublic,
    archiveVideosOfExam,
    restoreVideosOfExam,
    countVideosAffectedByArchive,
    archivePodiumsOfExam,
    restorePodiumsOfExam,
    countPodiumsAffectedByArchive
};
