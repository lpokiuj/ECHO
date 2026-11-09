// All user-facing text of the public site lives here (Indonesian). Components never hard-code
// copy; tests and e2e specs import from this module. Everything below that says "akan diisi"
// is a placeholder: replace it with real content, never invent facts (addresses, numbers).
export const site = {
  brand: {
    name: 'ECHO',
    churchName: 'Echo Youth GLC',
    logoLabel: 'Echo, ke beranda',
    tagline: 'Tagline akan diisi',
  },

  titles: {
    home: 'Beranda',
    prayer: 'Kirim Pokok Doa',
    volunteer: 'Daftar Relawan',
    notFound: 'Halaman tidak ditemukan',
    error: 'Terjadi kesalahan',
  },

  a11y: {
    skipToContent: 'Lewati ke konten utama',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    close: 'Tutup',
    menuTitle: 'Menu',
    menuDescription: 'Navigasi situs Echo',
    mainNav: 'Navigasi utama',
    mobileNav: 'Navigasi seluler',
    footerNav: 'Navigasi kaki halaman',
    opensInNewTab: '(buka di tab baru)',
  },

  nav: {
    items: [
      { id: 'ibadah', label: 'Ibadah', to: '/#ibadah' },
      { id: 'lokasi', label: 'Lokasi', to: '/#lokasi' },
      { id: 'kegiatan', label: 'Kegiatan', to: '/#kegiatan' },
      { id: 'tentang', label: 'Tentang', to: '/#tentang' },
      { id: 'bidang', label: 'Bidang', to: '/#bidang' },
      { id: 'doa', label: 'Doa', to: '/doa' },
    ],
    cta: { label: 'Daftar Relawan', to: '/relawan' },
  },

  hero: {
    id: 'beranda',
    title: 'Echo Youth GLC',
    nextService: {
      label: 'Ibadah berikutnya',
      value: 'Jadwal ibadah berikutnya akan diisi',
    },
    primaryCta: { label: 'Datang Beribadah', to: '/#ibadah' },
    secondaryCta: { label: 'Kirim Pokok Doa', to: '/doa' },
  },

  // Home sections in page order (the hero comes first). F2 and F3 fill the bodies; the ids are
  // the nav anchors.
  sections: {
    worship: {
      id: 'ibadah',
      title: 'Ibadah',
      intro: 'Jadwal ibadah akan diisi.',
      schedule: {
        title: 'Jadwal ibadah',
        items: [
          {
            id: 'ibadah-1',
            name: 'Nama ibadah akan diisi',
            day: 'Hari akan diisi',
            time: 'Jam akan diisi',
          },
          {
            id: 'ibadah-2',
            name: 'Nama ibadah akan diisi',
            day: 'Hari akan diisi',
            time: 'Jam akan diisi',
          },
        ],
      },
      expect: {
        title: 'Apa yang bisa Anda harapkan',
        items: [
          { id: 'musik', title: 'Poin pertama akan diisi', text: 'Penjelasan akan diisi.' },
          { id: 'firman', title: 'Poin kedua akan diisi', text: 'Penjelasan akan diisi.' },
          { id: 'komunitas', title: 'Poin ketiga akan diisi', text: 'Penjelasan akan diisi.' },
          { id: 'ramah', title: 'Poin keempat akan diisi', text: 'Penjelasan akan diisi.' },
        ],
      },
    },
    location: {
      id: 'lokasi',
      title: 'Lokasi',
      intro: 'Alamat dan petunjuk arah akan diisi.',
      address: { title: 'Alamat', value: 'Alamat akan diisi' },
      transport: {
        title: 'Transportasi',
        items: [
          { id: 'angkutan-umum', text: 'Petunjuk angkutan umum akan diisi' },
          { id: 'kendaraan-pribadi', text: 'Petunjuk kendaraan pribadi akan diisi' },
        ],
      },
      parking: { title: 'Parkir', text: 'Informasi parkir akan diisi' },
      map: {
        // The only external URL on the site. The embed URL is built from it in src/lib/maps.ts.
        baseUrl: 'https://www.google.com/maps',
        // Placeholder search text: replace it with the real church address.
        query: 'Alamat akan diisi',
        title: 'Peta lokasi Echo Youth GLC',
        openLabel: 'Buka di Google Maps',
        fallback: 'Peta tidak tampil? Buka lokasi langsung di Google Maps.',
      },
    },
    events: {
      id: 'kegiatan',
      title: 'Kegiatan',
      intro: 'Daftar kegiatan akan diisi.',
      empty: 'Belum ada kegiatan yang dijadwalkan.',
      error: 'Kegiatan tidak dapat dimuat.',
      timezoneLabel: 'WIB',
    },
    about: {
      id: 'tentang',
      title: 'Tentang Echo',
      intro: 'Teks tentang Echo akan diisi.',
    },
    bidang: {
      id: 'bidang',
      title: 'Bidang Pelayanan',
      intro: 'Penjelasan bidang pelayanan akan diisi.',
    },
    prayer: {
      id: 'doa',
      title: 'Pokok Doa',
      intro: 'Ajakan untuk mengirim pokok doa akan diisi.',
      cta: 'Kirim Pokok Doa',
    },
    volunteer: {
      id: 'relawan',
      title: 'Jadi Relawan',
      intro: 'Ajakan untuk menjadi relawan akan diisi.',
      cta: 'Daftar Relawan',
    },
  },

  contact: {
    title: 'Kontak',
    address: 'Alamat akan diisi',
    whatsapp: 'Nomor WhatsApp akan diisi',
    email: 'Email akan diisi',
  },

  socials: {
    title: 'Media sosial',
    items: [
      { id: 'instagram', label: 'Instagram', handle: 'Akun akan diisi' },
      { id: 'youtube', label: 'YouTube', handle: 'Kanal akan diisi' },
      { id: 'tiktok', label: 'TikTok', handle: 'Akun akan diisi' },
    ],
  },

  footer: {
    portalLinkLabel: 'Portal Relawan',
    portalTitle: 'Untuk relawan',
    copyright: (year: number) => `© ${year} Echo Youth GLC`,
  },

  pages: {
    prayer: {
      title: 'Kirim Pokok Doa',
      description: 'Formulir pokok doa akan tersedia di sini.',
    },
    volunteer: {
      title: 'Daftar Relawan',
      description: 'Formulir pendaftaran relawan akan tersedia di sini.',
    },
    notFound: {
      title: 'Halaman tidak ditemukan',
      description: 'Alamat yang Anda buka tidak ada atau sudah dipindahkan.',
      back: 'Kembali ke beranda',
    },
    error: {
      title: 'Terjadi kesalahan',
      description: 'Halaman tidak dapat ditampilkan. Coba muat ulang.',
      reload: 'Muat ulang',
    },
  },

  states: {
    loading: 'Memuat…',
    error: 'Data tidak dapat dimuat.',
    retry: 'Coba lagi',
    empty: 'Belum ada data.',
    placeholder: 'Konten akan diisi',
  },

  // Messages for API failures. Raw server text is never shown.
  errors: {
    network: 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
    rateLimited: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    validation: 'Isian belum benar. Periksa kembali formulir Anda.',
    server: 'Terjadi kesalahan di server. Coba lagi nanti.',
  },
} as const
