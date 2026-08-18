import { supabase } from '@/lib/supabase'

// Adim etiketleri (planlama + tablet + uretim takip sayfalarinda ortak kullanilir)
export const ADIM_LABEL: Record<string, string> = {
  baski: 'Baski', laminasyon_1: 'Laminasyon 1', laminasyon_2: 'Laminasyon 2', laminasyon_3: 'Laminasyon 3',
  kurleme_1: 'Kurleme 1', kurleme_2: 'Kurleme 2', kurleme_3: 'Kurleme 3',
  dilimleme: 'Dilimleme', katlama: 'Katlama', yan_kesim: 'Yan Kesim',
  doypack: 'Doypack', quadro: 'Quadro', flat_bottom: 'Flat Bottom',
  sirt_kaynak: 'Sirt Kaynak', sonic: 'Sonic', diger: 'Diger',
}

// adim_tur -> makine_tanim.tur eslesmesi. null olanlarin (kurleme) fiziksel
// bir makinesi/operatoru yok — bunlar bekleme surecidir, tablet panelinde
// hic gorunmezler ve operator onayi gerektirmezler.
export const ADIM_MAKINE_TUR: Record<string, string | null> = {
  baski: 'baski', laminasyon_1: 'laminasyon', laminasyon_2: 'laminasyon', laminasyon_3: 'laminasyon',
  kurleme_1: null, kurleme_2: null, kurleme_3: null,
  dilimleme: 'dilimleme', katlama: 'katlama', yan_kesim: 'yan_kesim',
  doypack: 'doypack', quadro: 'quadro', flat_bottom: 'flat_bottom',
  sirt_kaynak: 'sirt_kaynak', sonic: 'sonic', diger: 'diger',
}

/**
 * Bir proje planinda bir adim tamamlandiginda (veya plan ilk olusturuldugunda,
 * mevcutSira=0 verilerek) siradaki adimi "hazir" durumuna getirir — yani
 * operatorun tablet panelinde gorup BASLAT diyebilecegi hale getirir.
 *
 * Kurleme gibi makinesi olmayan (bekleme) adimlar otomatik olarak gecilir:
 * hicbir operator onayi istemeden dogrudan "tamamlandi" isaretlenir (baslangic
 * ve bitis o anki zaman olarak, sure planlanan_sure_dk varsa ondan alinarak
 * islenir) ve zincir bir sonraki gercek adima kadar devam eder. Boylece
 * kurlenme "bekleme suresinin kendisi" olarak islenmis olur, ayri bir is
 * adimi gibi davranmaz.
 *
 * Planlamaci sadece makine/tarih atamasi yapar; durum ilerletmesi tamamen
 * bu fonksiyon (otomatik) + operatorun tablet panelindeki BASLAT/BITIR
 * aksiyonlari (bkz. tablet/page.tsx) ile yurur.
 */
export async function sonrakiAdimiAc(projeId: string, mevcutSira: number) {
  let sira = mevcutSira + 1
  // Guvenlik: sonsuz donguye girmemesi icin makul bir ust sinir
  for (let guard = 0; guard < 20; guard++) {
    const { data: adim } = await supabase
      .from('uretim_plani')
      .select('*')
      .eq('proje_id', projeId)
      .eq('adim_sira', sira)
      .maybeSingle()
    if (!adim) return // rota bitti, acilacak baska adim yok

    const makineTur = ADIM_MAKINE_TUR[adim.adim_tur]
    if (makineTur === null) {
      // Bekleme adimi (kurleme): onay gerekmez, otomatik olarak "tamamlandi"
      // isaretlenip bir sonraki gercek adima gecilir.
      const simdi = new Date().toISOString()
      const sureDk = adim.planlanan_sure_dk || 0
      await supabase.from('uretim_plani').update({ durum: 'tamamlandi' }).eq('id', adim.id)
      await supabase.from('uretim_adim').insert({
        plan_id: adim.id, proje_id: projeId, makine_id: null,
        baslangic: simdi, bitis: simdi, sure_dk: sureDk,
        notlar: 'Otomatik gecis (bekleme/kurlenme adimi — operator onayi gerekmez).',
      })
      sira += 1
      continue
    }

    // Gercek (makineli) adim: operatorun tablet panelinde gorebilmesi icin hazir yap
    await supabase.from('uretim_plani').update({ durum: 'hazir' }).eq('id', adim.id)
    return
  }
}
