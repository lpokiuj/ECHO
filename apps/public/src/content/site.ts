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
  },

  nav: {
    items: [
      { id: 'tentang', label: 'Tentang', to: '/#tentang' },
      { id: 'ibadah', label: 'Ibadah', to: '/#ibadah' },
      { id: 'kegiatan', label: 'Kegiatan', to: '/#kegiatan' },
      { id: 'bidang', label: 'Bidang', to: '/#bidang' },
      { id: 'doa', label: 'Doa', to: '/doa' },
    ],
    cta: { label: 'Daftar Relawan', to: '/relawan' },
  },

  hero: {
    id: 'beranda',
    eyebrow: 'Eyebrow akan diisi',
    title: 'Judul utama akan diisi',
    description: 'Deskripsi singkat gereja akan diisi di sini.',
    primaryCta: { label: 'Daftar Relawan', to: '/relawan' },
    secondaryCta: { label: 'Kirim Pokok Doa', to: '/doa' },
  },

  // Home sections in page order. F2 and F3 fill the bodies; the ids are the nav anchors.
  sections: {
    about: {
      id: 'tentang',
      title: 'Tentang Echo',
      intro: 'Teks tentang Echo akan diisi.',
    },
    worship: {
      id: 'ibadah',
      title: 'Ibadah',
      intro: 'Jadwal ibadah akan diisi.',
    },
    events: {
      id: 'kegiatan',
      title: 'Kegiatan',
      intro: 'Daftar kegiatan akan diisi.',
      empty: 'Belum ada kegiatan yang dijadwalkan.',
      error: 'Kegiatan tidak dapat dimuat.',
      timezoneLabel: 'WIB',
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
