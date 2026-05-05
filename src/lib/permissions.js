/**
 * permissions.js
 *
 * Sistem genelindeki modül-aksiyon yetki haritası.
 * UsersPage'de kullanıcıya yetki atarken bu liste seçenek olarak gösterilir.
 * useAuth().can(modul, aksiyon) bu listeyi referans alır.
 */

export const ALL_MODULES = [
  {
    key: 'dashboard',
    ad: 'Ana Ekran',
    icon: 'layout-dashboard',
    actions: ['goruntule']
  },
  {
    key: 'rezervasyon',
    ad: 'Rezervasyonlar',
    icon: 'book-open',
    actions: ['goruntule', 'ekle', 'duzenle', 'sil', 'iptal']
  },
  {
    key: 'takvim',
    ad: 'Takvim',
    icon: 'calendar-days',
    actions: ['goruntule']
  },
  {
    key: 'misafirler',
    ad: 'Misafirler',
    icon: 'users',
    actions: ['goruntule', 'ekle', 'duzenle', 'sil']
  },
  {
    key: 'odalar',
    ad: 'Odalar',
    icon: 'door-open',
    actions: ['goruntule', 'ekle', 'duzenle', 'sil']
  },
  {
    key: 'onMuhasebe',
    ad: 'Ön Muhasebe',
    icon: 'wallet',
    actions: ['goruntule', 'tahsilat', 'transfer', 'hesap-yonet']
  },
  {
    key: 'giderler',
    ad: 'Giderler',
    icon: 'receipt',
    actions: ['goruntule', 'ekle', 'duzenle', 'sil']
  },
  {
    key: 'raporlar',
    ad: 'Raporlar',
    icon: 'bar-chart-3',
    actions: ['goruntule', 'export']
  },
  {
    key: 'ayarlar',
    ad: 'Ayarlar',
    icon: 'settings',
    actions: ['goruntule', 'duzenle']
  },
  {
    key: 'kullanicilar',
    ad: 'Kullanıcılar',
    icon: 'user-cog',
    actions: ['goruntule', 'ekle', 'duzenle', 'sil'],
    hideFromSidebar: true  // Sadece superadmin görür, sidebar'da çıkmaz; Settings içinde
  }
];

export const AKSIYON_LABELS = {
  goruntule:    'Görüntüle',
  ekle:         'Ekle',
  duzenle:      'Düzenle',
  sil:          'Sil',
  iptal:        'İptal',
  tahsilat:     'Tahsilat',
  transfer:     'Transfer',
  'hesap-yonet':'Hesap Yönet',
  export:       'Dışa Aktar'
};

export const ROLE_LABELS = {
  superadmin: 'Süper Admin',
  admin:      'Admin',
  kullanici:  'Kullanıcı'
};

/**
 * Bir modülün varsayılan tüm aksiyonlarını döndür (yeni admin için convenience).
 */
export const getAllActions = (modulKey) => {
  const m = ALL_MODULES.find(m => m.key === modulKey);
  return m ? m.actions : [];
};
