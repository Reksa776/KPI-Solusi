export type PackageItem = {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  features: string[];
  highlighted: boolean;
  is_published: boolean;
  sort_order: number;
};

export const defaultPackages: PackageItem[] = [
  {
    id: 1,
    name: "Buzzer Starter",
    slug: "buzzer-starter",
    tagline: "Amplifikasi konten",
    description: "Paket awal untuk mendistribusikan campaign digital melalui buzzer terkurasi dan konten yang relevan.",
    price: 1500000,
    features: ["5 buzzer terkurasi", "1 konten per buzzer", "Koordinasi jadwal publikasi", "Rekap tautan konten"],
    highlighted: false,
    is_published: true,
    sort_order: 1,
  },
  {
    id: 2,
    name: "Community Connect",
    slug: "community-connect",
    tagline: "Community marketing",
    description: "Aktivasi digital bersama komunitas yang punya minat dan kedekatan dengan audiens brand-mu.",
    price: 3500000,
    features: ["Pemetaan komunitas relevan", "1 aktivasi komunitas", "Koordinasi partner dan brand", "Dokumentasi dan rangkuman"],
    highlighted: true,
    is_published: true,
    sort_order: 2,
  },
  {
    id: 3,
    name: "Sejalan Campaign",
    slug: "sejalan-campaign",
    tagline: "Digital campaign terpadu",
    description: "Campaign digital yang menggabungkan distribusi melalui buzzer dan aktivasi komunitas dalam satu strategi.",
    price: 7500000,
    features: ["Kombinasi buzzer dan komunitas", "Rencana aktivasi sesuai brief", "Koordinasi campaign end-to-end", "Laporan performa campaign"],
    highlighted: false,
    is_published: true,
    sort_order: 3,
  },
];
