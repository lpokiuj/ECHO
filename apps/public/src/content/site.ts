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
      { id: 'acara', label: 'Acara', to: '/#acara' },
      { id: 'tentang', label: 'Tentang', to: '/#tentang' },
      { id: 'pertama-kali', label: 'Pertama Kali', to: '/#pertama-kali' },
      { id: 'kontak', label: 'Kontak', to: '/#kontak' },
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

  // Home sections in page order (the hero comes first); the key order is the page order. The ids
  // are the nav anchors. Contact and giving values are plain-text placeholders ("akan diisi"):
  // never put a real number, account or email here without a deliberate change to content.test.ts.
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
      id: 'acara',
      title: 'Acara',
      intro: 'Acara mendatang akan diisi.',
      empty: 'Belum ada acara mendatang.',
      error: 'Acara tidak dapat dimuat.',
      timezoneLabel: 'WIB',
    },
    about: {
      id: 'tentang',
      title: 'Tentang Kami',
      intro: 'Teks tentang Echo akan diisi.',
      vision: { title: 'Visi', text: 'Visi akan diisi.' },
      story: { title: 'Cerita singkat', paragraphs: ['Cerita singkat akan diisi.'] },
      bidang: {
        title: 'Bidang pelayanan',
        intro: 'Penjelasan bidang pelayanan akan diisi.',
        items: [
          { id: 'bidang-1', name: 'Nama bidang akan diisi', text: 'Deskripsi akan diisi.' },
          { id: 'bidang-2', name: 'Nama bidang akan diisi', text: 'Deskripsi akan diisi.' },
          { id: 'bidang-3', name: 'Nama bidang akan diisi', text: 'Deskripsi akan diisi.' },
          { id: 'bidang-4', name: 'Nama bidang akan diisi', text: 'Deskripsi akan diisi.' },
        ],
      },
    },
    faq: {
      id: 'pertama-kali',
      title: 'Pertama Kali?',
      intro: 'Pertanyaan yang sering diajukan pengunjung baru akan diisi.',
      items: [
        { id: 'faq-1', question: 'Pertanyaan pertama akan diisi', answer: 'Jawaban akan diisi.' },
        { id: 'faq-2', question: 'Pertanyaan kedua akan diisi', answer: 'Jawaban akan diisi.' },
        { id: 'faq-3', question: 'Pertanyaan ketiga akan diisi', answer: 'Jawaban akan diisi.' },
        { id: 'faq-4', question: 'Pertanyaan keempat akan diisi', answer: 'Jawaban akan diisi.' },
      ],
    },
    contact: {
      id: 'kontak',
      title: 'Kontak',
      intro: 'Hubungi kami lewat kanal berikut.',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Email',
    },
    giving: {
      id: 'persembahan',
      title: 'Persembahan',
      intro: 'Informasi persembahan akan diisi.',
      bank: {
        title: 'Transfer bank',
        bankName: { label: 'Bank', value: 'Nama bank akan diisi' },
        accountName: { label: 'Atas nama', value: 'Nama rekening akan diisi' },
        accountNumber: { label: 'Nomor rekening', value: 'Nomor rekening akan diisi' },
      },
      qris: { title: 'QRIS', placeholder: 'Kode QRIS akan diisi' },
      note: 'Catatan persembahan akan diisi.',
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
    contactTitle: 'Hubungi kami',
    copyright: (year: number) => `© ${year} Echo Youth GLC`,
  },

  pages: {
    prayer: {
      title: 'Kirim Pokok Doa',
      description: 'Tuliskan pokok doa Anda. Kami akan mendoakannya.',
      form: {
        requiredLegend: 'Tanda * wajib diisi.',
        requiredMark: '*',
        optional: '(opsional)',
        nameLabel: 'Nama',
        nameHint: 'Boleh dikosongkan jika Anda ingin tidak disebutkan.',
        followUpLabel: 'Saya ingin dihubungi kembali',
        followUpHint: 'Isi kontak di bawah supaya kami bisa menghubungi Anda.',
        contactLabel: 'Kontak',
        contactHint: 'Nomor WhatsApp atau email.',
        contentLabel: 'Pokok doa',
        contentHint: 'Ceritakan apa yang ingin Anda doakan.',
        counter: { of: 'dari', unit: 'karakter' },
        counterNearLimit: (remaining: number) => `Sisa ${remaining} karakter.`,
        consentLabel: 'Saya setuju pokok doa ini dikirim dan dibaca.',
        privacyNote: 'Pokok doa hanya dibaca oleh gembala/pembina.',
        honeypotLabel: 'Website',
        submit: 'Kirim pokok doa',
        submitting: 'Mengirim…',
        errors: {
          contentRequired: 'Pokok doa wajib diisi.',
          contentTooLong: (max: number) => `Pokok doa maksimal ${max} karakter.`,
          nameTooLong: (max: number) => `Nama maksimal ${max} karakter.`,
          contactRequired: 'Kontak wajib diisi jika Anda ingin dihubungi kembali.',
          contactTooLong: (max: number) => `Kontak maksimal ${max} karakter.`,
          consentRequired: 'Anda perlu menyetujui sebelum mengirim.',
        },
      },
      success: {
        title: 'Pokok doa sudah diterima',
        message: 'Terima kasih. Pokok doa Anda sudah kami terima.',
        again: 'Kirim pokok doa lain',
      },
    },
    volunteer: {
      title: 'Daftar Relawan',
      description: 'Ingin melayani? Isi formulir ini dan pengurus akan menghubungi Anda.',
      form: {
        fullNameLabel: 'Nama lengkap',
        whatsappLabel: 'Nomor WhatsApp',
        whatsappHint: 'Kami menghubungi Anda lewat WhatsApp.',
        emailLabel: 'Email',
        emailHint: 'Boleh dikosongkan.',
        bidang: {
          legend: 'Bidang yang diminati',
          hint: 'Pilih satu atau lebih bidang pelayanan.',
          loading: 'Memuat daftar bidang…',
          failed:
            'Pilihan bidang tidak dapat dimuat. Anda tetap bisa mendaftar tanpa memilih bidang.',
          empty: 'Belum ada bidang yang tersedia. Anda tetap bisa mendaftar.',
        },
        availabilityLabel: 'Waktu yang tersedia',
        availabilityHint: 'Contoh: hari dan jam Anda bisa melayani.',
        messageLabel: 'Pesan',
        messageHint: 'Ceritakan singkat tentang diri Anda atau pertanyaan Anda.',
        consentLabel: 'Saya setuju data ini dikirim dan dipakai untuk menghubungi saya.',
        privacyNote: 'Data Anda hanya dilihat oleh pengurus/pembina.',
        honeypotLabel: 'Website',
        submit: 'Kirim pendaftaran',
        submitting: 'Mengirim…',
        errors: {
          fullNameRequired: 'Nama lengkap wajib diisi.',
          fullNameTooLong: (max: number) => `Nama lengkap maksimal ${max} karakter.`,
          whatsappRequired: 'Nomor WhatsApp wajib diisi.',
          whatsappTooLong: (max: number) => `Nomor WhatsApp maksimal ${max} karakter.`,
          emailInvalid: 'Format email belum benar.',
          emailTooLong: (max: number) => `Email maksimal ${max} karakter.`,
          availabilityTooLong: (max: number) => `Waktu tersedia maksimal ${max} karakter.`,
          messageTooLong: (max: number) => `Pesan maksimal ${max} karakter.`,
          bidangTooMany: (max: number) => `Pilih paling banyak ${max} bidang.`,
          consentRequired: 'Anda perlu menyetujui sebelum mengirim.',
        },
      },
      success: {
        title: 'Pendaftaran sudah diterima',
        message: 'Terima kasih. Pengurus akan menghubungi Anda.',
        again: 'Daftarkan orang lain',
      },
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
    rateLimited: 'Terlalu banyak percobaan, coba lagi nanti.',
    validation: 'Isian belum benar. Periksa kembali formulir Anda.',
    server: 'Terjadi kesalahan di server. Coba lagi nanti.',
  },
} as const
