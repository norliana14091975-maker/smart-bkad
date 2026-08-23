'use client'

interface SectionHeadingProps {
  title: string
  subtitle?: string
  extra?: string
}

/** Judul laporan di bagian atas konten, meniru gaya judul dashboard asli. */
export function SectionHeading({ title, subtitle, extra }: SectionHeadingProps) {
  return (
    <div className="mb-5 text-center">
      <h2 className="text-base font-bold uppercase tracking-[0.18em] text-foreground sm:text-lg">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
      {extra && <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{extra}</p>}
    </div>
  )
}
