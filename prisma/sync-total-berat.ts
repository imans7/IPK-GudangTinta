import { syncTotalBerat } from "../lib/sync-berat";

syncTotalBerat().then((r) => { console.log(`total_berat_tinta disinkronkan untuk ${r.n} barang (bulan ${r.periode}).`); process.exit(0); });
