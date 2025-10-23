'use client'

import React from 'react'
import html2canvas from 'html2canvas'

export default function DownloadSnapshot() {
  const handleCapture = async () => {
    const el = document.getElementById('print-area')
    if (!el) {
      // eslint-disable-next-line no-alert
      alert('Không tìm thấy phần cần chụp (id="print-area")')
      return
    }

    try {
      // Inline computed color values to avoid css color functions (like lab()) that html2canvas
      // cannot parse. We'll record previous inline styles and restore them after capture.
      const nodes: Element[] = Array.from(el.querySelectorAll('*'))
      nodes.unshift(el)
      const savedStyles: Array<{ node: Element; prev: string | null }> = []
      const colorProps = [
        'color',
        'background-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
        'fill',
        'stroke',
        'text-decoration-color',
        'box-shadow',
      ]
      try {
        for (const node of nodes) {
          try {
            const computed = window.getComputedStyle(node as Element)
            // build a small inline css string with resolved color values
            const inlineParts: string[] = []
            for (const prop of colorProps) {
              const val = (computed as any).getPropertyValue(prop)
              if (!val) continue
              // only inline when value contains 'lab(' (the problematic case) or is non-empty
              if (String(val).includes('lab(') || String(val).trim() !== '') {
                inlineParts.push(`${prop}: ${val}`)
              }
            }
            if (inlineParts.length > 0) {
              const prev = (node as HTMLElement).getAttribute && (node as HTMLElement).getAttribute('style')
              savedStyles.push({ node, prev })
              const newInline = (prev ? prev + '; ' : '') + inlineParts.join('; ')
              try { (node as HTMLElement).setAttribute('style', newInline) } catch {}
            }
          } catch {}
        }
      } catch {}

      const scale = 2
      const canvas = await html2canvas(el as HTMLElement, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
      })

      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `snapshot-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }, 'image/png', 0.92)
      // restore previous inline styles
      try {
        for (const s of savedStyles) {
          try {
            if ((s.node as HTMLElement).setAttribute) {
              if (s.prev == null) (s.node as HTMLElement).removeAttribute('style')
              else (s.node as HTMLElement).setAttribute('style', s.prev)
            }
          } catch {}
        }
      } catch {}
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('capture error', err)
      // eslint-disable-next-line no-alert
      alert('Lỗi khi chụp ảnh: ' + (err as Error).message)
    }
  }

  return (
    <div>
      <button onClick={handleCapture} className="btn">
        Tải ảnh
      </button>
    </div>
  )
}
