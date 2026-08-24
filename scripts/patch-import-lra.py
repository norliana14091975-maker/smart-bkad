import re

with open('src/lib/import-lra.ts') as f:
    src = f.read()

# 1. Ganti blok prompt buildChunkPrompt (dari 'Berikut potongan' hingga 'balas [].')
pattern = re.compile(
    r"(    'Berikut potongan teks hasil ekstraksi PDF LRA:\\\\n\\\\n' \+\n.*?balas \[\]'\n  \))",
    re.DOTALL,
)
m = pattern.search(src)
assert m, 'blok prompt tidak ketemu'

new_prompt = """    'Berikut potongan teks hasil ekstraksi PDF LRA:\\n\\n' +
    chunk +
    '\\n\\nEkstrak SEMUA baris yang memiliki kode rekening LRA sesuai struktur Bagan Akun ' +
    'Standar (BAS) Permendagri 77/2020, yaitu deretan angka yang diawali 4 (pendapatan), ' +
    '5 (belanja), atau 6 (pembiayaan) dengan level:\\n' +
    '- level akun (1 digit): "4", "5", "6"\\n' +
    '- level kelompok: "4.1" s.d. "4.3", "5.1" s.d. "5.4", "6.1"-"6.2"\\n' +
    '- level jenis: "4.1.01", "5.1.02"\\n' +
    '- level obyek: "4.1.01.01", "5.1.02.01"\\n' +
    '- level rincian obyek (3 digit terakhir): "4.1.01.01.001", "5.1.01.01.001"\\n' +
    'Kode boleh tertulis tanpa titik (mis. "4102" artinya 4.1.02) \u2014 salin persis seperti di teks.\\n' +
    'Untuk setiap baris kumpulkan: "code" (kode rekening persis seperti di teks), ' +
    '"name" (uraian/nama rekening), "anggaran" (nilai anggaran), dan "realisasi" (nilai realisasi).\\n' +
    'Aturan:\\n' +
    '1. Ubah format angka Indonesia (titik pemisah ribuan, koma desimal, contoh ' +
    '"49.898.218.773.411,00") menjadi angka polos (49898218773411).\\n' +
    '2. Nilai kosong, strip, atau tidak ada dianggap 0. Realisasi negatif ditulis angka minus.\\n' +
    '3. Lewati kepala kolom, baris JUMLAH/subtotal, dan baris tanpa kode rekening.\\n' +
    '4. Jangan mengarang data \u2014 hanya baris yang benar-benar ada pada teks.\\n\\n' +
    'Balas HANYA array JSON valid tanpa penjelasan dan tanpa blok kode, contoh:\\n' +
    '[{"code":"4","name":"PENDAPATAN DAERAH","anggaran":71450673065697,"realisasi":45000000000000},\\n' +
    '{"code":"4.1.01.01.001","name":"Pajak Hotel Bintang 3","anggaran":3000000000000,"realisasi":1800000000000}]\\n' +
    'Jika tidak ada baris yang cocok, balas [].'
  )"""

src = src[: m.start(1)] + new_prompt + src[m.end(1):]

# 2. confirmLra: applyHierarchy setelah merge
old_confirm = """  const merged = new Map<string, LraItem>()
  for (const entry of items) {
    const item = normalizeItem(entry)
    if (item) merged.set(item.code, item)
  }
  const lraItems = [...merged.values()]"""
new_confirm = """  const merged = new Map<string, LraItem>()
  for (const entry of items) {
    const item = normalizeItem(entry)
    if (item) merged.set(item.code, item)
  }

  // Lengkapi hierarki sesuai struktur LRA (induk hilang diturunkan dari
  // jumlah anaknya) — idempoten terhadap hasil parse.
  const { items: lraItems } = applyHierarchy([...merged.values()])"""
assert old_confirm in src, 'confirm tidak ketemu'
src = src.replace(old_confirm, new_confirm)

with open('src/lib/import-lra.ts', 'w') as f:
    f.write(src)
print('import-lra.ts updated')
