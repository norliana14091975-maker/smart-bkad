'use client'

import { ImportLraPanel } from '@/components/dashboard/sections/import-lra-panel'

/** Section import LRA untuk admin: dapat memilih OPD/SKPD tujuan. */
export function AdminImportSection() {
  return <ImportLraPanel mode="admin" />
}
