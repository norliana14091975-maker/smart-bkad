'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransparansiDocDto } from '@/types/budget'

type DocType = 'APBD' | 'Realisasi'

async function fetchDocs(type: DocType): Promise<TransparansiDocDto[]> {
  const res = await fetch(`/api/transparansi?type=${type}`)
  if (!res.ok) throw new Error('Gagal memuat dokumen')
  const json = (await res.json()) as { data: TransparansiDocDto[] }
  return json.data
}

export function TransparansiSection({ initialType = 'APBD' }: { initialType?: DocType }) {
  const [type, setType] = useState<DocType>(initialType)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['transparansi', type],
    queryFn: () => fetchDocs(type),
  })

  return (
    <div>
      <h1 className="mb-4 text-center text-lg font-bold uppercase tracking-[0.18em] text-foreground">
        Transparansi {type}
      </h1>

      <Tabs value={type} onValueChange={(v) => setType(v as DocType)} className="w-full">
        <div className="flex justify-center">
          <TabsList className="h-auto w-max gap-1 bg-muted p-1">
            <TabsTrigger
              value="APBD"
              className="px-5 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              APBD
            </TabsTrigger>
            <TabsTrigger
              value="Realisasi"
              className="px-5 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Realisasi
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Memuat…'
              : `Menampilkan 1-${data?.length ?? 0} dari ${data?.length ?? 0} dokumen.`}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead className="min-w-[280px]">Detail Transparansi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError && (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-destructive">
                    Gagal memuat dokumen transparansi.
                  </TableCell>
                </TableRow>
              )}
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={2}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                data?.map((doc, idx) => (
                  <TableRow key={doc.title} className="group">
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <a
                        href={doc.url}
                        onClick={(e) => e.preventDefault()}
                        className="flex items-center gap-2 font-medium text-[#17408b] hover:underline"
                      >
                        <FileText className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                        {doc.title}
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  )
}
