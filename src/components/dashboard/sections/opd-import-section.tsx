'use client'

import { ImportLraPanel } from '@/components/dashboard/sections/import-lra-panel'

/** Section import LRA untuk akun OPD: otomatis terikat OPD yang login. */
export function OpdImportSection() {
  return <ImportLraPanel mode="opd" />
}
