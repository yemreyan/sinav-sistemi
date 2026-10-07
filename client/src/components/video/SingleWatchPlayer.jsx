import { useEffect, useRef, useState } from 'react';
import Player from '@vimeo/player';
import PropTypes from 'prop-types';

/**
 * Tek izlemelik video oynatıcı.
 *
 * Kontroller gizli, ileri/geri sarma engelli: hakem zaman çubuğunu kullanamaz,
 * bir şekilde atlarsa en ileri izlediği saniyeye geri alınır. Video bitince
 * onBitti çağrılır ve puanlama açılır.
 *
 * Tarayıcıda bu kuralın mutlak güvencesi yoktur — geliştirici araçlarını bilen
 * biri bağlantıyı alıp ayrı sekmede oynatabilir. Burada amaç sınav düzenini
 * korumak; asıl güvence salon gözetimidir.
 */
export default function SingleWatchPlayer({ url, onBitti, onBasladi, onAtla }) {
    const kutuRef = useRef(null);
    const playerRef = useRef(null);
    const enIleriRef = useRef(0);
    const [durum, setDurum] = useState('yukleniyor'); // yukleniyor | hazir | oynuyor | bitti | hata
    const [kalan, setKalan] = useState(null);

    useEffect(() => {
        if (!kutuRef.current || !url) return;
        let iptal = false;

        const player = new Player(kutuRef.current, {
            url,
            controls: false,      // zaman çubuğu yok
            keyboard: false,      // ok tuşlarıyla atlama yok
            pip: false,
            title: false,
            byline: false,
            portrait: false,
            responsive: true
        });
        playerRef.current = player;

        const zamanAsimi = setTimeout(() => {
            if (!iptal) setDurum(d => (d === 'yukleniyor' ? 'hata' : d));
        }, 12000);

        player.ready()
            .then(() => { if (!iptal) { clearTimeout(zamanAsimi); setDurum('hazir'); } })
            .catch(() => { if (!iptal) { clearTimeout(zamanAsimi); setDurum('hata'); } });

        // İleri sarma denemesini geri al
        player.on('timeupdate', ({ seconds, duration }) => {
            if (seconds > enIleriRef.current) enIleriRef.current = seconds;
            if (duration) setKalan(Math.max(0, Math.ceil(duration - seconds)));
        });

        player.on('seeked', ({ seconds }) => {
            // izlenen en ileri noktadan 1 sn'den fazla ileri gidilemez
            if (seconds > enIleriRef.current + 1) {
                player.setCurrentTime(enIleriRef.current).catch(() => {});
            }
        });

        player.on('play', () => { if (!iptal) setDurum('oynuyor'); });
        player.on('ended', () => {
            if (iptal) return;
            setDurum('bitti');
            onBitti?.();
        });
        player.on('error', () => { if (!iptal) setDurum('hata'); });

        return () => {
            iptal = true;
            clearTimeout(zamanAsimi);
            player.destroy().catch(() => {});
        };
    }, [url, onBitti]);

    const baslat = async () => {
        try {
            onBasladi?.();
            await playerRef.current?.play();
        } catch {
            setDurum('hata');
        }
    };

    if (!url) return null;

    return (
        <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black border border-white/10">
                <div ref={kutuRef} className="aspect-video w-full" />

                {/* oynatıcıya dokunmayı engelleyen katman — sağ tık ve tıklama ile duraklatma yok */}
                {durum === 'oynuyor' && (
                    <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                )}

                {durum !== 'oynuyor' && durum !== 'bitti' && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
                        {durum === 'yukleniyor' && <p className="text-white/60 text-sm">Video hazırlanıyor...</p>}
                        {durum === 'hata' && (
                            <>
                                <p className="text-red-400 text-sm font-semibold">Video açılamadı</p>
                                <p className="text-white/50 text-xs max-w-[300px]">
                                    Bağlantınızı kontrol edip sayfayı yenileyin. Sorun sürerse salon görevlisine
                                    bildirin — seriyi salondan izleyip puanlamaya geçebilirsiniz.
                                </p>
                                <button onClick={() => onAtla?.()}
                                    className="mt-1 border border-white/20 hover:bg-white/10 text-white/80 text-xs px-4 py-2 rounded-lg">
                                    Videosuz puanlamaya geç
                                </button>
                            </>
                        )}
                        {durum === 'hazir' && (
                            <>
                                <p className="text-white font-semibold">İzlemeye hazır</p>
                                <p className="text-white/50 text-xs max-w-[280px]">
                                    Video <b className="text-white/80">bir kez</b> oynatılır. Geri saramaz,
                                    duraklatamaz, tekrar açamazsınız.
                                </p>
                                <button onClick={baslat}
                                    className="mt-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2.5 rounded-lg">
                                    Videoyu başlat
                                </button>
                            </>
                        )}
                    </div>
                )}

                {durum === 'oynuyor' && kalan !== null && (
                    <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 border border-white/20 rounded-full px-3 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[11px] text-white/90 font-mono">{kalan} sn</span>
                    </div>
                )}
            </div>

            {durum === 'oynuyor' && (
                <p className="text-[11px] text-muted-foreground text-center">
                    Video bitince puanlama açılacak
                </p>
            )}
        </div>
    );
}

SingleWatchPlayer.propTypes = {
    url: PropTypes.string,
    onBitti: PropTypes.func,
    onBasladi: PropTypes.func,
    onAtla: PropTypes.func
};
