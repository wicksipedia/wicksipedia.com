'use client'

import { Comments as CommentsComponent } from 'pliny/comments'
import { useRef, useState, useEffect } from 'react'
import siteMetadata from '@/data/siteMetadata'
import { useIntersectionObserver } from 'usehooks-ts'

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false)

  const ref = useRef<HTMLDivElement | null>(null)
  const entry = useIntersectionObserver(ref, {})
  const isVisible = !!entry?.isIntersecting

  useEffect(() => {
    if (isVisible) {
      setLoadComments(true)
    }
  }, [isVisible])

  return (
    <div ref={ref}>
      {!loadComments && <button onClick={() => setLoadComments(true)}>Load Comments</button>}
      {siteMetadata.comments && loadComments && (
        <CommentsComponent commentsConfig={siteMetadata.comments} slug={slug} />
      )}
    </div>
  )
}
